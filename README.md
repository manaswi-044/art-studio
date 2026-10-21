# Art Studio

Art Studio is a vanilla HTML/CSS/JavaScript frontend backed by Node.js,
Express, SQLite (`better-sqlite3`), and session-based authentication.

## Local development

From the project directory:

```powershell
npm install
npm start
```

Open <http://localhost:3000>. The default local database path is
`data/art-studio.db`, and the default seed path is `data/seed.json`.

Optional local environment variables can be placed in a `.env` file:

```text
PORT=3000
SESSION_SECRET=replace-this-for-local-development
DATABASE_PATH=.\data\art-studio.db
SEED_PATH=.\data\seed.json
```

`.env`, the SQLite database, and `seed.json` are ignored by Git. Do not commit
credentials or private seed data.

## Deploying the full app on Render

Create a **Web Service** from the repository. Use these settings:

- **Root Directory:** the application directory containing `package.json`,
  `public`, `src`, and `data`
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Plan:** a paid Render plan that supports persistent disks

The application writes its SQLite database to `DATABASE_PATH`. Add a Render
persistent disk and mount it at `/var/data`, then set:

```text
NODE_ENV=production
SESSION_SECRET=<long-random-production-secret>
DATABASE_PATH=/var/data/art-studio.db
SEED_PATH=/etc/secrets/seed.json
```

`SESSION_SECRET` is required for production. The server does not use the local
fallback when `NODE_ENV=production`. Render's HTTPS proxy is trusted in
production, so the session cookie is `Secure` over HTTPS while remaining
usable over HTTP during local development.

### Seed data on Render

The repository intentionally does not contain `data/seed.json`, because it
includes the studio account credentials. Add the exact existing seed file as a
Render Secret File at:

```text
/etc/secrets/seed.json
```

Do not paste the seed contents into a public repository. On first startup,
the app creates the database at `/var/data/art-studio.db` and inserts seed
records only when they do not already exist. It does not reset or overwrite
an existing database.

### Persistent storage requirement

The default Render filesystem is ephemeral. Without a persistent disk, the
SQLite database can be lost on deploy or restart, which would lose accounts,
purchases, bookings, and pottery requests. Persistent disks are available on
paid Render web-service plans; attach one before the first production start.
Only the mounted directory should be used for the writable database.

The current session implementation uses Express's in-memory session store.
It works for a single Render instance but sessions are cleared when the
service restarts. If the app is later scaled to multiple instances, use a
shared session store before scaling.

## Pre-push checks

```powershell
npm install
node --check .\src\server.js
node --check .\src\database.js
node --check .\src\auth.js
npm start
```

While the server is running, check:

```powershell
Invoke-WebRequest http://localhost:3000/api/health
Invoke-WebRequest http://localhost:3000/api/paintings
```

## Post-deployment checklist

1. Open the public Render URL and confirm the welcome page loads.
2. Register a customer account, log in, and confirm navigation to `home.html`.
3. Confirm paintings, prices, availability, and purchase/cancellation behavior.
4. Submit and cancel a wall-painting booking.
5. Submit, edit, and cancel a pottery request.
6. Log in with the studio account from the private seed file and test accept,
   decline, and status workflows.
7. Log out and confirm protected pages/API requests require authentication.
8. Restart or redeploy only after confirming the persistent disk is mounted
   and the database remains present.