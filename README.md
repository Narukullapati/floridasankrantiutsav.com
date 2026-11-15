# Florida Sankranti Utsav (Angular)

Angular 19 rebuild of https://floridasankrantiutsav.com/ for https://dev.floridasankrantiutsav.com/.

Each page section lives in `src/app/sections/<name>` (header, hero, hero-mobile, about, activities, schedule, cta, scroll-top, whatsapp, footer). Images are in `public/images`.

## Develop

```bash
npm install
npm start          # http://localhost:4200
npm run build      # output in dist/floridasankrantiutsav/browser
```

### Volunteer registration API

The Volunteer section (`src/app/sections/volunteer`) posts to a Node.js/Express API in `api/` that stores registrations in MySQL. The disclaimer text and form options live in `disclaimer.json` and `volunteer-options.json` and are shared by both. Bump `version` in `disclaimer.json` whenever the disclaimer text changes.

```bash
cd api && npm install
DB_PASSWORD=... ADMIN_PASSWORD=... npm run dev   # http://localhost:3000, proxied from ng serve
npm test
```

Endpoints: `POST /api/volunteers`, `GET /api/health`, parent consent pages at `/api/volunteers/consent/:token`, and admin endpoints under `/api/admin` (login, volunteer list, delete, CSV export) protected by `ADMIN_USER`/`ADMIN_PASSWORD`. Student registrations email the parent/guardian a consent link when SMTP is configured.

Volunteers sign the disclaimer (typed name + drawn signature); students' parents/guardians sign on the consent page. Each registration gets a signed PDF (`api/src/pdf.js`) stored in MySQL (`consent_pdf`) at sign-up and regenerated when the parent/guardian signs; once consent is complete it is also emailed (when SMTP is configured) to the volunteer (and parent/guardian for students), BCC `CONSENT_PDF_BCC` (default `Suman.injeti@gmail.com`). Admins can view, download or re-send the PDF from the volunteer list/detail view (`GET /api/admin/volunteers/:id/consent.pdf`, `POST /api/admin/volunteers/:id/consent-email`).

## Deploy (VPS, Docker + Traefik)

```bash
docker compose up -d --build
```

Copy `.env.example` to `.env` and set the database and admin passwords first. Compose runs three containers: the Nginx site, the API, and MySQL (data in the `db-data` volume). Nginx proxies `/api/` to the API.

The site container serves the built site with Nginx on port 80; Traefik routes `dev.floridasankrantiutsav.com` to it with a Let's Encrypt certificate. To serve other hostnames, set `SITE_RULE` in a `.env` file to a Traefik rule such as ``Host(`example.com`) || Host(`www.example.com`)``.

## Admin portal

The same build serves a volunteer admin portal when the hostname starts with `admin.` (locally: `http://localhost:4200/admin`). Sign in with `ADMIN_USER`/`ADMIN_PASSWORD` to search and filter registrations, view details (disclaimer and parent-consent records), delete entries and download the CSV. Sessions are 8-hour HttpOnly cookies signed with `ADMIN_SESSION_SECRET`. Nginx only forwards `/api/admin/` on `admin.*` hosts; Traefik routes that host via `ADMIN_RULE`.
