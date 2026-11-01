# QLCHDT — Quản lý cửa hàng điện thoại

Ứng dụng quản lý một cửa hàng, giao diện tiếng Việt, backend và PostgreSQL local. Dữ liệu kinh doanh không được seed giả. Trạng thái nghiệm thu thực tế xem docs/QA*.md và docs/BACKEND_TESTS.md khi các module đã tích hợp.

## Chạy trên máy này

Yêu cầu Node.js 24 và PostgreSQL 18 binaries (mặc định C:/Program Files/PostgreSQL/18/bin). Cụm riêng cổng 55439, dữ liệu tại .local/postgres, không dùng PostgreSQL hệ thống cổng 5432.

```powershell
npm ci
npm run db:setup
npm run dev
```

Mở http://127.0.0.1:5175. Tên đăng nhập và mật khẩu được sinh ở `.local/credentials.txt`; cấu hình riêng tại `.env`, không commit/chia sẻ hai file này. Migration khởi tạo tài khoản lần đầu, thay ADMIN_PASSWORD sau đó không tự đổi mật khẩu trong database.

```powershell
npm run build
npm test
npm run test:e2e
node scripts/postgres.mjs backup
```

Production local: build rồi chạy backend phục vụ dist trên http://127.0.0.1:3001; APP_ORIGIN phải khớp URL đang dùng. NODE_ENV=production yêu cầu HTTPS để browser gửi cookie Secure; không bật production qua HTTP rồi bỏ cookie bảo vệ. Phạm vi phiên triển khai này không deploy Internet/production.

## Dữ liệu và chính sách

- Tiền VND nguyên đồng; điện thoại giá vốn theo máy, phụ kiện FIFO.
- Phiếu bán là chứng từ quản trị nội bộ; không phải hóa đơn điện tử thuế.
- Giao dịch online; khi mất mạng không ghi nhận bán thành công.
- Đổi máy gồm chứng từ trả và phiếu bán mới, lưu liên kết; không gộp thành giao dịch đổi nguyên tử khi chưa có API riêng.
- Database test `qlchdt_test` riêng; không reset database đang dùng.
- Sao lưu `.local/backup-*.dump` nên chép ra thiết bị khác; `.local` trên cùng ổ không bảo vệ khi hỏng ổ. Khôi phục vào database mới và đối chiếu trước chuyển dữ liệu.

Tài liệu: docs/BUSINESS_RULES.md, ARCHITECTURE.md, DATABASE.md, API_CONTRACT.md, IMPLEMENTATION_PLAN.md, AGENT_TASKS.md, ACCEPTANCE.md.
