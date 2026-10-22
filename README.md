# Offers API

NestJS backend for the customer app, business app and admin dashboard. See [`ROADMAP.md`](ROADMAP.md) for the plan.

## Run locally

Requires Node.js and Docker.

```bash
cp .env.example .env
npm install            # also generates the Prisma client
npm run db:up          # start Postgres in Docker (port 5433)
npm run db:migrate     # apply migrations
npm run db:seed        # categories + a demo store with offers
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Health: http://localhost:3000/api/v1/health (checks the database too)
- Swagger: http://localhost:3000/docs

## Auth

Every route needs a logged-in user unless it's marked `@Public()`. Use `@Roles(UserRole.ADMIN)` to limit a route to certain roles, and `@CurrentUser()` to get the user.

| Who | How they log in |
|---|---|
| Customers | `POST /auth/google` or `/auth/apple` with the ID token from the device |
| Merchants | `POST /auth/login` with phone + password (accounts created by admins) |
| Admins | `POST /auth/login` with email + password |

Logins return a short-lived `accessToken` (send as `Authorization: Bearer ...`) and a `refreshToken`. Call `POST /auth/refresh` to get a new pair; each refresh token works once.

**Trying it in Swagger:** call `/auth/login` (or `/auth/dev/customer` for a customer, which needs `DEV_AUTH_ENABLED=true`), copy the `accessToken`, click **Authorize** at the top and paste it.

Dev logins created by the seed (only when `DEV_AUTH_ENABLED=true`, never in production):

| Role | Login | Password |
|---|---|---|
| Admin | `admin@offers.local` | `Admin12345!` |
| Editor (dashboard, can't delete or manage the team) | `editor@offers.local` | `Editor12345!` |
| Store owner (demo store) | `0910000001` | `Merchant123!` |
| Store staff (Hay Al Andalus branch) | `0920000002` | `Staff123!` |

Users on a temporary password (new merchants, reset passwords, new admins) get `403` with `"error": "PasswordChangeRequired"` everywhere except `GET /auth/me` and `POST /auth/change-password`. Routes that should stay open for them use `@AllowTemporaryPassword()`.

## API areas

| Prefix | Who | Notes |
|---|---|---|
| `/api/v1/auth` | Everyone | Login, tokens, profile |
| `/api/v1/categories`, `/api/v1/offers`, `/api/v1/stores/:id` | Public | Browsing; send `lat`/`lng` for distances |
| `/api/v1/offers/:id/claim`, `/api/v1/me/...`, `/api/v1/stores/:id/follow` | Customers | Claims, my claims, follows |
| `/api/v1/admin/...` | Admins | `@Roles(UserRole.ADMIN)` |
| `/api/v1/business/stores/:storeId/...` | Store owners and staff | `StoreAccessGuard`: members of that store only; `@StoreRoles(OWNER)` for owner-only routes; `@CurrentStore()` gives the membership |

## Background jobs

`ClaimsExpiryService` runs every minute (`@nestjs/schedule`): it expires reservations that weren't picked up (gives the piece back and adds a no-show strike; every 3rd strike blocks claiming for 7 days) and ends offers whose time is up. It doesn't run when `NODE_ENV=test`; the tests call `run()` directly.

## Uploads

Photos are uploaded as `multipart/form-data` (max 1 MB, JPEG/PNG/WebP, checked from the file bytes) and saved under `UPLOADS_DIR` with random names. The database stores relative paths; responses return full URLs built from `PUBLIC_UPLOADS_URL`. In development the API serves `/uploads/...` itself (`SERVE_UPLOADS=true`); in production Caddy serves the folder and `SERVE_UPLOADS=false`. The e2e tests upload to a temp folder.

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Run with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm run lint` | Lint with oxlint |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (needs the database running) |
| `npm run db:up` / `db:down` | Start / stop local Postgres |
| `npm run db:migrate` | Create and apply a migration after changing `prisma/schema.prisma` |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Load demo data (safe to run again) |
| `npm run db:reset` | Drop everything, re-run migrations and seed |
| `npm run db:studio` | Browse the data in Prisma Studio |
| `npm run db:deploy` | Apply migrations in production |
| `npm run admin:create -- --email you@example.ly --name "Name"` | Create an admin (prints a temporary password once) |

## Changing the database

1. Edit `prisma/schema.prisma`
2. `npm run db:migrate -- --name what_changed`
3. `npm run db:generate`
4. Commit the schema and the new folder in `prisma/migrations/`

## Structure

```
prisma/
  schema.prisma            # database schema
  migrations/              # generated SQL migrations (commit these)
  seed.ts                  # demo data
prisma.config.ts           # Prisma CLI config (schema path, DATABASE_URL, seed)
docker-compose.yml         # local Postgres
src/
  main.ts                  # bootstrap: config, Swagger, listen
  app.module.ts            # root module, wires feature modules
  config/                  # env schema + validation (zod)
  setup/                   # global app setup (prefix, versioning, pipes, security) and Swagger
  database/                # PrismaService, available everywhere
  storage/                 # saving uploaded images, upload decorators
  common/                  # shared building blocks
    auth/                  # AuthUser type
    decorators/            # @Public(), @Roles(), @CurrentUser()
    dto/                   # pagination
    filters/               # error format (incl. database conflicts → 409)
    validation/            # @IsLibyanPhone(), boolean query params
    utils/                 # phone, temporary passwords, prices, claim codes, distances
  modules/                 # one folder per feature
    auth/                  # login, tokens, guards
    admin/                 # dashboard stats
    categories/            # public list + admin management
    stores/                # stores, branches, staff, store access guard, store stats
    products/              # a store's saved products and photos
    offers/                # posting and managing offers, admin moderation
    claims/                # claiming, my claims, redeeming at the counter, expiry job
    users/                 # admin user management
    health/
  generated/prisma/        # generated Prisma client (not committed)
scripts/                   # one-off scripts (create admin)
test/                      # e2e tests
```

Each feature lives in `src/modules/<feature>/` with its own module, controller, service and DTOs. Controllers are split by audience: `public-*` (browsing), `customer-*`, `business-*` (stores) and `admin-*`.
