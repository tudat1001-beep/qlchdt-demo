# Báo cáo QA & Kiểm thử Frontend Inventory & POS (Task A-02)

- **Người thực hiện:** ANTIGRAVITY (Frontend UX & QA Owner)
- **Người giám sát:** SOL (Coordinator)
- **Phạm vi nhiệm vụ:** Task A-02 — Quản lý Nhập hàng (Purchases), Tồn kho & Biến động kho (Stock Movements), Điểm bán hàng (POS), Hóa đơn & In ấn (Sales & Invoices), Thu/Chi công nợ đối tác (Party Payments)
- **Thời điểm nghiệm thu:** 2026-11-01
- **Môi trường & Model:** Gemini 3.8 Flash (Medium), Windows, Node.js 24.18.0, PostgreSQL 18 (Database `_test` bảo vệ).

---

## 1. Tổng quan giao diện & Trải nghiệm người dùng (UX)

### 1.1 Quản lý Nhập hàng (Purchases)
- **Form Nhập hàng thông minh (`PurchaseModal.tsx`):**
  - Cho phép chọn Nhà cung cấp từ danh sách API thực tế.
  - Hỗ trợ nhiều dòng sản phẩm lặp lại (repeated product rows) — cùng một model sản phẩm nhưng cho phép nhiều dòng với đơn giá nhập khác nhau theo đúng chuẩn kế toán kho.
  - **Dòng phụ kiện (`accessory`):** Nhập số lượng và đơn giá nhập; tự động tính thành tiền dòng.
  - **Dòng điện thoại (`phone`):**
    - Nhập IMEI (15 ký tự số, kiểm tra định dạng và chống trùng lặp client-side).
    - Tình trạng máy: `NEW` (Mới 100%) hoặc `USED` (Cũ/Lướt).
    - Tình trạng ngoại quan (`cosmetic`), dung lượng pin (`battery_health` 1-100%), mô tả lỗi (`defects`), phụ kiện đi kèm (`accessories`).
    - Giá bán dự kiến theo từng máy (`sale_price`).
  - **Chi phí phát sinh (`extra_cost`):** Nhập chi phí phụ (vận chuyển, bốc xếp...), tự động cộng vào tổng giá trị đơn nhập.
  - **Thanh toán linh hoạt:** Hỗ trợ thanh toán hỗn hợp (Tiền mặt + Chuyển khoản ngân hàng) hoặc thanh toán một phần. Số tiền còn lại được tự động ghi nhận là công nợ phải trả NCC.
- **Ngăn trượt chi tiết đơn nhập (`PurchaseDrawer.tsx`):**
  - Hiển thị danh sách mặt hàng, chi tiết từng thiết bị kèm IMEI và tình trạng máy.
  - Tách bạch rõ ràng số tiền đã trả và công nợ còn lại của phiếu nhập.

### 1.2 Tồn kho & Tra cứu Lịch sử Biến động kho (Stock & Movements)
- Bảng lịch sử biến động kho (`/api/stock-movements`) hiển thị chi tiết: Thời gian, Sản phẩm, Mã giao dịch tham chiếu, Loại biến động (`PURCHASE`, `SALE`, `ADJUSTMENT`), Số lượng thay đổi và Số dư tồn sau giao dịch.
- Tra cứu danh sách thiết bị IMEI theo trạng thái: `IN_STOCK`, `SOLD`, `DEFECTIVE`.

### 1.3 Điểm bán lẻ POS (`POSPage.tsx`)
- **Tìm kiếm đa năng:** Tra cứu siêu tốc theo Tên sản phẩm, Mã SKU hoặc Số IMEI.
- **Lựa chọn chính xác máy điện thoại:** Với sản phẩm điện thoại, hiển thị danh sách thiết bị trong kho (kèm IMEI, tình trạng New/Used, Pin, Giá bán đề xuất). Nhân viên bán hàng chỉ định chính xác thiết bị xuất bán.
- **Giỏ hàng nhiều dòng (Multi-line Cart):**
  - Tự động cộng dồn số lượng với phụ kiện (kiểm tra tồn kho tối đa).
  - Tách dòng riêng biệt cho từng thiết bị điện thoại có IMEI duy nhất.
  - Giảm giá đơn hàng theo VNĐ (`discount`).
- **Bảo toàn giỏ hàng & Phòng ngừa rủi ro:**
  - **Giữ nguyên giỏ hàng khi lỗi:** Nếu máy chủ trả về lỗi (hết hàng, lỗi mạng), toàn bộ giỏ hàng và dữ liệu thanh toán được giữ nguyên, không bị reset trắng.
  - **Bắt buộc chọn khách hàng khi ghi nợ:** Nếu tổng thanh toán (Tiền mặt + Chuyển khoản) < Tổng tiền sau giảm giá, hệ thống bắt buộc nhân viên phải chọn Khách hàng cụ thể trước khi gửi form (ngăn chặn nợ vô danh).
  - **Idempotency an toàn:** Khóa Idempotency được bảo toàn cho đến khi API xác nhận HTTP 2xx thành công.

### 1.4 Quản lý Bán hàng & In Hóa đơn chuẩn Việt Nam (`SalesPage.tsx`, `SaleDrawer.tsx`)
- Danh sách hóa đơn bán hàng hiển thị trạng thái thanh toán: `PAID` (Đã thanh toán), `PARTIAL` (Thanh toán một phần / Nợ), `CANCELLED`.
- **Hóa đơn in ấn chuẩn hóa tiếng Việt:**
  - Bố cục `@media print` chuyên biệt, ẩn toàn bộ navigation/sidebar/action buttons, chỉ giữ lại phiếu thu / hóa đơn bán hàng kích thước chuẩn.
  - Tích hợp nút **In hóa đơn** (`window.print()`) hỗ trợ trực tiếp tính năng **Lưu dưới dạng PDF** (Save as PDF) của trình duyệt.
  - Đầy đủ thông tin: Tên cửa hàng, Địa chỉ, Số điện thoại, Mã hóa đơn, Khách hàng, Chi tiết từng mặt hàng & IMEI, Giảm giá, Tổng cộng, Hình thức thanh toán và Ghi chú công nợ.

### 1.5 Thu / Chi công nợ đối tác (`PaymentModal.tsx`)
- Tích hợp trực tiếp tại Drawer Khách hàng và Drawer Nhà cung cấp:
  - Cho phép thu nợ khách hàng hoặc trả nợ nhà cung cấp nhanh chóng qua `POST /api/payments`.
  - Hỗ trợ phân bổ thanh toán theo Hóa đơn cụ thể (`invoice_id`) hoặc Thanh toán chung vào công nợ tổng.
  - Hỗ trợ hình thức Tiền mặt (`CASH`) hoặc Chuyển khoản (`BANK_TRANSFER`).

---

## 2. Kết quả kiểm thử E2E Playwright với Database thật (`_test`)

Tất cả các kịch bản kiểm thử giao dịch thực tế đều chạy trực tiếp qua `scripts/e2e-server.mjs` (Vite port 5174, Fastify port 3002) mà **hoàn toàn không dùng mocked success APIs**.

### 2.1 Luồng giao dịch tích hợp toàn vẹn (`tests/e2e/live-transactions.spec.ts`)
1. **Khởi tạo dữ liệu nền:** Tạo mới Nhà cung cấp & 2 Sản phẩm (1 Điện thoại, 1 Phụ kiện) qua giao diện.
2. **Nhập hàng (Purchase):**
   - Nhập 1 Điện thoại qua IMEI cụ thể (tình trạng `USED`, pin 88%, đơn giá nhập 10.000.000 ₫, giá bán 12.500.000 ₫).
   - Nhập 10 Phụ kiện cáp sạc (đơn giá nhập 50.000 ₫).
   - Chi phí vận chuyển phụ: 200.000 ₫.
   - Thanh toán trước 5.000.000 ₫ tiền mặt, còn lại ghi nợ NCC.
3. **Bán hàng POS (Sale):**
   - Tìm kiếm và chọn đúng chiếc điện thoại theo IMEI đã nhập.
   - Thêm 2 phụ kiện cáp sạc vào giỏ hàng.
   - Áp dụng giảm giá 100.000 ₫.
   - Khách thanh toán: 8.000.000 ₫ tiền mặt + 2.000.000 ₫ chuyển khoản, còn lại ghi nợ khách hàng.
4. **Thu nợ (Debt Collection):**
   - Mở Drawer Khách hàng, kiểm tra công nợ ghi nhận chính xác.
   - Thực hiện thu nợ 500.000 ₫ qua hình thức chuyển khoản ngân hàng.
5. **Kiểm chứng tính bền vững & Tồn kho:**
   - Tải lại toàn bộ ứng dụng (Reload page).
   - Xác minh IMEI đã chuyển trạng thái `SOLD`.
   - Xác minh tồn kho phụ kiện giảm chính xác từ 10 xuống còn 8.
   - Xác minh hóa đơn bán hàng hiển thị đầy đủ và mở chức năng in ấn.

### 2.2 Kết quả chạy toàn bộ Playwright E2E Suite (28 Passed)

```sh
npx playwright test
```

```
Running 28 tests using 1 worker

  ok  1 [Desktop Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (1.1s)
  ok  2 [Desktop Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (720ms)
  ok  3 [Desktop Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (667ms)
  ok  4 [Desktop Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (643ms)
  ok  5 [Desktop Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (762ms)
  ok  6 [Desktop Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (795ms)
  ok  7 [Desktop Chrome] › tests\e2e\live-foundation.spec.ts:22:3 › Real API Foundation End-to-End Flow (Guarded _test Database) › Luồng thực tế không mock: Đăng nhập -> Tạo SP -> Sửa SP -> Tạo KH -> Xem Drawer -> Tạo NCC -> Reload xác minh persistence -> Đăng xuất (5.1s)
  ok  8 [Desktop Chrome] › tests\e2e\live-transactions.spec.ts:21:3 › Real API Inventory, POS, Invoices & Debt End-to-End Flow (Guarded _test Database) › Luồng toàn vẹn: Tạo NCC & SP -> Nhập máy cũ + Phụ kiện -> Bán hàng POS (tiền mặt + chuyển khoản + ghi nợ) -> Thu nợ -> Reload kiểm chứng tồn kho/IMEI/hóa đơn (24.1s)
  ok  9 [Desktop Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (1.1s)
  ok 10 [Desktop Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (735ms)
  ok 11 [Tablet Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (765ms)
  ok 12 [Tablet Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (741ms)
  ok 13 [Tablet Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (641ms)
  ok 14 [Tablet Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (655ms)
  ok 15 [Tablet Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (726ms)
  ok 16 [Tablet Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (792ms)
  ok 17 [Tablet Chrome] › tests\e2e\live-foundation.spec.ts:22:3 › Real API Foundation End-to-End Flow (Guarded _test Database) › Luồng thực tế không mock: Đăng nhập -> Tạo SP -> Sửa SP -> Tạo KH -> Xem Drawer -> Tạo NCC -> Reload xác minh persistence -> Đăng xuất (14.2s)
  ok 18 [Tablet Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (1.4s)
  ok 19 [Tablet Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (1.0s)
  ok 20 [Mobile Chrome] › tests\e2e\auth.spec.ts:4:3 › Xác thực & App Shell (Auth) › Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (957ms)
  ok 21 [Mobile Chrome] › tests\e2e\auth.spec.ts:35:3 › Xác thực & App Shell (Auth) › Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401 (886ms)
  ok 22 [Mobile Chrome] › tests\e2e\auth.spec.ts:63:3 › Xác thực & App Shell (Auth) › Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar (725ms)
  ok 23 [Mobile Chrome] › tests\e2e\catalog.spec.ts:15:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại (726ms)
  ok 24 [Mobile Chrome] › tests\e2e\catalog.spec.ts:73:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường (783ms)
  ok 25 [Mobile Chrome] › tests\e2e\catalog.spec.ts:104:3 › Danh mục hàng hóa & Thiết bị (Catalog & Devices) › Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable) (1.4s)
  ok 26 [Mobile Chrome] › tests\e2e\live-foundation.spec.ts:22:3 › Real API Foundation End-to-End Flow (Guarded _test Database) › Luồng thực tế không mock: Đăng nhập -> Tạo SP -> Sửa SP -> Tạo KH -> Xem Drawer -> Tạo NCC -> Reload xác minh persistence -> Đăng xuất (14.3s)
  ok 27 [Mobile Chrome] › tests\e2e\parties.spec.ts:32:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape (1.4s)
  ok 28 [Mobile Chrome] › tests\e2e\parties.spec.ts:101:3 › Đối tác Khách hàng & Nhà cung cấp (Parties) › Điều hướng sang Nhà cung cấp và mở form thêm mới (1.1s)

  28 passed (1.4m)
```

### 2.3 Hình ảnh minh chứng Responsive (Screenshots)
Đã chụp và lưu trữ ảnh chụp màn hình tại các độ phân giải tiêu chuẩn:
- **PC Desktop (1440px):** `tests/e2e/screenshots/pc1440-pos.png`, `tests/e2e/screenshots/pc1440-sales.png`
- **Tablet (768px):** `tests/e2e/screenshots/tablet768-inventory.png` (Giao diện chuẩn khi menu mobile đã đóng)
- **Mobile (390px):** `tests/e2e/screenshots/mobile390-inventory.png` (Trang kho hiển thị đầy đủ, không bị sidebar/backdrop che, bảng dữ liệu cuộn ngang mượt mà)

### 2.4 Khắc phục & Nghiệm thu Responsive Mobile 390px / Tablet 768px (Task A-02 Follow-up)
- **Hiện tượng phân tích:** Ảnh chụp màn hình 390px cũ có thanh sidebar navy che một phần màn hình.
- **Nguyên nhân cốt lõi (Root Cause):**
  1. **Hiệu ứng chuyển động (CSS Transition):** Sau khi bấm chuyển sang *Nhập hàng & Kho* ở chế độ tablet 768px, menu mobile bắt đầu co lại với `transition: transform 0.2s ease-in-out`. Test Playwright trước đó chụp màn hình ngay tức thì khi chuyển động co lại mới đi được ~32px, khiến sidebar còn dở dang trên màn hình.
  2. **Thiếu assertion guard trong E2E:** Kịch bản test thiếu bước xác thực menu mobile đã đóng hoàn tất (`.app-sidebar` không còn class `sidebar-open`, backdrop ẩn và tọa độ rect `right <= 0`) trước khi chụp ảnh.
  3. **Khả năng cuộn ngang của bảng kho:** Bảng dữ liệu phiếu nhập, sổ kho biến động và thiết bị IMEI trong `PurchasesPage.tsx` chưa được bọc trong container `.table-responsive-wrapper`.
- **Biện pháp xử lý toàn diện:**
  1. **`AppLayout.tsx`:** Bổ sung lifecycle hooks tự động đóng menu mobile khi chuyển `activeNav`, khi nhấn phím `Escape`, hoặc khi resize màn hình vượt mốc 768px.
  2. **`PurchasesPage.tsx` & `index.css`:** Bọc tất cả 3 bảng dữ liệu kho trong `.table-responsive-wrapper` có `-webkit-overflow-scrolling: touch`, bảo đảm bảng cuộn ngang trơn tru không bị cắt cụt.
  3. **`live-transactions.spec.ts`:**
     - Nâng cấp hàm `navigateTo` và bước chụp ảnh: xác thực `expect(.app-sidebar).not.toHaveClass(/sidebar-open/)`, `sidebar-backdrop` không hiển thị và animation đã kết thúc hoàn toàn (`right <= 0`).
     - Bổ sung bước kiểm thử cuộn ngang: xác minh `scrollWidth > clientWidth` và thao tác cuộn ngang hoạt động chính xác.
  4. Cập nhật lại toàn bộ bằng chứng hình ảnh mới sạch đẹp và chuẩn xác.

---

## 3. Danh sách màn hình & Module bổ sung

| Module | File mã nguồn | API Contract liên kết | Trạng thái |
|---|---|---|---|
| Quản lý Nhập hàng | `src/features/inventory/PurchasesPage.tsx`<br>`src/features/inventory/PurchaseModal.tsx`<br>`src/features/inventory/PurchaseDrawer.tsx` | `GET /purchases`, `POST /purchases`, `GET /purchases/:id`, `GET /stock-movements` | Hoàn thành |
| Điểm bán hàng (POS) | `src/features/pos/POSPage.tsx` | `GET /products`, `GET /devices`, `GET /customers`, `POST /sales` | Hoàn thành |
| Quản lý Bán hàng & In | `src/features/sales/SalesPage.tsx`<br>`src/features/sales/SaleDrawer.tsx` | `GET /sales`, `GET /sales/:id` | Hoàn thành |
| Thu/Chi Công nợ | `src/features/payments/PaymentModal.tsx` | `POST /payments` | Hoàn thành |
| Kiểu dữ liệu TypeScript | `src/types/inventory.ts`<br>`src/types/sales.ts` | — | Hoàn thành |
