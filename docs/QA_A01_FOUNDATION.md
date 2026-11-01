# Báo cáo QA & Kiểm thử Frontend Foundation (Task A-01)

- **Người thực hiện:** ANTIGRAVITY (Frontend UX & QA Owner)
- **Người giám sát:** SOL (Coordinator)
- **Phạm vi:** Task A-01 — App Shell, Xác thực, Danh mục Hàng hóa & Thiết bị, Đối tác Khách hàng & Nhà cung cấp
- **Thời điểm nghiệm thu:** 2026-11-01
- **Trạng thái tích hợp:** Backend độc lập chưa merge vào nhánh hiện tại; frontend đã hoàn thành xây dựng và chuẩn bị toàn diện bộ kiểm thử Playwright bám sát `API_CONTRACT.md`.

---

## 1. Tổng quan giao diện & Thiết kế

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
  - Tích hợp các tab lịch sử mua/bán, chứng từ thanh toán và bảo hành liên quan.
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

## 4. Kịch bản kiểm thử Playwright E2E đã chuẩn bị

Toàn bộ test suite được lưu trong thư mục `tests/e2e/`:

1. **`tests/e2e/auth.spec.ts`**:
   - Kiểm tra hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực (mã 401).
   - Kiểm tra điều hướng phím `Enter` giữa ô tài khoản và mật khẩu.
   - Kiểm tra thông báo lỗi khi thông tin đăng nhập không hợp lệ.
   - Kiểm tra chuyển sang giao diện quản trị với sidebar sau khi đăng nhập thành công.

2. **`tests/e2e/catalog.spec.ts`**:
   - Kiểm tra bảng MISA compact hiển thị đúng định dạng tiền VND và nhãn phân loại (Điện thoại/Phụ kiện).
   - Kiểm tra sắp xếp cột dữ liệu.
   - Kiểm tra mở modal thêm sản phẩm, chuyển focus bằng phím Enter và đóng bằng Escape.
   - Kiểm tra tính bất biến của SKU và loại hàng khi mở form sửa sản phẩm.

3. **`tests/e2e/parties.spec.ts`**:
   - Kiểm tra bảng danh sách khách hàng và nhà cung cấp.
   - Kiểm tra hiển thị công nợ nổi bật.
   - Kiểm tra mở ngăn trượt (Drawer) chi tiết và xem các tab lịch sử giao dịch.
   - Kiểm tra đóng Drawer bằng phím Escape.

---

## 5. Kết quả kiểm tra Build & Typecheck

Lệnh thực thi kiểm tra:
```sh
npm run build
```
Kết quả:
```
> qlchdt@1.0.0 build
> tsc --noEmit && vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 1649 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.72 kB │ gzip:  0.43 kB
dist/assets/index-txAMyzvH.css   14.92 kB │ gzip:  3.61 kB
dist/assets/index-BS8AYNM3.js   313.12 kB │ gzip: 92.04 kB
✓ built in 4.61s
```
TypeScript biên dịch không có lỗi nào (`0 errors`). Bundle sản xuất hoàn chỉnh sẵn sàng phục vụ tĩnh từ Fastify backend hoặc Vite server.

---

## 6. Giới hạn thực tế & Ghi nhận bàn giao

- **Backend chưa merge:** Nhánh backend của TERRA đang chạy độc lập và chưa được SOL merge vào mã nguồn chính. Do đó, các kịch bản kiểm thử E2E hiện tại được chuẩn bị với mock bám sát `API_CONTRACT.md`. ANTIGRAVITY cam kết không báo "Live E2E passed" trước khi backend thật sẵn sàng trong đợt tích hợp SOL-R1.
- **Phạm vi A-01:** Hoàn thành toàn diện Foundation theo đúng yêu cầu; không thêm logic tính toán kho/tiền giả ở frontend; các module tiếp theo (Bán hàng POS, Nhập kho theo lô, Đổi trả, Báo cáo) sẽ được triển khai ở các task A-02 và A-03 sau mốc SOL-R1.
