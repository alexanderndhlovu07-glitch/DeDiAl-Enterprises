# Validation — 20 October 2026

- Python 3.12.14, Node 24.19.0, system Chromium.
- `npm ci --cache /workspace/.cache/npm --no-audit --no-fund`: passed.
- `npm test`: 8 Python authentication integration tests and 3 Node domain workflow tests passed.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`: passed using temporary accounts and a temporary SQLite database. Covered desktop/mobile landing interactions, local navigation, signup/login/logout, booking/cancellation, sourcing/quote approval/payment simulation, Lex guidance, role gates, business/admin screens, persistence and separate account activity. No failed resources or browser exceptions during the suite.
- Live development-server requests: both pages, both local config routes and the anonymous session API passed.
- Recovery integrity: 42 downloaded files match their original SHA-256 digests; the remaining stylesheet has the documented local font-path change.

No production identity-provider integration, live payment, real AI, production database recovery, GitHub push, Vercel deployment, cloud publication or restoration in a fresh cloud task was performed.

## Deployment preparation validation

- Locked workspace installation via `npm ci`: passed.
- `npm test`: 8 Python tests and 21 Node tests passed (29 total). Node coverage includes deployment builds and the Supabase function, including actual SDK cookie persistence and session refresh against a simulated provider.
- Both static deployment builds passed with explicit production navigation URLs.
- Local Vercel Node builder 25.0.0, using already installed dependencies, packaged the authentication function into a 72-file Lambda artifact with the server adapter and Supabase dependencies. No local database or environment files were included. This is a local packaging check, not a remote Vercel deployment.
- The browser journeys passed again against the running local implementation.
- GitHub Actions workflow added; not yet run on GitHub.
- Live Supabase settings are absent from this machine. Live email confirmation, Google OAuth and the deployed provider connection remain unverified.
