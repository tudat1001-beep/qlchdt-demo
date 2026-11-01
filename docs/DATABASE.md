# Database contract

T-01 implements PostgreSQL migrations in `server/migrations/`, applied by `server/migrate.ts`. Runtime database: `qlchdt`; integration database: `qlchdt_test`; shared local cluster: `127.0.0.1:55439`. Connection strings and bootstrap credentials live in ignored `.env`, never source control. Runtime uses the least-privilege role provisioned by SOL.

## Migration and transaction rules

- `schema_migrations(version,checksum,applied_at)` records each numbered SQL file. A transaction-level advisory lock serializes migration runners; SQL and migration metadata commit together. Repeat runs preserve data; changed checksums or missing applied files fail. Never edit an applied migration; append the next version.
- `server/db.ts` exports `createPool` and `transaction`. A transaction checks out one client for BEGIN/work/COMMIT and rolls back on failure. All later document, stock, payment, audit and idempotency writes must use that same client.
- IDs use UUID, timestamps use `timestamptz`/UTC, foreign keys do not cascade document deletion. `money_vnd` is a BIGINT domain constrained to 0 through 9007199254740991. BIGINT results are converted to JSON numbers only after a safe-integer check. Future numeric aggregates must also be range-checked; never silently convert an arbitrary NUMERIC result.
- Migration bootstrap creates exactly one manager from `ADMIN_USERNAME`/`ADMIN_PASSWORD` when no user exists. Password requires at least 12 characters and rejects the example placeholder. A repeat migration never resets credentials or creates another manager. No public registration/reset endpoint exists.
- Passwords use scrypt N=131072/r=8/p=1, 16 random salt bytes and a 64-byte derived key; parameters are included in the hash. This follows the [OWASP scrypt baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt). Each active derivation uses approximately 128 MiB; login rate limiting bounds repeated work in this single-process application.

## Applied schema: 001_foundation.sql

| Table | Key fields and constraints |
| --- | --- |
| users | UUID, singleton=true UNIQUE/CHECK, unique username, salted scrypt password hash, created_at |
| sessions | SHA-256 opaque-token hash primary key, user FK, expires_at; raw tokens only in HttpOnly cookies |
| products | unique nonblank sku, nonblank name, PHONE/ACCESSORY kind, descriptive fields, sale_price money_vnd, min_stock>=0, timestamps |
| customers / suppliers | UUID, nonblank name, phone/address/note, timestamps; separate party namespaces |
| devices | unique 15-digit IMEI, product FK, NEW/USED condition, cosmetic/battery 0-100/defects/included_accessories, cost/sale_price money_vnd, four-state status |
| audit_logs | actor FK, action/entity_type/entity_id, JSON details, created_at; UPDATE/DELETE rejected by trigger |
| idempotency | UUID key, actor FK, operation, canonical JSON SHA-256 payload hash, status_code, response JSON, created_at; UPDATE/DELETE rejected |

Indexes cover session expiry; devices(product_id,status) plus unique IMEI; product SKU; audit entity/time and created_at. UUID primary keys provide party lookup indexes. Future history foreign keys get indexes in the migration introducing them.

Every foundation business POST and PATCH requires `Idempotency-Key: UUID`. Keys are global, normalized to lowercase and scoped in the saved record to actor/operation/payload. An advisory transaction lock on the key precedes lookup and mutation; identical retries replay the saved status and JSON, changed payload/actor/operation returns 409. Key, domain rows and audit commit together; failure leaves no reserved key. Idempotency records have no automatic expiry.

## T-01 decisions approved by SOL through Orca ask

- Foundation supports create/read/update only; no DELETE endpoints. SKU and kind are immutable on PATCH and protected by a database trigger.
- Customer/supplier detail includes empty history arrays and debt=0 only for T-01. Accessory stock_quantity=0 until lot-based stock exists. Phone stock_quantity counts available devices. These placeholders must be replaced before transactional modules are accepted.
- No stock/device write API or premature full-module DDL in this task. Device product-kind validation, provenance and state transitions belong to the forthcoming stock transaction module.

## Module schema plan (T-02 implementation detailed below; T-03 pending)

| Module | Planned tables and invariants |
| --- | --- |
| Purchases | purchases(supplier_id,number,total,paid,status,note), purchase_lines(purchase_id,product_id,quantity,unit_cost,allocated_extra_cost), accessory_lots(purchase_line_id,product_id,quantity,remaining_quantity,unit_cost) with remaining>=0; devices gains original purchase_line_id provenance |
| Sales | sales(customer_id,number,total,discount,cost,status), sale_lines(sale_id,product_id,device_id,quantity,unit_price,discount,total,cost,returned_quantity), sale_allocations(sale_line_id,lot_id,quantity,cost); immutable price/description snapshots and original FIFO allocations |
| Reversals | returns(sale_id,reason,total,refund,debt_reduction,method), return_lines(return_id,sale_line_id,quantity,value,cost,disposition), purchase_returns and purchase_return_lines linked to original purchase lines/devices/lots; cumulative quantity/value checks under original-document locks |
| Payments/cash | payments(party_type,reference_id,method,amount), cash_entries(direction,method,amount,category,reference_type,reference_id,note,actor); positive safe money; linked receipts cannot be forged by manual cash API |
| Warranty | warranties(device_id,customer_id,sale_id,status,issue,resolution), lifecycle audit; shop-owned quarantine release validated separately from sold customer devices |
| Stock ledger | stock_movements(product_id,device_id,lot_id,quantity_delta,cost_delta,reference_type,reference_id,actor,note,created_at); append-only linked movement history |

Later migrations must add actual foreign keys to original documents (avoid unvalidated polymorphic IDs), FK/history indexes, append-only ledger guards and safe-money checks. Debt derives from original documents, linked returns and payments; never a writable balance field. Snapshot descriptions/prices/discounts/costs survive catalog updates. A device belongs to at most one active sale; do not permanently UNIQUE sale_lines.device_id, because returned devices may be resold. Sold/returned_supplier/quarantined stock cannot be sold. Lock products/documents/devices/lots in stable order, enforce nonnegative stock and validate all sums with safe integers/BigInt. Purchase extra-cost allocation uses at most two unit-cost lots per input line to conserve every dong; partial returns use cumulative net allocations. Each document is one transaction, including cash/debt/stock/audit/idempotency. Follow SOL's `docs/TRANSACTION_DESIGN.md` when implementing T-02.

## Test safety

`server/foundation.test.ts` refuses an absent or non-`_test` TEST_DATABASE_URL, checks `current_database()` before creating anything, then uses a random dedicated schema. Cleanup drops only that schema after confirmed creation; public test data and the real database are untouched. See `docs/BACKEND_TESTS.md` for evidence. Never reset a user database; backup via pg_dump and restore into a new database.

## T-02 inventory: 002_inventory.sql

Implemented tables: `purchases`, `purchase_lines`, `accessory_lots`, `payments`, `cash_entries`, `stock_movements`; devices now link their original `purchase_line_id`. Purchases preserve supplier name; lines preserve product name/SKU/kind and a full product snapshot. Posted documents, lines, payments, cash and stock ledger rows reject UPDATE/DELETE. Device identity/source/cost and original lot fields are immutable; only remaining lot quantity is mutable within 0..original quantity. Foreign keys retain original stock/document provenance and prevent deletion. Source-kind triggers require PHONE devices and ACCESSORY lots.

Purchase numbers use a database sequence (`PN-1`, etc.); rollback may leave harmless number gaps. Purchase detail includes lines with `position,product_snapshot,quantity,unit_cost,extra_cost,cost,devices,lots`, payments and an empty returns array. Each lot exposes original/remaining quantity and exact unit cost. Repeated purchase product IDs are allowed with different unit costs. All unique product rows lock once in UUID order. IMEIs are validated across the entire request; database uniqueness handles cross-request races.

Extra cost is apportioned using BigInt quotient/remainder in input line/device order. Accessory lines form at most two unit-cost lots, preserving every dong without materializing individual accessory units. FIFO uses lot `created_at,id`; lot timestamps use clock_timestamp after the product lock, preserving receiving order across waiting purchase transactions. Purchase cash payments create one linked outflow each. A payment-balance trigger independently locks/checks the original document before allowing a positive payment; cash method/amount must match its payment through a composite FK. Paid and supplier debt derive from append-only payments, never mutable balance columns.

The T-01 accessory-stock/supplier-history placeholders are replaced: stock counts remaining accessory lots or available phones; supplier detail/list/patch reads actual purchase debt/history. Customers still await the sales step. Existing T-01 devices with no original purchase line remain readable; the API only creates linked devices, and sales must reject unlinked legacy devices until their provenance is reconciled.

Boundaries: 200 purchase lines, 500 devices across a document, 20 payments, positive int32 quantities and safe VND fields. Each transaction has 5-second lock and 15-second statement timeouts; deadlocks/timeouts return retryable 409 `TRANSACTION_RETRY` with `Retry-After: 1`, retaining the same idempotency key. Arithmetic overflow maps to 422 `MONEY_RANGE`; malformed input maps to 400. No real database was reset or populated by tests.

## T-02 sales and collections: 003_sales.sql

Implemented `sales`, `sale_lines` and `sale_allocations`; payments now reference exactly one purchase or sale through actual foreign keys. Sales, lines and FIFO allocations reject UPDATE/DELETE. Each sale preserves customer name/snapshot, subtotal, discount, total and cost; lines preserve product descriptions/snapshot, IMEI, unit price, allocated discount, net total and original cost. Allocations preserve ordered lot IDs, quantities and unit costs for future reversals. No permanent unique device constraint prevents later resale; one request cannot repeat a device, and product/device locks plus available-state checks prevent simultaneous sales. Distinct devices of one product are allowed; repeated accessory product lines return 400 with an instruction to combine quantities.

Locks follow idempotency key, products by UUID, devices by UUID, then available lots by created_at/id. FIFO planning validates all stock and safe gross/cost/payment totals before writes; conditional updates and lot checks also prevent negative stock. Sold phones retain their original purchase provenance. Stock movements link both original purchase lines and sale lines and expose negative sale quantity/cost with the sale as reference. Money uses SOL's checked sum/multiply/discount helpers; discount remainder goes to the first eligible lines in input order. Sales numbers use `BH-` plus a sequence, with harmless rollback gaps.

Sale detail adds `subtotal,customer_snapshot`; each line includes `position,kind,product_snapshot,allocations,returned_quantity`, with returned_quantity=0 and returns=[] until T-03. Payments expose `party_type,reference_id,purchase_id,sale_id`. SOL approved these additional read fields through Orca ask; existing request fields remain unchanged. Customer debt/history now derives from sales and append-only payments; supplier history also includes later debt payments. Warranty arrays remain empty until T-03.

POST `/payments` locks the referenced document before calculating its outstanding balance and writing payment, cash entry, audit and idempotency in one transaction. Concurrent different-key collections cannot overpay; same-key retries replay one result. Purchase payments are cash outflows and customer payments inflows, enforced by the database payment/cash triggers and matching method/amount foreign key. Sale debt requires a customer; combined cash/bank payments cannot exceed total. API sale limits are 200 lines and 20 payments. This migration implements no return, cancellation, warranty or reporting behavior; T-03 must add linked reversal records and subtract their debt reductions before accepting collections.
