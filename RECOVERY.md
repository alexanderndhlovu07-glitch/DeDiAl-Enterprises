# Recovery record

Sources: https://dedial-enterprises.vercel.app/ and https://dedial-platform.vercel.app/.

The sites became accessible from the cloud environment after the domain allowances were applied. Public resources were downloaded with normal verified HTTPS requests. No credentials, authenticated accounts or private endpoints were used to obtain application source.

The platform's public session/configuration endpoints were checked read-only: session returned an anonymous user, and configuration advertised a server-managed Google OAuth start endpoint. These checks reveal the frontend API contract; they do not recover its implementation.

`recovery-manifest.json` records the 43 downloaded frontend files, original URLs, byte sizes and original SHA-256 digests. `platform/src/styles.css` is subsequently adapted to use `platform/public/assets/BDOGrotesk-VF.ttf`, copied from the landing site's recovered font. The other recovered files remain byte-for-byte as recorded. Tools, tests, documentation, package metadata and the copied platform font are newly added.

Browser-generated image paths in JavaScript templates resolve against the document URL, not the script URL. All referenced platform images, including the dynamically selected category cover images, were downloaded from their correct public paths. Initial probes of script-relative candidate URLs that returned 404 were discarded; they are not required application resources.

The replacement authentication backend has no connection to the live service. All browser validation creates only isolated local test accounts and records. Live payment, messaging, business registration and identity-provider actions were not performed.

The recovered prototype's records are stored in localStorage; separation by account is a UI convenience, not production server-enforced tenancy. Business/admin role gates are preserved frontend behavior. The development backend enforces account identity and role assignment, but does not add production booking/business/payment APIs. A full enterprise backend is a separate implementation project.

## Deployment integration added after recovery

The follow-up development task adds workspace manifests, Vercel configurations, shared static builds, a Supabase authentication adapter, deployment tests and CI configuration. These are newly written additions. The recovered browser application remains unchanged; the existing documented font adaptation still applies. See DEPLOYMENT.md for required settings and the limits of the prototype.
