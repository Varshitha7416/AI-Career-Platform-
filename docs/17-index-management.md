# 17 — Controlled index management

## Why
Mongoose's default (`autoIndex: true`) builds every missing index of every registered model when the app (or any script that loads models) connects. Against a real database, the first connection would silently change its indexes. Found while preparing the Atlas rollout: even the migration script's dry run built an index.

## Startup behaviour (`server/config/dbOptions.js`, used by `config/db.js`)
| Target | Index auto-creation |
|---|---|
| Local MongoDB (`mongodb://` localhost / 127.0.0.1 / ::1) | **ON** (dev, demo and tests behave as before) |
| Atlas / any remote host / unparsable URI | **OFF** |
| `AUTO_INDEX=true` / `AUTO_INDEX=false` in the environment | overrides either default |

`autoCreate` (implicit empty-collection creation on connect) follows the same switch. The server logs the decision at startup (`Index auto-creation: ON|OFF (...)`). Collections are still created lazily on first write, and queries work without the new indexes (they are for speed and for the Referrals duplicate rule, see below).
`migrate:referrals` and `maintenance:orphan-saved-jobs` now connect with `autoIndex:false, autoCreate:false`, so they never build indexes as a side effect.

**Important:** the Referrals duplicate rule (one active request per sender + provider + job) is enforced by the unique partial index in addition to an application pre-check. While auto-creation is OFF and the index has not been created, the pre-check still blocks normal duplicates but two truly simultaneous identical requests could both succeed. Create the indexes before real use.

## The tool: `npm run indexes` (`server/scripts/manageIndexes.js`)
Dry run by default. Per model/collection it prints existing indexes, required indexes (from the schemas) and a status: OK, MISSING, CONFLICT (same keys/name with different options: reported, never touched), BLOCKED (a missing unique index whose data contains duplicates: counts and sample ids only), plus EXTRA (existing, unknown to the schema, untouched).
- `npm run indexes -- --only=Referral,Resume` limit to models
- `npm run indexes -- --apply` create only MISSING, unblocked indexes, then re-read and verify
- Never drops, rebuilds or modifies an index; never changes documents.
- Refuses `NODE_ENV=production`. A remote database needs `MAINTENANCE_ALLOW_REMOTE_DB=<exact db name>` even for the dry run (no db name in the URI = `test`), and `--apply` on remote additionally needs `--confirm-backup`.
- Index builds read the collection: run off-peak on large ones.
Tests: `INDEX_TEST_MONGO=mongodb://127.0.0.1:<port> npm run test:indexes` (disposable local mongod only).

## Indexes covered
Referral (3, incl. unique partial `seeker+referrer+jobKey` where `active:true`), SavedJob and Application (unique `user+job`), Resume (1), ResumeAnalysis (3), CoverLetter (3), plus Job, Company, Interview, Notification, Program, ProgramEnrollment and User (unique email).

## Suggested rollout for an existing database
1. Backup/snapshot. 2. `npm run indexes` (dry run; review MISSING / BLOCKED / CONFLICT). 3. Resolve any BLOCKED duplicates manually. 4. `npm run indexes -- --apply --confirm-backup`. 5. Re-run the dry run: expect no MISSING. Rollback: indexes are additive; drop a newly created index by name if needed (the old app does not depend on them).
