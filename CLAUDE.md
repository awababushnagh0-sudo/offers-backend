# Coding rules (offers backend)

Read this before writing any code in this repo, and follow it in every change.
[ROADMAP.md](ROADMAP.md) has the plan and the product decisions; [README.md](README.md)
has the commands. If a rule gets in the way of a task, say so and ask; don't quietly work
around it.

NestJS + Prisma + Postgres, ESM, strict TypeScript. Three Flutter apps (customer,
business, admin) call this API through a Dart client generated from the Swagger spec, so
**the API shape is a contract**: changing it can break apps already on people's phones.

## 1. Where code goes

```
src/
  modules/<feature>/     one folder per feature: module, controllers, services, dto/
  common/                shared building blocks: decorators, pagination, error filter,
                         validation decorators, utils (phone, money, geo, codes)
  config/                env schema (zod)
  database/              PrismaService
  storage/               saving and serving uploaded images
  setup/                 global app setup and Swagger
  generated/prisma/      generated Prisma client; never edit
prisma/                  schema, migrations, seed
test/                    e2e tests, one file per audience
```

- **Controllers are split by audience**, each with its route prefix and Swagger tag:

  | File | Route | Who |
  |---|---|---|
  | `public-offers.controller.ts` | `/offers` | anyone (`@Public()`) |
  | `customer-claims.controller.ts` | `/offers/:id/claim`, `/me/...` | signed-in customers |
  | `business-products.controller.ts` | `/business/stores/:storeId/...` | store owners and staff |
  | `admin-stores.controller.ts` | `/admin/...` | admins (`@Roles(UserRole.ADMIN)`) |

- **Controllers are thin**: read the request, call one service method, return its DTO.
  No Prisma and no business rules in controllers.
- **Services** hold the logic and the Prisma queries, and map rows to response DTOs
  (`toDto`). Code used by more than one module goes in `common/` or is exported from its
  module; never copy it.

## 2. Auth and access

- Every route needs a signed-in user unless it's marked `@Public()`. Use `@Roles(...)`
  for role checks and `@CurrentUser()` to get the user.
- Business routes live under `business/stores/:storeId` with `StoreAccessGuard`;
  owner-only routes add `@StoreRoles(StoreMemberRole.OWNER)`. Read the store with
  `@CurrentStore()`.
- **Scope every query to who is asking.** A product, offer or claim is looked up by its
  id *and* its store (`findInStore(storeId, id)`) or user, never by id alone. Staff
  limited to a branch only see that branch.
- Something the caller may not see returns **404, not 403**, so ids can't be probed.
- `@AllowTemporaryPassword()` only on routes a user with a temporary password truly needs.
- Login-like endpoints get a stricter `@Throttle(...)`. Passwords go through
  `PasswordService` (argon2); tokens are stored hashed.
- Never log passwords, tokens or ID tokens.
- Dev-only shortcuts stay behind `DEV_AUTH_ENABLED` and are refused in production.

## 3. The API contract (DTOs and Swagger)

- **Request DTOs** (`dto/*.dto.ts`) validate every field with class-validator, with
  limits (`@MaxLength`, `@Max`, ...). Use the shared decorators: `@IsLibyanPhone()`,
  `@IsPrice()`, `@OptionalBooleanQuery()`. Id params use `ParseUUIDPipe`.
- **Response DTOs** are explicit classes, and services return them, never Prisma rows,
  so internal fields (`passwordHash`, paths) can't leak.
- **DTO class names are unique across the app** (`src/setup/dto-names.spec.ts` checks):
  Swagger keys schemas by class name. Prefix by audience when two shapes differ
  (`AdminStatsDto`, `StoreStatsDto`).
- Doc comments and `@example` on DTO fields become the Swagger docs (the Swagger plugin
  reads them). Every route has `@ApiOperation({ summary })`, and every controller has
  `@ApiTags` (`'Business: Products'`) and `@ApiBearerAuth()` unless it's public.
- Lists are paginated: the query extends `PaginationQueryDto`, the service uses
  `pageArgs` / `pageMeta`, and the response is `{ items, meta }`.
- **Changing the contract:**
  - Prefer additive changes: new optional fields, new endpoints.
  - Renaming or removing a field, or making one required, breaks apps already
    installed. Do it only together with raising `*_APP_MIN_VERSION`, and say so.
  - After any DTO change, the client must regenerate `offers_api`
    (`tool/generate_api.sh` in the client repo). Mention it when you finish.

## 4. Errors

- Throw Nest's HTTP exceptions (`NotFoundException`, `ConflictException`, ...).
  `AllExceptionsFilter` gives every error the same JSON shape and hides unexpected ones.
  Don't catch errors just to rethrow them, and never return stack traces.
- Messages are short English sentences a user could understand: 409 messages ("Sold
  out") can be shown in the apps as they are.
- When an app must react to a specific case, add a stable `error` code
  (`PasswordChangeRequired`, `ClaimBanned`) and don't change it later.
- Database conflicts (unique, foreign key, missing record) are already mapped to
  409 / 400 / 404 by the filter.

## 5. Database

- Every schema change is a migration: edit `prisma/schema.prisma`, then
  `npm run db:migrate -- --name what_changed`. Commit the schema and the migration
  folder together. Never edit a migration that has already been applied.
- Naming: camelCase fields mapped to snake_case columns (`@map`), plural snake_case
  tables (`@@map`), ids `@default(uuid(7)) @db.Uuid`, `createdAt` / `updatedAt` on
  every table, an index on every foreign key and on columns used to filter or sort.
- **Money is `Decimal(10, 3)`** (LD, 1 LD = 1000 dirhams). The API sends and accepts
  prices as strings with 3 decimals (`formatPrice`, `@IsPrice()`). Never use JavaScript
  numbers for money.
- Times are stored in UTC. "Today" for stores means Libya time (UTC+2 all year, no
  daylight saving).
- Keep the seed (`prisma/seed.ts`) working and safe to run twice.

## 6. Correctness under load

Many customers can grab the last pieces of an offer at the same time.

- Anything that checks and then writes (quantities, per-user limits, redeeming once)
  runs in one `$transaction`, using a conditional update and checking its count:
  `updateMany({ where: { id, remainingQuantity: { gt: 0 } }, data: { decrement } })`.
- Never read a number, change it in JavaScript and write it back.
- Per-customer races (double taps) use the advisory lock pattern in `ClaimsService`.
- Writes that must all happen or none go in one transaction.

## 7. Config, uploads and jobs

- Every environment variable is declared in `src/config/env.validation.ts` (zod), with
  a default or as required, and added to `.env.example`. Read it with `ConfigService`,
  never `process.env` (scripts and the seed are the only exceptions). Unsafe values are
  refused in production.
- Uploads go through `StorageService` and the upload decorators: size limit, type
  checked from the file bytes, random names. The database stores relative paths;
  responses build URLs with `storage.url(...)`.
- Scheduled jobs (`@nestjs/schedule`) must be safe to run twice, don't run when
  `NODE_ENV=test`, and expose `run()` so tests can call them.

## 8. Clean code

- Match the code around you: naming, comment density, structure.
- ESM: relative imports end in `.js`. Import Prisma types from `generated/prisma`.
- No `any`, no floating promises (oxlint fails on them), no dead or commented-out code,
  no unused parameters.
- Constants with meaning get a name (`MAX_ACTIVE_RESERVATIONS`), not a bare number.
- Comments say *why*, not what. Doc comments on services and DTO fields.

## 9. Tests and checks

- Pure helpers get unit tests next to them (`phone.spec.ts`).
- Every endpoint is covered by an e2e test in `test/<audience>.e2e-spec.ts`: the
  normal case, who may not call it (signed out, wrong role, another store's member →
  404, staff vs owner) and the edge cases (limits, sold out, double submit).
- E2e tests create their own data with a unique run id and delete it afterwards; they
  never depend on the seed.
- Before saying a change is done, all must pass (`npm run db:up` first):

  ```bash
  npm run format
  npm run lint
  npm run build
  npm test
  npm run test:e2e
  ```

## 10. Commits

Commit only when asked, in small commits grouped by what they change. No
`Co-Authored-By: Claude` line or any other Claude attribution in commits or PRs.
