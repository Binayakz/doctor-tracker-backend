# Doctor Tracker API

Doctor Tracker is a secure administrative app for managing doctors, their patients, and basic operational trends. This repository contains the standalone Node.js/Express REST API; the separate Next.js frontend communicates with it over versioned JSON endpoints.

## Setup

### Requirements

- Node.js 20 or later and npm
- MongoDB. MongoDB Atlas M0 is a free shared cluster with provider limits; it is not included in this repository.

### Local installation

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to your MongoDB connection string, `JWT_SECRET` to a unique random value of at least 32 bytes, and configure `CLIENT_ORIGIN` for the frontend. Set a strong `ADMIN_PASSWORD` (at least 12 characters) and `ADMIN_EMAIL` if using the optional bootstrap admin.
3. Install packages and start the API:

   ```sh
   npm install
   npm run dev
   ```

4. Check `http://localhost:4000/health`. With `SEED_ADMIN=true`, startup creates the configured administrator only if the email does not already exist. Keep `.env` private and never commit credentials.

The checked-in `.env.example` contains all supported settings. `AUTO_CREATE_INDEXES` defaults to enabled outside production. In production, set `NODE_ENV=production`, `COOKIE_SECURE=true`, a strong secret, and an exact HTTPS frontend origin. If the frontend and API are on different sites (for example, separate default Vercel and Render hostnames), also set `COOKIE_SAME_SITE=none`; same-site deployments can retain `lax`. A free app host and MongoDB Atlas M0 can support a demo, subject to provider limits, cold starts, and current plan availability.

## Architecture

The Next.js client sends credentialed JSON requests to Express under `/api/v1`. Express applies security headers, compression, CORS, request-size limits, validation, login throttling, CSRF origin checks for cookie-authenticated writes, and authentication. Mongoose connects to MongoDB. Admin passwords are bcrypt hashes; a signed JWT is held in an HTTP-only, same-site cookie scoped to `/api/v1`. Protected routes also accept bearer tokens. Doctor and patient endpoints use bounded pagination, deterministic date sorting, indexes for common filters, and MongoDB text indexes for search. Dashboard aggregation is performed in MongoDB and returns bounded summaries.

```text
Next.js client ── HTTPS/JSON + HttpOnly session cookie ──> Express REST API ──> MongoDB
```

## Technical decisions

1. **Separate Express service.** The assignment asks for a standalone Node/Express server and a separate Next.js client. Keeping the API independent gives the client a stable REST contract and keeps database credentials out of the browser bundle.
2. **MongoDB aggregation and bounded pagination.** Totals and daily activity are aggregated in MongoDB; list endpoints use indexed filters, deterministic sorting, count queries, and a maximum page size of 100. Dashboard time series cover the most recent 30 UTC dates and fill days with zero activity. The per-doctor summary considers all doctors and returns the ten highest counts, including zero counts when those doctors fall within the result limit.

## API

Base URL: `http://localhost:4000/api/v1`. Success responses use `{ "success": true, "data": ... }`; errors contain a safe message, and validation errors include field details. All endpoints other than login, logout, and health require an authenticated admin.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check (outside `/api/v1`) |
| POST | `/auth/login` | Sign in with `{ "email", "password" }`; sets HTTP-only session cookie |
| POST | `/auth/logout` | Clear session cookie |
| GET | `/auth/me` | Current admin profile |
| GET | `/dashboard` | Totals, up to ten doctors by patient count, and 30 UTC dates of new record counts |
| GET | `/doctors?page=1&limit=10&search=&specialization=&from=YYYY-MM-DD&to=YYYY-MM-DD` | Search, filter, and paginate doctors |
| GET | `/doctors/filters` | Available doctor specializations |
| POST | `/doctors` | Create doctor: `name`, `specialization`, `hospital`, `phone`, `email` |
| GET | `/doctors/:id` | Doctor details |
| GET | `/doctors/:id/patients?page=1&limit=10&search=&condition=&from=&to=` | Paginated patient list for a doctor |
| POST | `/doctors/:id/patients` | Add patient: `name`, `age`, `gender`, `condition`, optional `phone`, `email` |
| GET | `/patients?page=1&limit=10&search=&condition=&doctorId=&from=&to=` | Search, filter, and paginate all patients |
| GET | `/patients/filters` | Available patient conditions |
| PATCH | `/patients/:id` | Update provided patient fields |
| DELETE | `/patients/:id` | Delete patient |

### Request and response examples

Login request:

```http
POST /api/v1/auth/login
Content-Type: application/json

{"email":"admin@example.com","password":"a-strong-password"}
```

Example login response (the session token is set in the `Set-Cookie` header and is not returned in JSON):

```json
{"success":true,"data":{"admin":{"id":"665f...","name":"Portal Administrator","email":"admin@example.com"}}}
```

Create doctor request (send the session cookie and an allowed `Origin` header):

```http
POST /api/v1/doctors
Content-Type: application/json
Origin: http://localhost:3000
Cookie: doctor_tracker_token=<browser-managed-session>

{"name":"Jordan Lee","specialization":"Cardiology","hospital":"City Hospital","phone":"+15551234567","email":"jordan@example.com"}
```

Example paginated list response (doctor list results include a per-doctor `patientCount`):

```json
{"success":true,"data":{"doctors":[{"_id":"665f...","name":"Jordan Lee","specialization":"Cardiology","hospital":"City Hospital","phone":"+15551234567","email":"jordan@example.com","patientCount":4}]},"pagination":{"page":1,"limit":10,"total":1,"pages":1}}
```

Date filters are inclusive UTC calendar dates and apply to `createdAt`. `from` and `to` must be real `YYYY-MM-DD` dates, and `to` cannot precede `from`. Search is a MongoDB text search over indexed name and relevant text fields; it matches words/phrases rather than arbitrary substrings and is limited to 100 characters. Page size is limited to 100; responses include `{ page, limit, total, pages }` pagination metadata.

### Operational behavior

- Login is limited to 10 attempts per 15 minutes per source IP. Set `TRUST_PROXY` only when running behind a known proxy; use a hop count or comma-separated trusted proxy addresses so rate limiting sees the client IP correctly.
- Unsafe requests carrying the session cookie require an `Origin` exactly matching one of the comma-separated `CLIENT_ORIGIN` values. Cookie-authenticated browser writes without an Origin are rejected. Bearer-token API clients do not use the cookie CSRF check.
- All `/api/v1` responses use `Cache-Control: no-store`. JSON request bodies are limited to 20 KB. Malformed JSON, oversized payloads, invalid query parameters, and duplicate emails return client errors rather than server stack traces.
- JWT lifetime is controlled by `JWT_EXPIRES_IN` (seconds, minutes, hours, or days; 60 seconds to 30 days). The cookie lifetime matches the JWT. Logout clears the browser cookie; because tokens are stateless, a copied token remains valid until expiry.
- `/health` is a liveness check. Startup validates required security configuration and database connectivity before listening. SIGINT/SIGTERM stops accepting connections, closes MongoDB, and has a 10-second forced-shutdown fallback.

## Index management

Indexes are declared on the Mongoose schemas. For local development, startup creates declared indexes unless `AUTO_CREATE_INDEXES=false`. Production startup does not create indexes by default. Before a production release, run the deliberate index step against the target database:

```sh
npm run db:indexes
```

The script creates missing schema indexes and does not drop existing indexes. Review index changes and database query plans before rollout; remove obsolete indexes through an explicit migration after checking their use. The indexes cover unique email lookups, text search, doctor/condition filters, and deterministic `createdAt` sorting.

## Security and data handling

- Admin accounts are bootstrapped from environment variables; there is no public registration route.
- Keep secrets out of frontend variables with a public prefix.
- Patient data is sensitive. Use HTTPS, least-privilege database credentials, restricted database network access, and synthetic data for demos. This starter is not a compliance certification.
- Credentialed CORS does not allow wildcard origins. `COOKIE_SAME_SITE` defaults to `lax`; when frontend and API use different sites, set `COOKIE_SAME_SITE=none` together with `COOKIE_SECURE=true` so browsers send the session cookie on cross-site API requests. Keep `CLIENT_ORIGIN` set to the exact frontend origin and retain origin protection.

## Frontend integration

Set the frontend API base URL to the API origin and send credentials (`credentials: 'include'` with fetch or `withCredentials: true` with Axios). Call `/auth/me` during app initialization. For browser writes, the frontend must send its matching `Origin` (browsers do this automatically); the API verifies that it is in `CLIENT_ORIGIN`.

## Validation

Run the dependency-free checks and unit tests with:

```sh
npm run check
npm test
```

The committed `node:test` suite covers pagination and UTC date utilities. The API integration test runs only when `TEST_MONGODB_URI` points to a disposable database whose name ends in `_test`; it creates and deletes its own uniquely named records and verifies authentication, origin checks, CRUD, filtering, analytics, validation, and cache headers. With local MongoDB running on its default port, run it with:

```sh
TEST_MONGODB_URI='mongodb://127.0.0.1:27017/doctor_tracker_test' npm test
```

The integration test uses `doctor_tracker_test` and does not modify the application's configured database.

No paid API or AI service is used.
