# Clinic Booking

A web app for a medical clinic: patients book appointments online, doctors manage their schedule, and an admin manages the doctors.

**Live demo: https://clinic-booking-w0l4.onrender.com**

> Demo project with fake data. No medical information is stored.

## Try it

| Role | Email | Password |
|---|---|---|
| Patient | `john@example.com` | `password123` |
| Doctor | `maria@clinic.test` | `password123` |

You can also register your own patient account.

- The first page load can take about a minute: on Render's free plan the server sleeps after 15 minutes without visitors.
- The demo accounts are shared, so their password cannot be changed or reset. They use addresses that cannot receive mail, so no emails are sent to them.
- The admin account is not public.

## Screenshots

| | |
|---|---|
| ![Booking: free times for each day of the week](docs/screenshots/booking.png) | ![A patient's appointments](docs/screenshots/my-appointments.png) |
| **Booking:** free times for each day of the week | **Patient:** upcoming appointments and history |
| ![Doctor's day: appointments, free times and blocked time](docs/screenshots/doctor-schedule.png) | ![Weekly working hours](docs/screenshots/working-hours.png) |
| **Doctor:** the whole day, with free times and blocked time | **Doctor:** weekly working hours |
| ![Admin: doctors and invitations](docs/screenshots/admin-doctors.png) | ![The app on a phone](docs/screenshots/mobile.png) |
| **Admin:** doctors and invitations | **On a phone** |

## Features

**Patients**
- Register, log in, reset a forgotten password by email, change the password
- See a doctor's free times for each day of the week and book one
- See and cancel their own upcoming appointments
- Get an email reminder the day before, and an email if the clinic cancels

**Doctors**
- Join by email invitation and choose their own password (nobody else ever knows it)
- Set weekly working hours: several periods per day, one appointment length per day
- See their day with appointments, free times and blocked time
- Add phone bookings for patients without an account, and block time (e.g. a break)
- Search, filter and page through all their appointments; cancel any upcoming one

**Admin**
- Invite doctors, resend or cancel invitations, edit doctors' details
- Deactivate a doctor: they are logged out at once, their upcoming appointments are cancelled, online patients are emailed, and the admin gets a list of phone bookings to call
- See every appointment of the clinic with search, filters and pages; add phone bookings or block time for any doctor; cancel any upcoming appointment

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router |
| Backend | Node.js 24, Express 5, TypeScript (REST API, JSON) |
| Database | PostgreSQL on [Neon](https://neon.com), Prisma 7 (ORM and migrations) |
| Validation | Zod |
| Authentication | express-session with sessions stored in PostgreSQL (connect-pg-simple), bcrypt |
| Email | Brevo HTTP API online, Ethereal (fake inbox) locally |
| Tests | Vitest, Supertest |
| Hosting | Render (free plan, Frankfurt), cron-job.org for daily reminders |

## How it works

```
Browser (React)  ──fetch /api/...──▶  Express API  ──Prisma──▶  PostgreSQL (Neon)
       ▲                                   │
       └────────── JSON + session cookie ──┘
```

Online, Express also serves the built React app, so the page and the API share one domain and the session cookie needs no CORS. Locally, Vite serves the React app and forwards `/api` to Express.

Some decisions worth pointing out:

- **Free times are computed, never stored.** They come from the doctor's weekly hours, minus anything that overlaps an active appointment (online, phone or blocked time), minus times already past. If a doctor changes from 30- to 20-minute appointments, an existing 10:00–10:30 appointment still makes 10:20 unavailable.
- **The server never trusts the browser.** Every booking is checked again against the same calculation, and the appointment length comes from the working hours, never from the request.
- **No double bookings, even at the same moment.** Bookings for one doctor and one day wait for each other (a PostgreSQL advisory lock), so checking and saving happen as one step. A partial unique index (`doctor_id, date, time` where the appointment is active) is the last line of defence. A taken time answers `409`, and the page asks the patient to pick another.
- **Clinic time zone.** Render runs in UTC, so "now", "today" and "tomorrow" are always computed in Europe/Athens (`CLINIC_TIMEZONE`).
- **Deactivating a doctor while someone is booking.** Bookings hold the doctor's row while they run, so deactivation waits for them and cancels them too. No active appointment is ever left for a deactivated doctor.
- **The database enforces the rules too.** Foreign keys, and CHECK constraints such as "an online appointment has a patient, a phone booking has a name and phone, blocked time has neither".
- **Security**
  - Passwords are stored only as bcrypt hashes. Invitation and password-reset tokens are random, single-use and expire (48 hours / 1 hour); the database keeps only their SHA-256.
  - Sessions live in the database, so logging someone out everywhere (after a password reset, or when a doctor is deactivated) takes effect at once. The cookie is `HttpOnly`, `Secure` and `SameSite=Lax`.
  - "Forgot password" gives the same answer whether the email exists or not, and sends the email in the background, so the answer does not wait for it. A login with an unknown email still checks a dummy bcrypt hash, so it takes as long as a wrong password.
  - Rate limits on login, registration and forgot password. On Render, Cloudflare sits in front of the app, so the limits count per visitor using Cloudflare's `CF-Connecting-IP` header.
- **Email.** Render's free plan blocks SMTP, so emails go through Brevo's HTTP API. All sending is in one place (`server/src/services/email.ts`); changing service is one setting.
- **Reminders.** The free server sleeps, so a timer inside the app would not run reliably. Instead cron-job.org calls `POST /api/cron/reminders` (protected by a secret key) once a day. An appointment is marked as reminded before its email is sent, so two runs at once never email anyone twice.

## Project structure

```
clinic-booking/
├── client/                 React app
│   └── src/
│       ├── pages/          one component per page
│       ├── components/     shared UI
│       ├── api/            functions that call the backend
│       └── context/        who is logged in
├── server/                 Express API
│   ├── prisma/             schema, migrations, seed
│   ├── src/
│   │   ├── routes/         URL → controller, with login and role checks
│   │   ├── controllers/    one handler per endpoint
│   │   ├── services/       free slots, email, reminders, appointment lists…
│   │   ├── schemas/        Zod validation
│   │   └── middleware/     login, roles, rate limits
│   └── tests/              Vitest + Supertest
└── render.yaml             Render deployment (Blueprint)
```

## Running it locally

You need **Node.js 24** and a free [Neon](https://neon.com) project with a branch named `development`.

**1. Server**

```bash
cd server
npm install
cp .env.example .env      # then fill it in (see below)
npm run db:migrate        # creates the tables in the development branch
npm run db:seed           # first admin, plus demo data if SEED_DEMO_PASSWORD is set
npm run dev               # http://localhost:3000
```

**2. Client** (in a second terminal)

```bash
cd client
npm install
npm run dev               # open http://localhost:5173
```

**`server/.env`**

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string with pooling (host contains `-pooler`), used by the app |
| `DIRECT_URL` | Neon connection string without pooling, used by migrations |
| `SESSION_SECRET` | long random string that signs the session cookie |
| `CLINIC_TIMEZONE` | `Europe/Athens` |
| `APP_URL` | address of the app, for the links in emails (`http://localhost:5173` locally) |
| `EMAIL_PROVIDER` | `ethereal` locally, `brevo` online |
| `ETHEREAL_USER`, `ETHEREAL_PASS` | an inbox from [ethereal.email](https://ethereal.email) (optional; otherwise a temporary one) |
| `BREVO_API_KEY`, `EMAIL_FROM` | Brevo API key and a sender address verified in Brevo (online only) |
| `CRON_SECRET` | secret key for `/api/cron/reminders` |
| `CLIENT_IP_HEADER` | `cf-connecting-ip` on Render; empty locally |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | the first admin, created by the seed |
| `SEED_DEMO_PASSWORD` | password of the demo doctors and patients; leave empty for no demo data |
| `PROTECT_DEMO_ACCOUNTS` | `true` on the public demo: accounts with demo addresses (`example.com`, `*.test`…) cannot change or reset their password; empty locally |

Generate random secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Locally no email reaches anyone: they go to the Ethereal inbox, and the server prints a preview link for each one.

## Tests

The tests empty every table, so they use their own Neon branch.

1. In Neon, create a branch named `test`.
2. Create `server/.env.test` with that branch's `DATABASE_URL` and `DIRECT_URL` only. Everything else comes from `.env`.
3. Run:

```bash
cd server
npm test
```

The migrations are applied to the test branch first. The tests refuse to run if `.env.test` is missing or points to the same database as `.env`. No emails are sent: the tests read the links from an in-memory inbox.

They cover login and roles, passwords (reset links, logging out other sessions), invitations, booking (double bookings, simultaneous bookings, times outside the working hours, overlaps after the appointment length changes, phone bookings closing a time for online booking), who may see which free times, and the paginated appointment lists.

## Deployment

The app runs as one free Render web service in Frankfurt, described in [`render.yaml`](render.yaml).

1. In Neon, use a branch named `production`.
2. In Brevo, verify a sender address and create an API key. New Brevo accounts block API calls from unknown IP addresses: add Render's outbound IPs (Render → service → Connect → Outbound) under Security → Authorized IPs.
3. In Render, choose **New → Blueprint**, select the repository, and fill in the secrets it asks for. Render generates `SESSION_SECRET` and `CRON_SECRET`.
4. Each deploy builds the client and the server, applies the migrations and runs the seed (which only adds what is missing).
5. In [cron-job.org](https://cron-job.org), add two daily jobs (time zone Europe/Athens):
   - 17:58 `GET /api/health`, to wake the server up
   - 18:00 `POST /api/cron/reminders` with the header `Authorization: Bearer <CRON_SECRET>`

## API

All endpoints start with `/api` and answer JSON. Errors are `{ "error": "message" }`.

| Who | Endpoints |
|---|---|
| Anyone | `POST auth/register`, `auth/login`, `auth/logout`, `auth/forgot-password`, `auth/reset-password` · `GET auth/me` · `GET invitations/:token`, `POST invitations/:token/accept` |
| Logged in | `PATCH auth/password` · `GET doctors/:id/slots?date=` |
| Patient | `GET doctors` · `POST appointments` · `GET appointments/mine?view=upcoming|past` · `PATCH appointments/:id/cancel` |
| Doctor | `GET`/`PUT doctor/availability` · `GET doctor/appointments` · `POST doctor/appointments` · `PATCH doctor/appointments/:id/cancel` |
| Admin | `GET admin/doctors` · `GET admin/doctors/:id/upcoming-count` · `PATCH admin/doctors/:id` · `POST`/`GET admin/invitations` · `POST admin/invitations/:id/resend` · `DELETE admin/invitations/:id` · `GET`/`POST admin/appointments` · `PATCH admin/appointments/:id/cancel` |
| Cron | `POST cron/reminders` (secret key) |

The doctor's and admin's appointment lists take `page` (20 per page), `search` (patient name, email or phone), `status`, `kind`, `from`, `to`, and for the admin `doctor`. The patient's `appointments/mine` takes `view` (`upcoming`, or `past` for past and cancelled) and `page` (10 per page). All of them answer `{ items, page, pageSize, total }`.

## Not included yet

- Exceptions to the working hours (holidays, days off)
- Moving an appointment to another time
