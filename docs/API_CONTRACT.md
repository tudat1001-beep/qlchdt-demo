# API v1 — contract cố định cho hai worker

Prefix /api. JSON snake_case. IDs UUID strings. Tiền VND number nguyên an toàn. Thời gian ISO UTC. Enum đúng chữ hoa/thường như dưới. Thành công GET list: {items:[...]} (có thể thêm total). GET detail và POST: object bản ghi trực tiếp. Lỗi: {error:{code:string,message:string}}. 400 validation, 401 unauthenticated, 403 origin/authorization, 404 missing, 409 stock/duplicate/idempotency, 422 invalid business transition. Mọi POST nghiệp vụ trừ login/logout yêu cầu Idempotency-Key UUID. Server tính total/cost/debt, không tin tính tiền của UI.

## Foundation/catalog
- GET /health → {ok:true}; GET /auth/me → {id,username}; POST /auth/login {username,password} → user + session cookie; POST /auth/logout {} → {ok:true}.
- GET /products?q=&kind=PHONE|ACCESSORY → {items:[{id,sku,name,kind,brand,model,variant,color,storage,sale_price,min_stock,stock_quantity}]}; POST /products {sku,name,kind,brand?,model?,variant?,color?,storage?,sale_price,min_stock?}; PATCH /products/:id same editable descriptive fields/prices, kind/sku immutable after use. PATCH needs key as mutation too.
- GET /devices?q=&status=&product_id= → {items:[{id,imei,product_id,product_name,sku,status,condition,cosmetic,battery,defects,included_accessories,cost,sale_price}]}. status available/sold/quarantine/returned_supplier, condition NEW/USED.
- GET /customers?q=, GET /suppliers?q= → items {id,name,phone,address,note,debt}; POST /customers or /suppliers {name,phone?,address?,note?}; PATCH /customers/:id or /suppliers/:id same fields. GET /customers/:id and /suppliers/:id → {...party,sales?/purchases?,payments?,warranties?}.

## Inventory
- GET /purchases → {items:[{id,number,supplier_id,supplier_name,total,paid,debt,created_at,status}]}; GET /purchases/:id → {...purchase,lines:[...],payments:[...],returns:[...]}.
- POST /purchases {supplier_id,extra_cost:0,note?,payments:[{method:'cash'|'bank',amount}],lines:[{product_id,quantity,unit_cost,devices?:[{imei,condition:'NEW'|'USED',cosmetic?,battery?,defects?,included_accessories?,sale_price?}]}]} → purchase detail. PHONE quantity = devices.length; ACCESSORY no devices. extra_cost distributed as BUSINESS_RULES.
- GET /stock-movements → {items:[{id,created_at,product_name,imei?,quantity,cost,reference_type,reference_id,note?}]}.
- POST /purchase-returns {purchase_id,reason,lines:[{purchase_line_id,quantity,device_ids?:string[]}],method:'cash'|'bank'} → {id,...}. Full/partial original available stock only. Supplier refund = value after outstanding payable reduction.

## Sales/customer payments
- GET /sales?q= → {items:[{id,number,customer_id,customer_name,total,paid,debt,cost,status,created_at}]}; GET /sales/:id → {...sale,lines:[{id,product_id,product_name,sku,device_id?,imei?,quantity,unit_price,discount,total,cost,returned_quantity}],payments:[...],returns:[...]}.
- POST /sales {customer_id?:string|null,discount:0,note?,payments:[{method,amount}],lines:[{product_id,device_id?:string,quantity,unit_price}]} → sale detail. PHONE one device, quantity=1; ACCESSORY no device_id. Prevent duplicate device/line loopholes. Unpaid requires customer.
- POST /payments {party_type:'customer'|'supplier',reference_id:sale_id|purchase_id,method:'cash'|'bank',amount,note?} → payment, amount >0 <= outstanding.
- POST /returns {sale_id,reason,disposition:'available'|'quarantine',method:'cash'|'bank',lines:[{sale_line_id,quantity}]} → {id,total,refund,debt_reduction,...}. Return value allocated from original discount; prevent cumulative rounding leakage.
- POST /sales/:id/cancel {reason,method:'cash'|'bank',disposition:'available'|'quarantine'} → full return of remaining, status cancelled. Cannot cancel already partially returned sale unless it reverses only remaining correctly.
- Exchange is explicit return then new sale, UI links original sale in note; do not present an unimplemented atomic exchange button.

Khi tích hợp trả hàng: `total` giữ giá trị hóa đơn gốc; response bổ sung `returned_total`, `net_total`, `refunded`, `paid_net`. `paid` là tổng thu trước hoàn, `paid_net` là thu ròng sau hoàn; `debt` là nợ còn lại sau trả hàng và thanh toán. Trạng thái đọc suy ra `posted`/`partially_returned`/`returned`/`cancelled`. Không đổi âm thầm total gốc hoặc sửa snapshot dòng cũ. Frontend in hóa đơn gốc và hiển thị trả/hoàn/nợ riêng.

## Warranty/cash/report
- GET /warranties?q= → {items:[{id,device_id,imei,customer_id,customer_name,status,issue,resolution,created_at}]}; POST /warranties {device_id,customer_id?,issue} → warranty; PATCH /warranties/:id {status:'received'|'processing'|'completed'|'cancelled',resolution?,release_to_stock?:boolean} → warranty. release only on existing quarantined shop-owned device, not customer sold device.
- GET /cash → {items:[{id,created_at,direction:'in'|'out',method,amount,category,note,reference_id}],cash_balance,bank_balance}; POST /cash {direction,method,amount,category,note} → entry. Manual categories only other_income/expense, prevent forging sales receipts.
- GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD → {revenue,cost,gross_profit,collected,expenses,customer_debt,supplier_debt,stock_value,low_stock:[...],daily:[{date,revenue,cost,gross_profit}],best_sellers:[...]}.
- GET /audit → {items:[{id,created_at,actor,action,entity_type,entity_id,details}]}. Reports derived from recorded docs, return and payments, date in Asia/Ho_Chi_Minh.

List sorting/filter/pagination can be frontend on returned rows for initial single store; never truncate history silently. API compatibility changes need SOL Orca ask before edit. Additional read fields allowed. Contract discrepancies must be recorded and resolved before integration.
