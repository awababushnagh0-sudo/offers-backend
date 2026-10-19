# Offers App — Roadmap

Discount offers app for Libya (starting with cafés and sweets shops in Tripoli).
Stores post offers, customers browse and claim them, then pay cash in store.

## The system

| Part | Tech | Who uses it |
|---|---|---|
| Customer app | Flutter (flavor `customer`) | Public: browse offers, claim, show QR at the store |
| Business app | Flutter (flavor `business`) | Store owners and staff: post offers, scan QR codes |
| Admin dashboard | Flutter Web | Our team: create stores, moderate, stats |
| Backend API | NestJS + Postgres/PostGIS | All three apps |
| Hosting | Libyan Spider VPS, Docker Compose, Caddy | Paid in LYD |

## Decisions so far

- **Store accounts are created by admins** (our team onboards stores in person). No self-signup in the MVP.
- **Customers browse without an account.** To claim, they sign in with Google or Apple and enter a phone number (unverified for now).
- **No online payment in the MVP.** Customers pay cash in store.
- **Two kinds of offers:**
  - *Limited*: has a quantity. Claiming reserves one and starts a time window; if it isn't redeemed in time it expires and goes back on sale.
  - *Unlimited*: no quantity. The customer just gets a code to show at the counter.
- **No-show protection:** limited active claims per user and strikes for expired claims.
- **Photos are compressed in the app before upload** (1280px full + 400px thumbnail, about 200 KB + 30 KB). The server rejects big files.
- **Offers are saved as products,** so a store can repost an old offer in seconds without a new photo.

---

## Phase 0: Backend skeleton ✅

- [x] NestJS project (ESM, strict TypeScript, Vitest, oxlint)
- [x] Env validation with zod (app refuses to start with bad config)
- [x] Global setup: `/api/v1` prefix, URI versioning, validation pipe, helmet, CORS, shutdown hooks
- [x] Consistent JSON error shape for all errors
- [x] Health endpoint: `GET /api/v1/health`
- [x] Swagger UI at `/docs` (JSON at `/docs/json`)
- [x] e2e tests for health and error shape

## Phase 1: Database

- [ ] `docker-compose.yml` for local Postgres + PostGIS
- [ ] Prisma setup + `PrismaModule` / `PrismaService`
- [ ] Schema: users, auth identities (Google/Apple), refresh tokens, categories, stores, branches (with location), store members (owner/staff), products, offers, offer branches, claims, follows, device tokens
- [ ] First migration + seed script (categories, a demo store, demo offers)
- [ ] Add a database check to the health endpoint

## Phase 2: Auth

- [ ] Customer sign-in: verify Google / Apple ID tokens, create or find the user
- [ ] Store staff and admin login: phone or email + password (argon2)
- [ ] JWT access token (short) + refresh token (long, hashed, rotated) + logout
- [ ] Guards: `JwtAuthGuard`, `RolesGuard` (customer / merchant / admin), store membership check
- [ ] Rate limiting on auth endpoints (`@nestjs/throttler`)

## Phase 3: Admin API

- [ ] Categories CRUD
- [ ] Create a store with branches and an owner account (temporary password)
- [ ] Add or remove staff, reset passwords
- [ ] Deactivate stores, remove offers
- [ ] Basic stats (stores, offers, claims, redemptions)

## Phase 4: Business API

- [ ] Store profile and branches (view and edit)
- [ ] Image upload: size and type limits, saved to disk, served by Caddy
- [ ] Products: create, edit, archive, list
- [ ] Offers: create from a product, pause, end, repost
- [ ] Redeem a claim by scanning its QR code
- [ ] Stats per offer: views, claims, redemptions

## Phase 5: Customer API

- [ ] Browse offers: nearby (PostGIS), by category, ending soon, search
- [ ] Offer details and store page
- [ ] Claim an offer (atomic quantity update, active claim limit, strikes)
- [ ] My claims (active and history), cancel a claim
- [ ] Follow and unfollow stores
- [ ] Cron jobs: expire claims (return quantity, add strike), end finished offers

## Phase 6: Notifications

- [ ] Register device tokens (FCM)
- [ ] Push: new offer from a followed store, claim about to expire

## Phase 7: Flutter apps

- [ ] One Flutter project with `customer` and `business` flavors
- [ ] Dart API client generated from Swagger (`/docs/json`)
- [ ] Customer app: home feed, map or nearby, offer details, claim + QR, my claims, followed stores, sign-in
- [ ] Business app: login, post offer (camera + compression), my products, my offers, QR scanner, stats

## Phase 8: Admin dashboard

- [ ] Flutter Web app sharing models and API client
- [ ] Store onboarding form, moderation, stats

## Phase 9: Production

- [ ] Dockerfile + `docker-compose.prod.yml` (API, Postgres, Caddy)
- [ ] Libyan Spider VPS: firewall, SSH keys only, automatic security updates, Docker
- [ ] Domain + automatic HTTPS (Caddy)
- [ ] GitHub Actions: push to `main` deploys
- [ ] Nightly backups (`pg_dump` + uploads folder) copied off the server with rclone, **and a tested restore**
- [ ] Uptime monitoring (UptimeRobot) and logs

## Phase 10: Launch

- [ ] Apple Developer ($99/yr) and Google Play ($25 once) accounts
- [ ] Store listings, privacy policy, terms
- [ ] Pilot with about 30 stores in Tripoli

## Later

- SMS OTP phone verification (Libyan SMS gateway)
- Surprise bags (end-of-day leftovers)
- Online payment (Libyan gateways)
- Web dashboard for store chains
- Paid plans for stores (featured offers, monthly plan)
