# Offers API

NestJS backend for the customer app, business app and admin dashboard. See [`ROADMAP.md`](ROADMAP.md) for the plan.

## Run locally

```bash
cp .env.example .env
npm install
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Health: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/docs

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Run with hot reload |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm run lint` | Lint with oxlint |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |

## Structure

```
src/
  main.ts                  # bootstrap: config, Swagger, listen
  app.module.ts            # root module, wires feature modules
  config/                  # env schema + validation (zod)
  setup/                   # global app setup (prefix, versioning, pipes, security) and Swagger
  common/                  # shared building blocks (filters, guards, decorators, ...)
  modules/                 # one folder per feature
    health/
test/                      # e2e tests
```

Each feature lives in `src/modules/<feature>/` with its own module, controller, service and DTOs.
