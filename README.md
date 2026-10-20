# DeDiAl recovered projects

Recovered from the public deployments on 20 October 2026:

- `landing/`: DeDiAl Enterprises landing page, styles, scripts, imagery, animations and font.
- `platform/`: DeDiAl platform UI, styles, assets and readable JavaScript modules.
- `tools/dev.py`: newly implemented development server and local email authentication.
- `recovery-manifest.json`: original deployment URLs and SHA-256 hashes of the 43 recovered files before local adaptations.

## Run on your computer

Install Python 3.10 or newer. From this directory:

```sh
python3 tools/dev.py
```

On Windows, use `py tools/dev.py` if `python3` is unavailable. Both sites run together: open the landing page on port **4174** and the platform on port **4173** in your browser. The development server connects their navigation locally. No npm dependencies, API keys or external database are required to run them.

Create a **new local account** using the platform's Create account form. Accounts from the deployed website are not imported. Accounts and sessions persist in `.local/accounts.sqlite3`; passwords are salted and hashed using scrypt, and sessions use HttpOnly cookies. Bookings, requests, quotes, orders and businesses retain the recovered application's per-account browser storage. Keep that browser profile if you want those demonstration records to persist.

To explore business or operations screens, grant a role to an account you created locally:

```sh
python3 tools/dev.py --set-role your-email@example.com owner
# Or use operator to explore both business and admin screens:
python3 tools/dev.py --set-role your-email@example.com operator
```

Reload the platform afterward. Accounts default to `customer`; signup cannot assign privileged roles. This command only changes the local database.

Use `--landing-port` and `--platform-port` to change ports. The server binds to the local machine by default. Stop it with Ctrl+C.

## What was recovered and what was rebuilt

The deployed sites serve readable HTML, CSS and JavaScript, so these are recovered frontend files rather than a visual approximation. The landing page's 26 files and platform's 17 files include the referenced assets and imported browser modules. Original build tooling, Git history, server functions, database contents and private configuration were not exposed and were not recovered.

The deployed platform is an **interactive prototype**: business data lives in browser storage, supplier quotes are illustrative, payments are simulations and Lex uses predefined responses. Those behaviors are preserved. It does not provide a production tenant database, real payment processing, carrier tracking or live AI.

The frontend calls `/api/v1/auth/*`, and its OAuth error messages refer to Supabase. That server implementation was not publicly downloadable. `tools/dev.py` is a replacement for local development, with email signup/login/logout and session persistence. Google sign-in is explicitly unconfigured, and no production users, passwords or sessions were copied. The separate Vercel adapter supports Supabase email confirmation and optional Google OAuth. It needs a configured Supabase project and live validation; password recovery remains future work.

Local adaptations are limited to the replacement development backend, local navigation configuration served by that backend, and bundling the platform font from the recovered landing site instead of depending on an external font host. The downloaded `config.js` files retain production navigation when served without the development backend. The Python server remains for local development. A separate Vercel deployment configuration and Supabase authentication adapter are now included; see [DEPLOYMENT.md](DEPLOYMENT.md). The business workflows remain a demonstration, not a production multi-tenant backend.

## Validate changes

Python 3.10+ and Node 22+ (Node 24 recommended). Run `npm ci` first to install the locked workspace dependencies:

```sh
npm test
```

The tests cover authentication, cookies/session lifecycle, input validation, privilege assignment, cross-site request rejection, expiry and rate limiting, plus booking and procurement behavior.

Optional browser checks require npm development dependencies and Chromium:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

With an installed system Chromium, use `CHROMIUM_PATH=/path/to/chromium npm run test:browser`. On Windows, set `CHROMIUM_PATH` through your shell's environment syntax if needed. Set `PYTHON_BIN` if the browser test must use a Python command other than `python3` (for example `py`). The browser test starts and stops isolated test servers on ports 4273/4274 and uses a temporary database; the normal development servers do not need to be running.

Do not commit `.local/`, `.env` files, passwords, sessions or `node_modules/`. They are excluded from Git. See [DEPLOYMENT.md](DEPLOYMENT.md) for the two Vercel projects, required environment settings and the Supabase integration. No changes have been pushed to GitHub or deployed to Vercel.
