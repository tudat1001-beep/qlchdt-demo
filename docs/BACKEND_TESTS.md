# T-01 backend verification

Verified 2026-11-01 against local PostgreSQL on port 55439 with Vitest 5.0.5, the installed Fastify 5 stack and @fastify/static 10.1.8. Dependencies/package/lock files remain SOL-owned. No UI or root configuration changes are included.

## Commands and results

- `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` - exit 0, server/shared/test types clean.
- `node node_modules/vitest/vitest.mjs run server/foundation.test.ts` - exit 0, **21 tests passed**, 1 file, 6.18 s at 09:59:03 Asia/Saigon. This final run used the updated least-privilege database connection from ignored `.env` and the explicit 128 MiB scrypt configuration.

Tests require `TEST_DATABASE_URL` naming a database ending `_test`. Both the URL database and PostgreSQL `current_database()` are checked before schema creation. Each suite run owns a random schema; all fixtures and cleanup remain inside it. Tests neither migrate nor delete real `qlchdt` data, and do not truncate the public test schema.

## Coverage and observed behavior

- Repeated/concurrent migration runners apply once and preserve the manager; checksum drift fails. Database constraints reject negative/unsafe VND, a second manager, and audit deletion.
- Bootstrap uses salted scrypt N=131072/r=8/p=1; repeat bootstrap keeps the existing credentials. Session cookies are HttpOnly, SameSite Strict, 12-hour expiry, Secure for HTTPS production. Only hashes persist in sessions.
- Public health works; all catalog/party/me APIs reject anonymous access. Forged and expired sessions fail. Logout revokes the database session and clears its cookie.
- Missing/hostile Origin fails on login and authenticated POST/PATCH/logout. Correct Origin permits requests. Invalid credentials give the same public error; the sixth login attempt in the configured window returns 429.
- Products support create/search/update, duplicate SKU returns 409, immutable identifiers/unknown fields/invalid IDs/missing keys return 400, missing records return 404. Invalid VND fractions, negatives, strings and unsafe integers fail; maximum safe VND survives JSON serialization as a number.
- Device reads join product descriptions and preserve numeric money; available devices count toward product stock. Invalid status fails validation.
- Customers/suppliers support create/search/update/detail, preserving omitted fields and returning the approved zero-debt/empty-history foundation. Blank names and missing records fail.
- Six simultaneous identical product writes, including uppercase/lowercase UUID keys, create exactly one row and one audit record. Reordered JSON keys replay the same response. Changed content or operation returns 409. PATCH retries create only one update audit.
- Forced failure rolls back party, audit and idempotency together; retry succeeds. The transaction pool remains usable afterward.
- A temporary built dist fixture serves assets and SPA routes. Missing API routes stay JSON 404, missing assets stay 404, API responses have no-store, index/service worker use no-cache.

## Deliberate limits

T-02/T-03 transaction modules, full-app UI/build/E2E and deployed HTTPS were not tested here. The production serving behavior is verified with a built-file fixture, not a frontend build. Rate limits are held in one server process; a multi-process deployment needs a shared limiter. Session/key history is not automatically pruned beyond expired-session cleanup during successful login. No user data, fake inventory or fake transactions were inserted into the real database.

## T-02 inventory checkpoint

- `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` - exit 0.
- `node node_modules/vitest/vitest.mjs run server/foundation.test.ts server/transactions.test.ts` - exit 0, **28/28 passed**, 2 files, 8.41 seconds at 10:05:15 Asia/Saigon on 2026-11-01.
- Seven new PostgreSQL inventory tests verify repeated product cost lines, device metadata, exact 10-dong extra allocation across seven units, two-lot splitting, linked cash/bank payments and derived supplier debt/history, stock counts and reads, duplicate existing/global request IMEIs, malformed/kind/quantity/array limits, MAX_SAFE overflow and exact-boundary success, five simultaneous same-key purchases and payload conflict, forced cash-trigger failure after stock writes with complete rollback and clean retry, plus direct SQL source/ledger constraints.
- Both suites own random schemas only after URL/current_database `_test` guards; cleanup drops only confirmed-owned schemas. Earlier T-01 one-migration assertions now cover both versions and checksum drift targets a single version.

Sales/FIFO consumption and collections remain for the second T-02 commit; no reversals/warranty/report work is included in this checkpoint.

## T-02 final sales/FIFO/collections verification

Verified 2026-11-01 on the same dedicated local PostgreSQL `_test` database, with a random owned schema per suite; no real inventory or customer data was written or reset.

- `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` - exit 0.
- `node node_modules/vitest/vitest.mjs run server/transactions.test.ts` - exit 0, **21/21 passed**, 4.06 seconds at 10:47:52 Asia/Saigon.
- `node node_modules/vitest/vitest.mjs run server/foundation.test.ts server/transactions.test.ts tests/money.test.ts` - exit 0, **45/45 passed**, 3 files, 12.15 seconds at 10:48:16 Asia/Saigon (21 foundation, 21 transaction, 3 money tests).
- `git diff --check` - exit 0 before final documentation/commit.

The transaction suite includes the seven inventory tests above plus fourteen sales/collection cases: FIFO across different-cost lots; immutable customer/product/price snapshots after edits; mixed cash/bank and derived debt/history; duplicate accessory/device lines and distinct same-model devices; oversells, device-product mismatches and unavailable device states; different-key parallel sales of the last accessory and same IMEI with exactly one success; parallel same-key sales and payload conflicts; debt without customer, overpayment and invalid input; exact whole-dong discount allocation; zero-price sales; multiplication, aggregate gross/payment/cost overflow and exact MAX_SAFE boundary; PostgreSQL append-only guards; parallel customer and supplier collections without overpayment; same-key collection replay and conflicts.

Forced failures at both sale cash insertion and final audit insertion leave all sale, line, allocation, stock movement, payment, cash, audit and idempotency counts unchanged; devices remain available and lot quantities unchanged, and retrying the same key succeeds. An initial test expected proportional remainder allocation [1,1] for gross [3,2] and discount 2; the documented first-line remainder rule correctly yields [2,0], with net [1,2] and invoice total 3. SOL confirmed the rule and additional detail fields through Orca ask before final verification.

No frontend build, browser/E2E, production database migration or T-03 reversal/warranty/report behavior was checked in this worker task. T-03 must update debt/payment validation for linked reversal reductions; current T-02 only posts purchases, sales and their payments.
