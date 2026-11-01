# Database contract

Tên bảng và cột snake_case; id UUID; thời gian timestamptz; tiền BIGINT; số lượng integer CHECK >0 trên dòng và >=0 trên tồn; FOREIGN KEY không cascade xóa chứng từ. TERRA hoàn thiện DDL đúng nghiệp vụ và cập nhật tài liệu này theo migration đã chạy.

Nhóm bảng bắt buộc: users, sessions; products (sku unique, kind PHONE/ACCESSORY, name, brand, model, variant, color, storage, sale_price, min_stock); customers, suppliers; devices (imei unique, product_id, condition, cosmetic, battery, defects, included_accessories, cost, status); purchases + purchase_lines + accessory_lots; sales + sale_lines + sale_allocations FIFO; returns + return_lines; purchase_returns; payments/cash_entries; warranties; stock_movements; audit_logs; idempotency.

Ledger phải truy được chứng từ gốc, thiết bị/lô, quantity delta, cost delta, actor và thời gian. Chứng từ lưu snapshot giá/chiết khấu/giá vốn; không tính lại từ bảng giá hiện tại. Công nợ được tính từ giá trị chứng từ, hoàn trả và thanh toán liên kết; không cho tổng vượt Number.MAX_SAFE_INTEGER khi trả JSON.

Index: devices imei UNIQUE, products sku UNIQUE, FK trên các dòng/ledger, created_at trên chứng từ và audit, customer_id/supplier_id trên lịch sử, accessory_lots(product_id, remaining_quantity) và status thiết bị. CHECK và khóa transaction là lớp bảo vệ độc lập.

Migration tăng số và có bảng schema_migrations, chạy dưới advisory lock; không reset tự động. Database sử dụng qlchdt, test qlchdt_test, PostgreSQL cluster riêng trong .local/postgres cổng 55439. Mật khẩu sinh ngẫu nhiên ở .env bị Git ignore.
