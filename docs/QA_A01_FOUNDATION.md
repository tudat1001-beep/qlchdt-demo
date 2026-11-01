# Báo cáo QA & Kiểm thử Frontend Foundation (Task A-01)

- **Người thực hiện:** ANTIGRAVITY (Frontend UX & QA Owner)
- **Người giám sát:** SOL (Coordinator)
- **Phạm vi nhiệm vụ:** Task A-01 — App Shell, Xác thực, Danh mục Hàng hóa & Thiết bị, Đối tác Khách hàng & Nhà cung cấp
- **Thời điểm nghiệm thu:** 2026-11-01
- **Môi trường & Model:** Gemini 3.8 Flash (Medium), Windows, Node.js 24.18.0, PostgreSQL 18 (Cluster riêng biệt).

---

## 1. Tổng quan giao diện & Trải nghiệm người dùng (UX)

- **Bố cục chuẩn App Shell:**
  - Sidebar xanh Navy (`#0f172a`) với nhận diện thương hiệu QLCHDT, huy hiệu tài khoản quản lý và nút đăng xuất.
  - Các nút hành động chính tông màu Teal (`#0d9488`, `#0f766e`).
  - Bản địa hóa 100% bằng tiếng Việt chuẩn nghiệp vụ quản trị bán lẻ Việt Nam.
  - Nhãn phân loại trực quan: "Tất cả", "Điện thoại", "Phụ kiện" (loại bỏ hoàn toàn các nhãn kỹ thuật).
  - Hỗ trợ đầy đủ màn hình Desktop (1440px / 1280px), Tablet (768px), và Mobile (390px):
    - Trên màn hình nhỏ (<768px), nhãn chi nhánh cửa hàng ở header tự động ẩn để tiêu đề và nút đăng xuất vừa vặn thoải mái.
    - Sidebar chuyển thành ngăn trượt (mobile overlay) với nút hamburger.

- **Bảng dữ liệu MISA Compact Desktop Tables:**
  - Khoảng cách dòng và ô bảng được thu gọn tối ưu không gian hiển thị (`padding: 6.5px 10px`), hiển thị lượng dữ liệu dày đặc mà không phải cuộn nhiều.
  - Số liệu và giá tiền căn phải (`tabular-nums`), định dạng chuẩn tiền tệ Việt Nam (`15.000.000 ₫`).
  - Mã định danh SKU và IMEI hiển thị bằng font đơn khoảng (monospace: `ui-monospace, SFMono-Regular`).
  - Hỗ trợ sắp xếp (sort) theo SKU, Tên sản phẩm, Giá bán và Tồn kho khi nhấn tiêu đề cột.
  - Khi danh sách trống, thành phần Empty State được bố trí bên ngoài bảng cuộn ngang, giúp nội dung hướng dẫn luôn căn giữa màn hình mà không bị cắt xén ngang trên màn hình hẹp.

- **Ngăn trượt chi tiết (Slide-over Drawers):**
  - Mở chi tiết khách hàng và nhà cung cấp từ cạnh phải màn hình.
  - Hiển thị công nợ nổi bật (màu đỏ cảnh báo nếu nợ > 0).
  - Tích hợp các tab lịch sử mua/bán, chứng từ thanh toán và bảo hành liên quan từ API thật (`GET /customers/:id`, `GET /suppliers/:id`).

- **Trải nghiệm bàn phím & Trợ năng (Accessibility & Keyboard Traps):**
  - **Phím Enter trong form:** Khi nhấn Enter tại ô nhập liệu, tiêu điểm (focus) tự động chuyển sang ô kế tiếp, ngăn chặn việc gửi nhầm dữ liệu chưa hoàn chỉnh.
  - **Khóa tiêu điểm (Tab trap):** Khi mở Modal hoặc Drawer, phím `Tab` và `Shift+Tab` được giam giữ hoàn toàn bên trong hộp thoại (từ nút đầu đến nút cuối và ngược lại).
  - **Phím Escape:** Lắng nghe toàn cục để đóng Modal và Drawer ngay lập tức, hoàn trả tiêu điểm cho phần tử kích hoạt trước đó mà không dùng timeout tùy tiện.

---

## 2. API Client & Idempotency (Chống trùng lặp giao dịch)

- **Cấu hình chuẩn:**
  - Luôn gửi kèm cookie phiên (`credentials: 'include'`).
  - Tự động đính kèm header `Idempotency-Key: <UUID>` cho các phương thức biến đổi (`POST`, `PATCH`), trừ các endpoint đăng nhập/đăng xuất (`/auth/login`, `/auth/logout`).
- **Bảo toàn khóa qua SHA-256 (SessionStorage Persistence):**
  - Quản lý khóa tập trung qua `IdempotencyManager` tại `src/lib/idempotency.ts`.
  - Tính chữ ký SHA-256 (`crypto.subtle.digest`) từ chuỗi `METHOD:URL:BODY` để lưu trữ trong `sessionStorage`, hoàn toàn không lưu thông tin PII dạng thô.
  - Loại bỏ hoàn toàn TTL: Khóa UUID được bảo toàn qua các lần tải lại trang hoặc thử lại khi mạng gián đoạn, ngăn ngừa phát sinh giao dịch kép khi trạng thái commit chưa chắc chắn.
  - Khóa UUID tự động đổi mới khi nội dung payload thay đổi (người dùng chỉnh sửa giá trị).
  - Khóa chỉ được giải phóng (`invalidate`) khi phản hồi HTTP 2xx đã được phân tích cú pháp JSON thành công.
  - Toàn bộ khóa lưu trữ được dọn sạch (`clear()`) khi người dùng đăng xuất.
- **Xử lý Đăng xuất nghiêm ngặt (Strict Logout):**
  - Phương thức `logout` chỉ xóa trạng thái người dùng, làm sạch `queryClient` (TanStack Query cache) và xóa `idempotencyManager` sau khi máy chủ phản hồi xác nhận thành công.
  - Nếu máy chủ lỗi (500 hoặc mất mạng), lỗi được hiển thị trực tiếp cho người dùng qua Toast notification và phiên làm việc không bị xóa ngầm.
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

## 4. Kết quả kiểm thử E2E Playwright (27 Tests Passed)

Cấu hình E2E runner: `scripts/e2e-server.mjs` tích hợp Vite 5174 và Fastify 3002 trên database PostgreSQL `_test`.
Hỗ trợ 3 viewport: **Desktop Chrome (1280x720)**, **Tablet Chrome (768x1024)**, **Mobile Chrome (393x851)**.

Lệnh thực thi:
```sh
npx playwright test
```

Kết quả:
```
Running 27 tests using 1 worker

  ok  1 [Desktop Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (829ms)
  ok  2 [Desktop Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (723ms)
  ok  3 [Desktop Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (607ms)
  ok  4 [Desktop Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (631ms)
  ok  5 [Desktop Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (789ms)
  ok  6 [Desktop Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (862ms)
  ok  7 [Desktop Chrome] › tests\e2e\live-foundation.spec.ts:22:3 › Real API Foundation End-to-End Flow (Guarded _test Database) › Luồng thực tế không mock: Đăng nhập -> Tạo SP -> Sửa SP -> Tạo KH -> Xem Drawer -> Tạo NCC -> Reload xác minh persistence -> Đăng xuất (4.3s)
  ok  8 [Desktop Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (964ms)
  ok  9 [Desktop Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (766ms)
  ok 10 [Tablet Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (777ms)
  ok 11 [Tablet Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (749ms)
  ok 12 [Tablet Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (671ms)
  ok 13 [Tablet Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (628ms)
  ok 14 [Tablet Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (737ms)
  ok 15 [Tablet Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (780ms)
  ok 16 [Tablet Chrome] › tests\e2e\live-foundation.spec.ts:22:3 › Real API Foundation End-to-End Flow (Guarded _test Database) › Luồng thực tế không mock: Đăng nhập -> Tạo SP -> Sửa SP -> Tạo KH -> Xem Drawer -> Tạo NCC -> Reload xác minh persistence -> Đăng xuất (9.0s)
  ok 17 [Tablet Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (1.4s)
  ok 18 [Tablet Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (1.0s)
  ok 19 [Mobile Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (939ms)
  ok 20 [Mobile Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (935ms)
  ok 21 [Mobile Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (763ms)
  ok 22 [Mobile Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (664ms)
  ok 23 [Mobile Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (801ms)
  ok 24 [Mobile Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (1.5s)
  ok 25 [Mobile Chrome] › tests\e2e\live-foundation.spec.ts:22:3 › Real API Foundation End-to-End Flow (Guarded _test Database) › Luồng thực tế không mock: Đăng nhập -> Tạo SP -> Sửa SP -> Tạo KH -> Xem Drawer -> Tạo NCC -> Reload xác minh persistence -> Đăng xuất (13.7s)
  ok 26 [Mobile Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (1.4s)
  ok 27 [Mobile Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (1.1s)

  27 passed (53.4s)
```

### Bằng chứng hình ảnh trực quan (Clean Screenshots):
- **Desktop Chrome:** `test-results/live-foundation-desktop-chrome.png` (97 KB)
- **Tablet Chrome:** `test-results/live-foundation-tablet-chrome.png` (57 KB)
- **Mobile Chrome:** `test-results/live-foundation-mobile-chrome.png` (241 KB)

---

## 5. Kết quả kiểm tra Toàn diện (`npm run check`)

Lệnh:
```sh
npm run check
```
1. `tsc --noEmit && vite build`: Biên dịch TypeScript sạch sẽ, không có lỗi kiểu dữ liệu (`0 errors`).
2. `vitest run`: Toàn bộ 29 tests vượt qua 100%:
   - `server/foundation.test.ts` (21 tests)
   - `tests/money.test.ts` (3 tests)
   - `tests/ui/idempotency.test.ts` (5 tests)

---

## 6. Cam kết và Tuân thủ Boundary

- Toàn bộ thay đổi mã nguồn nằm chính xác trong quyền sở hữu của ANTIGRAVITY (`src/**`, `public/**`, `index.html`, `tests/e2e/**`, `tests/ui/**`, `playwright.config.ts`, `docs/QA*.md`).
- Nhánh `task-a-01` chứa các commit độc lập, bám sát đầy đủ tiêu chuẩn nghiệm thu của SOL.
