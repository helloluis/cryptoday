# Cryptoday — STURDY

Public news/digest application at https://news.cryptoday.live with harvesting, publication and payment-related routes. Test/verify and obtain explicit confirmation for user-visible deployment. Follow [/home/b11/code/AGENTS.md](/home/b11/code/AGENTS.md).

## Add a feature
- Use Next.js App Router in `src/app/`, harvest/digest/provider logic in `src/lib/`, Prisma schema in `prisma/`, and mirror jobs in `src/scripts/`.
- Keep provider responses, source attribution and publication state distinct. Mirror operations must retain the existing incremental/cost-control behavior.
- Preserve the pre-existing edit in `src/lib/logo-finder.ts`.

## Fix and verify
- Run `npm ci` (postinstall runs Prisma generation), `npm run test:mirror`, and `npm run build` (prebuild runs `build:mirror`).
- No general test/lint script exists. `npm run harvest` and `npm run db:push` are operational mutations, not validation commands.
- Inspect the JSON checks at `/api/health`: unhealthy checks can still return HTTP 200. Use isolated DB/config for tests; inspect side effects before running scripts.

## Deploy and roll back
- Use `sudo ssh b11-apps`; code is `/var/www/cryptoday`, service `ovh-cryptoday.service`. Read `/home/b11/PRODUCTION-ACCESS.md`.
- Preflight: `sudo ssh b11-apps 'systemctl show ovh-cryptoday.service -p WorkingDirectory -p ExecStart -p ActiveState'`.
- `/usr/local/libexec/ovh-cryptoday-runtime` validates captured runtime configuration and Node/npm hashes. Stage a checked build on a compatible platform, preserve prior code/build and matching runtime inputs, and validate the launcher before a targeted activation/restart.
- Keep PostgreSQL, production environment and harvest state. Schema changes need an application-consistent backup and a compatible migration/rollback plan.
- Separate mirror job: `deploy/cryptoday-neon-mirror.service` and `.timer` invoke `scripts/mirror-to-neon.sh`; do not run concurrent copies or restart the timer to verify a web release.
- Verify release/build hashes, public pages and health check contents. Restore prior code/build/runtime inputs for rollback without replacing newer articles/data.

## Pitfalls
- **Dangerous stale CI:** `.github/workflows/deploy.yml` auto-deploys pushes to main to the retired Vultr address and runs `prisma db push --accept-data-loss`, then PM2. Treat a main push as a potential production/destructive action. Do not trigger it until its owner has corrected/disabled that path.
- `CLAUDE.md` still describes the old host/process manager. The current OVH systemd service is authoritative.
- The mirror timer's oneshot service being inactive between runs is normal; inspect timer and last result.
- No complete safe OVH release script is present; do not substitute the old workflow or bypass startup guards.

Inspected 2026-10-27; mirror shell syntax passed.
