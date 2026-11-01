# Báo cáo QA & Kiểm thử Frontend Foundation (Task A-01)

- **Người thực hiện:** ANTIGRAVITY (Frontend UX & QA Owner)
- **Người giám sát:** SOL (Coordinator)
- **Phạm vi:** Task A-01 — App Shell, Xác thực, Danh mục Hàng hóa & Thiết bị, Đối tác Khách hàng & Nhà cung cấp
- **Thời điểm nghiệm thu:** 2026-11-01
- **Môi trường & Model:** Gemini 3.8 Flash (Medium), Windows, Node.js 24.18.0, PostgreSQL 18 (Cluster độc lập).

---

## 1. Tổng quan giao diện & Trải nghiệm người dùng (UX)

- **Bố cục chuẩn App Shell:**
  - Sidebar xanh Navy (`#0f172a`) với nhận diện thương hiệu QLCHDT, huy hiệu tài khoản quản lý và nút đăng xuất tức thì.
  - Các nút hành động chính tông màu Teal (`#0d9488`, `#0f766e`).
  - Toàn bộ nhãn, thông báo, tiêu đề, trạng thái được bản địa hóa 100% bằng tiếng Việt chuẩn nghiệp vụ quản trị bán lẻ Việt Nam.
  - Hỗ trợ đầy đủ màn hình di động/tablet: sidebar chuyển thành ngăn trượt (mobile overlay) với nút hamburger, bảng cuộn ngang tự nhiên.

- **Bảng dữ liệu MISA Compact Desktop Tables:**
  - Khoảng cách dòng và ô bảng được thu gọn tối ưu không gian hiển thị (`padding: 6.5px 10px`), cho phép xem nhiều dữ liệu cùng lúc mà không phải cuộn nhiều.
  - Tiêu đề cột in hoa, cố định đường kẻ ô rõ ràng.
  - Số liệu và giá tiền căn phải (`tabular-nums`), định dạng chuẩn tiền tệ Việt Nam (`15.000.000 ₫`).
  - Mã định danh SKU và IMEI hiển thị bằng font đơn khoảng (monospace: `ui-monospace, SFMono-Regular`).
  - Hỗ trợ sắp xếp (sort) theo SKU, Tên sản phẩm, Giá bán và Tồn kho khi nhấn tiêu đề cột.

- **Ngăn trượt chi tiết (Slide-over Drawers):**
  - Mở chi tiết khách hàng và nhà cung cấp từ cạnh phải màn hình.
  - Hiển thị công nợ nổi bật (màu đỏ cảnh báo nếu nợ > 0).
  - Tích hợp các tab lịch sử mua/bán, chứng từ thanh toán và bảo hành liên quan từ API thật (`GET /customers/:id`, `GET /suppliers/:id`).
  - Đóng linh hoạt bằng phím `Escape` hoặc nhấn ra vùng nền (backdrop).

- **Trải nghiệm bàn phím & Trợ năng (Accessibility & Keyboard):**
  - **Phím Enter trong form:** Khi nhấn Enter tại ô nhập liệu, tiêu điểm (focus) tự động chuyển sang ô kế tiếp, ngăn chặn việc gửi nhầm dữ liệu chưa hoàn chỉnh.
  - **Phím Escape:** Lắng nghe toàn cục để đóng Modal và Drawer ngay lập tức, trả lại tiêu điểm cho phần tử kích hoạt trước đó.
  - Nhãn `label` gắn liền với `id` của input thông qua `htmlFor`, kèm cờ `aria-invalid`, `role="alert"` và `role="dialog"`.

---

## 2. API Client & Idempotency (Chống trùng lặp giao dịch)

- **Cấu hình chuẩn:**
  - Luôn gửi kèm cookie phiên (`credentials: 'include'`).
  - Tự động đính kèm header `Idempotency-Key: <UUID>` cho các phương thức biến đổi (`POST`, `PATCH`), trừ các endpoint đăng nhập/đăng xuất (`/auth/login`, `/auth/logout`).
- **Bảo toàn khóa khi thử lại (Retry):**
  - Quản lý khóa tập trung qua `IdempotencyManager` tại `src/lib/idempotency.ts`.
  - Khóa UUID được giữ nguyên khi gửi lại cùng một payload (chống thực thi kép khi mạng gián đoạn).
  - Khóa UUID tự động đổi mới khi nội dung payload thay đổi (người dùng chỉnh sửa giá trị).
  - Khóa chỉ được giải phóng (`invalidate`) khi phản hồi HTTP 2xx đã được phân tích cú pháp JSON thành công.
- **Tính bất biến của SKU & Loại hàng (Immutable fields):**
  - Trong form sửa sản phẩm, mã SKU và phân loại hàng (`kind`) bị khóa (`disabled`) và tự động được loại bỏ khỏi payload gửi đi qua `PATCH /products/:id`.

---

## 3. Danh sách màn hình & Thành phần chức năng

| Chức năng | Thành phần | API Contract liên kết | Trạng thái |
|---|---|---|---|
| Đăng nhập & Xác thực | `LoginPage.tsx`, `AuthContext.tsx` | `GET /auth/me`, `POST /auth/login`, `POST /auth/logout` | Hoàn thành |
| Bố cục chung | `AppLayout.tsx`, `Sidebar.tsx`, `Header.tsx` | `GET /auth/me` | Hoàn thành |
| Danh mục hàng hóa | `ProductsPage.tsx`, `ProductModal.tsx` | `GET /products`, `POST /products`, `PATCH /products/:id` | Hoàn thành |
| Quản lý IMEI | `DevicesModal.tsx` | `GET /devices` | Hoàn thành |
| Quản lý khách hàng | `CustomersPage.tsx`, `CustomerModal.tsx`, `CustomerDrawer.tsx` | `GET /customers`, `POST /customers`, `PATCH /customers/:id`, `GET /customers/:id` | Hoàn thành |
| Quản lý nhà cung cấp | `SuppliersPage.tsx`, `SupplierModal.tsx`, `SupplierDrawer.tsx` | `GET /suppliers`, `POST /suppliers`, `PATCH /suppliers/:id`, `GET /suppliers/:id` | Hoàn thành |
| Thông báo phản hồi | `ToastContext.tsx`, `Toast.tsx` | — | Hoàn thành |

---

## 4. Kết quả kiểm thử Playwright E2E

Cấu hình E2E runner: `scripts/e2e-server.mjs` tích hợp Vite 5174 và Fastify 3002 trên database PostgreSQL `_test`.

Lệnh thực thi:
```sh
npx playwright test
```

Kết quả thực tế:
```
Running 16 tests using 1 worker

  ok  1 [Desktop Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (813ms)
  ok  2 [Desktop Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (743ms)
  ok  3 [Desktop Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (639ms)
  ok  4 [Desktop Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (626ms)
  ok  5 [Desktop Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (719ms)
  ok  6 [Desktop Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (875ms)
  ok  7 [Desktop Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (1.0s)
  ok  8 [Desktop Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (796ms)
  ok  9 [Mobile Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (968ms)
  ok 10 [Mobile Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (907ms)
  ok 11 [Mobile Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (761ms)
  ok 12 [Mobile Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (774ms)
  ok 13 [Mobile Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (919ms)
  ok 14 [Mobile Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (1.8s)
  ok 15 [Mobile Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (1.4s)
  ok 16 [Mobile Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (1.2s)

  16 passed (19.5s)
```

---

## 5. Kết quả kiểm tra Toàn diện (`npm run check`)

Lệnh:
```sh
npm run check
```
Bao gồm:
1. `tsc --noEmit && vite build`: Biên dịch TypeScript và đóng gói Vite hoàn tất, không phát hiện lỗi kiểu (`0 errors`).
2. `vitest run`: Toàn bộ 24 backend/shared tests passed 100% (`server/foundation.test.ts` 21 tests, `tests/money.test.ts` 3 tests).

---

## 6. Cam kết và Nghiệm thu

- Toàn bộ thay đổi nằm trong phạm vi được phép của ANTIGRAVITY (`src/**`, `public/**`, `index.html`, `tests/e2e/**`, `playwright.config.ts`, `docs/QA*.md`).
- Không chạm vào `server/**`, `shared/**`, `scripts/**` (chỉ merge từ `main` theo chỉ đạo của SOL).
- Không tự seed dữ liệu giả vào cơ sở dữ liệu thật; tuân thủ quy tắc cô lập môi trường test.
