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
| Store owner (demo store) | `0910000001` | `Merchant123!` |
| Store staff (Hay Al Andalus branch) | `0920000002` | `Staff123!` |

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
  common/                  # shared building blocks
    auth/                  # AuthUser type
    decorators/            # @Public(), @Roles(), @CurrentUser()
    filters/               # error format
    utils/                 # helpers (Libyan phone normalization)
  modules/                 # one folder per feature
    auth/                  # login, tokens, guards
    health/
  generated/prisma/        # generated Prisma client (not committed)
test/                      # e2e tests
```

Each feature lives in `src/modules/<feature>/` with its own module, controller, service and DTOs.
