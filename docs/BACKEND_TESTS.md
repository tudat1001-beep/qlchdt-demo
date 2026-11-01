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

## T-03a final sale return/cancellation verification

Verified 2026-11-01 on PostgreSQL in dedicated `_test` schemas only, after SOL approval of T-02 and the reversal read fields. Each suite checks the configured URL and actual current_database before schema creation; cleanup touches only its confirmed-owned random schema.

- `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` - exit 0.
- `node node_modules/vitest/vitest.mjs run server/transactions.test.ts` - exit 0, **35/35 passed**, 5.36 seconds at 10:54:10 Asia/Saigon; fourteen new return/cancel cases.
- `node node_modules/vitest/vitest.mjs run server/foundation.test.ts server/transactions.test.ts tests/money.test.ts` - exit 0, **59/59 passed**, 3 files, 12.50 seconds at 10:55:09 Asia/Saigon (21 foundation, 35 transaction, 3 money tests), after strengthening the old-phone-sale guard test.
- `git diff --check` - exit 0 before final documentation/commit.

New PostgreSQL evidence covers:

- Discounted three-unit returns of 1+1+1 produce values [1,2,2] and the same total refund/cost as one full return; MAX_SAFE refund and zero-price quantity-derived statuses preserve exact values.
- Partial returns restore original FIFO lots across different costs in original allocation order, and subsequent resale reuses the original lot IDs and purchase provenance.
- Phone sold-return-resold-return history preserves original cost/source and all five stock movements; returning a phone from an old sale with other lines still outstanding fails after the phone has been resold. Quarantine blocks another sale and available stock count excludes that phone.
- Concurrent different-key returns of one phone and the last accessory each have exactly one success, one reversal and one stock restoration. A collection/return race yields either valid serialized outcome, with net receipts plus remaining debt equal to remaining net invoice value.
- Mixed original cash/bank receipts first reduce debt without fake payments or cash movements, then refund only paid value in the selected method. Later collections and direct SQL overpayment attempts fail.
- Forced cash or audit failure after stock changes restores all sale/return/line/allocation/stock/payment/cash/audit/idempotency counts, phone status and lot quantity; same-key retry succeeds.
- Parallel same-key returns create one refund; changed payload conflicts. Partial-return cancellation reverses only the remaining quantity/value/cost; retries replay, another cancellation/return fails, and stored original sale data remains unchanged.
- Invalid ownership, duplicate lines, missing keys, invalid quantities/enums/reasons fail without writes; database guards reject return history changes and cumulative line/allocation overrun. Foundation tests now cover four repeatable migrations and unauthenticated/hostile-origin return/cancel requests.

No runtime database migration, frontend/browser/E2E, supplier return, warranty, cash/report module or shared money edit was performed. Those modules remain for separately dispatched work; SOL still needs independent review and integration verification before applying migration 004 to the runtime database.

## T-03b supplier return and warranty verification

Verified 2026-11-01 against PostgreSQL using dedicated `_test` database schemas. Each suite checks the URL and `current_database()` before schema creation and drops only its own random schema.

- `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` - exit 0.
- `node node_modules/vitest/vitest.mjs run server/foundation.test.ts server/transactions.test.ts tests/money.test.ts` - exit 0, **69/69 passed**, 3 files, 13.99 seconds at 13:08:37 Asia/Saigon; this migrates a fresh owned schema through 005 and rechecks route auth/origin boundaries.
- `npm test` - exit 0, **76/76 passed**, 4 files, 13.47 seconds at 13:09:24 Asia/Saigon, including the UI idempotency tests.
- `git diff --check` - exit 0 before final docs and commit.

Twelve added supplier-return/warranty cases verify: sold/available/returned-supplier phone boundaries; debt reduction before supplier refund and refund limited to paid amounts; split extra-cost lot costs after accessory sale→return→resale; concurrent supplier return/payment and competing returns of the final original accessory unit; same-key replay/conflict and full stock/document/cash/audit/key rollback after a forced refund failure; shop intake quarantine blocks sale, valid terminal release is audited, duplicate active records and illegal transitions fail; sold customer phones remain sold, wrong customer ownership and release fail; completed/cancelled history permits a later warranty on quarantined own stock; product-before-device warranty/sale race leaves the device sold or quarantined, never both; active sold-device warranties block sale returns/resale. Foundation suite checks unauthenticated and hostile-origin requests for both new endpoint families.

No UI/E2E or runtime database migration was performed. Warranty returns, supplier purchase returns and cash/report aggregation are outside the currently implemented contract areas; SOL should independently review migration 005 and apply it only through the normal runtime migration procedure.

## T-04 cashbook and reports verification

Verified 2026-11-01 against the guarded local `qlchdt_test` database. The new suite checks both the configured URL and PostgreSQL `current_database()` before creating a random owned schema, then drops only that schema.

- `node node_modules/typescript/bin/tsc -p server/tsconfig.json --noEmit` - exit 0.
- `node node_modules/vitest/vitest.mjs run server/foundation.test.ts server/transactions.test.ts server/cash-reports.test.ts` - exit 0, **70/70 passed** across 3 files.
- Cash coverage includes unauthenticated reads/writes, zero and maximum-safe VND, manual category/direction checks, audit creation, identical-key replay, payload conflict, simultaneous writes, and complete rollback after forced audit failure followed by a successful same-key retry.
- Report coverage nets a sale return against revenue, cost and collected amounts; checks customer/supplier debt; verifies cash and bank balances reconcile receipts, supplier payments, sale refunds, supplier refunds and manual entries; and tests inclusive Ho Chi Minh date windows at exact midnight boundaries.
- `git diff --check` - exit 0 before final docs review.

No runtime database migration, UI/E2E, or frontend build was performed. SOL must independently review the SQL and accounting aggregation and rerun checks before merge.
