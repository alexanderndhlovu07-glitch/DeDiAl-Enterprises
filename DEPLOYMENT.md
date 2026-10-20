# Deploy the recovered sites to Vercel

This change prepares two Vercel projects from one repository. The landing page is static. The platform combines static files with a Node.js authentication function backed by Supabase. The Python development database is never deployed.

## Vercel projects

Connect this repository to each Vercel project and use these settings:

| Setting | Landing project | Platform project |
| --- | --- | --- |
| Root Directory | `landing` | `platform` |
| Framework Preset | Other | Other |
| Node.js Version | 24.x | 24.x |
| Build Command | `npm run build` | `npm run build` |
| Output Directory | `dist` | `dist` |
| Install Command | default npm workspace installation | default npm workspace installation |

Enable **Include source files outside of the Root Directory in the Build Step** for both projects: they use the repository's shared `tools/build-site.mjs` and root workspace lockfile. Commit the complete repository, including `package-lock.json` and both workspace manifests. Dependencies are installed at the workspace root. Do not deploy only the `dist` directory for the platform: Vercel also needs its `api` function and dependencies.

The checked-in `vercel.json` files define the output directories and response headers. All public frontend files are copied explicitly to `dist`; server code and `.env` files are excluded. `/api/v1/auth/*` is handled by `platform/api/v1/auth/[...path].js`. The hash-based frontend routes need no SPA catch-all rewrite, so they do not intercept API requests.

## Required environment settings

Set values in **Vercel → Project → Settings → Environment Variables**. Do not paste credentials into source files or chat. `.env.example` files show the names only; they are not automatically loaded by the standalone build script.

Landing:

- `PLATFORM_URL`: the platform's HTTPS origin, e.g. `https://dedial-platform.vercel.app`.

Platform:

- `LANDING_URL`: the landing site's HTTPS origin.
- `APP_ORIGIN`: this platform deployment's exact HTTPS origin. It is the trusted origin for sign-in POSTs and the fixed OAuth callback destination.
- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_ANON_KEY`: the project's anon/publishable API key. Do **not** use a service-role or secret key.
- `ENABLE_GOOGLE_AUTH`: `false` initially; use `true` only after configuring Google below.

Use separate values for Preview and Production. `APP_ORIGIN` must match the actual browser origin, including the hostname. A stable preview domain makes this straightforward; after changing it, update the Supabase redirect allowlist and redeploy. Navigation URLs must be HTTPS site origins without paths, credentials, queries or fragments. The build fails when its navigation setting is absent or unsafe.

## Supabase authentication

Use a Supabase project you control. Enable email authentication. Configure its Site URL to match `APP_ORIGIN` and add this exact URL to the allowed redirects:

```text
https://YOUR_PLATFORM_HOST/api/v1/auth/callback
```

Keep provider rate limiting enabled. With email confirmation enabled, signup shows the recovered Check your email message; the confirmation link returns through the PKCE callback. Accounts from the previous deployment will be available only if this connects to the same Supabase project. A fresh Supabase project starts with no users.

To enable Google, configure the Google provider in Supabase using its documented provider redirect URI, allow the application's callback URL above, and set `ENABLE_GOOGLE_AUTH=true` in Vercel. The server starts Google OAuth through Supabase; it does not require Google credentials in the browser. The callback exchanges the authorization code using an HttpOnly PKCE cookie. Session cookies are Secure, HttpOnly, SameSite=Lax, and excluded from caches. Each request creates a separate Supabase client; refreshed/chunked cookies are returned to the browser.

Roles default to `customer`. Business access requires `owner` or `operator`; admin access requires `operator`. They are read from verified Supabase `app_metadata.role`, which must be assigned through a trusted admin process using the Supabase Admin API. User-editable `user_metadata` cannot grant privileges. These are frontend screen gates for the recovered demo; each future business/data API must independently enforce tenant membership and authorization on the server.

## Validate before publishing

The included GitHub Actions workflow runs the tests, browser journeys and both builds on pushes to `main` and pull requests. It uses only isolated fixtures, so no Supabase credentials are needed in CI. It has not been run on GitHub yet.

From the repository root, install locked dependencies and run the checks:

```sh
npm ci
npm test
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

Build with navigation settings explicitly exported by your shell or CI environment:

```sh
PLATFORM_URL=https://dedial-platform.vercel.app LANDING_URL=https://dedial-enterprises.vercel.app npm run build
```

These examples use POSIX shell syntax; on Windows, set the same variables using your shell's environment commands. The Node build script does not read `.env` files. The runtime authentication settings are required by Vercel functions, rather than embedded in static output.

Local browser tests continue to use the independent Python/SQLite development backend. Authentication-function tests use both provider-contract fixtures and the real Supabase SDK against a simulated provider. They do not establish connectivity to a live Supabase project.

After the Preview deployment is configured, check signup, email confirmation, login, session refresh, logout and—if enabled—Google sign-in on its real HTTPS origin. Confirm responses never contain tokens and cookies have HttpOnly/Secure attributes. Also check the link between the two deployed sites. Review that concrete preview before promoting it to Production.

## Remaining product work

The recovered platform still stores demonstration booking, procurement and business records in per-account browser localStorage. It has no production tenant database, reservation locking, real payment processing, carrier tracking, or live AI. This deployment integration adds persistent identity; it does not turn those demonstrations into production services. Build server-side tenant membership and data APIs with row-level security before using real customer/business records or accepting money.

No GitHub push, Vercel deployment or live Supabase configuration is performed by the build commands. A deployment requires the user's project access and settings.
