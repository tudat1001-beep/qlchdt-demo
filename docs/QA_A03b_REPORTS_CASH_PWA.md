# Báo cáo QA & Nghiệm thu Giao diện Sổ quỹ, Báo cáo tài chính, Xuất Excel & PWA (Task A-03b)

- **Người thực hiện:** ANTIGRAVITY (Frontend UX & QA Owner)
- **Người giám sát:** SOL (Coordinator)
- **Phạm vi nhiệm vụ:** Task A-03b — Tích hợp Sổ quỹ Tiếng Việt (`GET /cash`, `POST /cash`), Dashboard Báo cáo tài chính (`GET /reports`), Xuất bảng tính Excel (`xlsx`), PWA Online-First có Service Worker & Manifest hoàn chỉnh, Cơ chế hiển thị trạng thái mạng & từ chối ghi ngoại tuyến, và Kiểm định luồng in hóa đơn bán lẻ.
- **Thời điểm nghiệm thu:** 2026-11-01
- **Môi trường & Công nghệ:** Node.js 24.18.0, PostgreSQL 18 (Database `_test` bảo vệ), React 19, TypeScript, Vite 7.3.7, SheetJS (`xlsx` 0.20.3), Playwright E2E.

---

## 1. Tổng quan Kiến trúc UX & Quy trình Nghiệp vụ

### 1.1 Sổ quỹ Thu chi (`CashbookPage.tsx`, `CashEntryModal.tsx`)
- **Vị trí tích hợp:** Thanh điều hướng Sidebar mục **"Sổ quỹ thu chi"** (icon `Wallet`).
- **Thẩm quyền tính toán máy chủ (Server Calculation Authority):**
  - Hiển thị 3 thẻ số dư chính thức được tính toán trực tiếp từ máy chủ:
    1. **Tiền mặt tại quỹ (`cash_balance`):** Dòng tiền mặt thực tế sau các nghiệp vụ thu/chi tiền mặt.
    2. **Tài khoản ngân hàng (`bank_balance`):** Dòng tiền chuyển khoản ngân hàng.
    3. **Tổng tồn quỹ thực tế:** Tổng giá trị tiền mặt và tiền gửi ngân hàng hiện có.
  - Tuyệt đối không tự ý fallback hay cộng trừ số dư client-side.
- **Bảng kê giao dịch chuẩn MISA:**
  - Liệt kê đầy đủ mọi dòng tiền phát sinh từ bán hàng, trả hàng, nhập hàng, trả hàng NCC, thu nợ, chi nợ và chi phí/thu nhập thủ công.
  - Phân loại rõ ràng: Tiền vào / Thu (`in`, màu xanh lá `+... ₫`) và Tiền ra / Chi (`out`, màu cam/đỏ `-... ₫`).
  - Hỗ trợ bộ lọc tìm kiếm theo từ khóa, chiều tiền (Thu/Chi), hình thức thanh toán (Tiền mặt/Chuyển khoản).
- **Lập phiếu thu / chi thủ công (`CashEntryModal.tsx`):**
  - Hỗ trợ ghi nhận nghiệp vụ chi phí hoạt động (`expense`) và thu nhập khác (`other_income`).
  - Ràng buộc nghiệp vụ nghiêm ngặt theo backend:
    - `direction = 'out'` gắn cố định danh mục `expense`.
    - `direction = 'in'` gắn cố định danh mục `other_income`.
  - Kiểm tra tính hợp lệ: Bắt buộc số tiền nguyên dương VND (`> 0` và `<= Number.MAX_SAFE_INTEGER`), hiển thị lỗi trực quan nếu nhập sai.
  - Gắn header `Idempotency-Key` bảo vệ chống tạo trùng phiếu khi gửi form.

### 1.2 Báo cáo Tài chính & Hoạt động Kinh doanh (`ReportsPage.tsx`)
- **Vị trí tích hợp:** Thanh điều hướng Sidebar mục **"Báo cáo tài chính"** (icon `BarChart3`).
- **8 Chỉ số tài chính cốt lõi hiển thị tách bạch & máy chủ dẫn xuất (Server-Derived Authority):**
  1. **Doanh thu thuần (`revenue`):** Doanh thu thực tế sau khi đã khấu trừ doanh thu hàng bán trả lại.
  2. **Tiền thực thu (`collected`):** Dòng tiền thực tế thu từ khách (đã trừ hoàn tiền). **Hiển thị tách biệt hoàn toàn với Doanh thu thuần** để tránh nhầm lẫn giữa ghi nhận doanh thu và dòng tiền thực tế.
  3. **Giá vốn hàng bán (`cost` - COGS):** Giá vốn thực tế xuất kho theo phương pháp FIFO do máy chủ tính toán.
  4. **Lợi nhuận gộp (`gross_profit`):** `revenue - cost` do máy chủ kết xuất.
  5. **Chi phí hoạt động (`expenses`):** Tổng chi phí phát sinh ghi nhận trong sổ quỹ.
  6. **Công nợ khách hàng (`customer_debt`):** Nợ khách hàng lũy kế đến hết ngày kết thúc kỳ báo cáo.
  7. **Công nợ nhà cung cấp (`supplier_debt`):** Nợ NCC lũy kế đến hết ngày kết thúc kỳ báo cáo.
  8. **Giá trị tồn kho (`stock_value`):** Tổng giá trị thiết bị và phụ kiện hiện có trong kho.
- **Bộ chọn kỳ báo cáo linh hoạt:**
  - Hỗ trợ các mốc thời gian nhanh: "Hôm nay", "7 ngày qua", "30 ngày qua", "Tháng này".
  - Cho phép tùy chọn ngày bắt đầu (`from`) và ngày kết thúc (`to`) theo chuẩn ISO `YYYY-MM-DD`, chặn trường hợp `from > to`.
- **Hệ thống bảng phân tích chi tiết:**
  - **Tab 1: Doanh thu & Lợi nhuận theo ngày (`daily`):** Chi tiết doanh thu, giá vốn, lãi gộp từng ngày.
  - **Tab 2: Top 10 sản phẩm bán chạy (`best_sellers`):** Tên sản phẩm, số lượng đã bán, doanh thu mang lại.
  - **Tab 3: Cảnh báo tồn kho thấp (`low_stock`):** Cảnh báo các mặt hàng chạm hoặc dưới định mức an toàn (`stock_quantity <= min_stock`).

### 1.3 Xuất dữ liệu Bảng tính Excel (`src/lib/export-excel.ts`)
- Sử dụng thư viện `xlsx` cài đặt sẵn trong dự án.
- **Bảo toàn số nguyên VND và định dạng ngày tháng:**
  - Các ô tiền tệ lưu trữ dưới dạng số nguyên thuần túy (`cell.t = 'n'`), kèm định dạng hiển thị `z = '#,##0'`, cho phép người dùng mở file Excel thực hiện tính toán hàm `SUM`, `AVERAGE` mà không bị lỗi kiểu chuỗi ký tự.
  - Ngày tháng được chuẩn hóa theo múi giờ `Asia/Ho_Chi_Minh` (`formatDateTime`).
- **Xuất Sổ quỹ:** Tệp `so-quy-YYYY-MM-DD.xlsx` gồm đầy đủ tiêu đề, số dư đầu kỳ, bảng kê giao dịch.
- **Xuất Báo cáo Tài chính Đa Sheet:** Tệp `bao-cao-tai-chinh-[from]-den-[to].xlsx` gồm 4 Sheet:
  1. `Tong_Hop_Tai_Chinh`: Tổng hợp 8 chỉ số kinh doanh chính.
  2. `Doanh_Thu_Theo_Ngay`: Bảng doanh thu, giá vốn, lãi gộp từng ngày.
  3. `Top_Ban_Chay`: Top sản phẩm đóng góp doanh thu lớn nhất.
  4. `Canh_Bao_Ton_Kho`: Danh sách sản phẩm cần nhập thêm hàng.

### 1.4 Hoàn thiện PWA Online-First & Cơ chế Ngoại tuyến An toàn
- **Web App Manifest (`public/manifest.json`):**
  - Cấu hình chuẩn installable PWA: `display: standalone`, `orientation: any`, `theme_color: #0f172a`.
  - Bộ biểu tượng chất lượng cao SVG đa kích thước: `favicon.svg`, `icon-192.svg` (192x192), `icon-512.svg` (512x512) với mục đích `any maskable`.
- **Service Worker (`public/sw.js`):**
  - Tuân thủ nguyên tắc **Online-First an toàn tài chính**:
    - **Chỉ lưu đệm (cache) App Shell và tài nguyên tĩnh** (HTML, CSS, JS, SVG, Fonts, Manifest).
    - **Tuyệt đối không lưu đệm hoặc xếp hàng (queue) các API biến động tài chính (`/api/*`, POST/PATCH/DELETE).**
    - **Không bao giờ giả mạo ghi nhận thành công khi ngoại tuyến (Never claim offline financial writes succeeded).**
  - Dọn dẹp cache phiên bản cũ (`caches.delete`) an toàn, chỉ tác động vào namespace của ứng dụng (`qlchdt-*`).
  - Hỗ trợ tải lại giao diện SPA khi ngoại tuyến (`caches.match('/index.html')`).
- **Chỉ báo Trạng thái Mạng Trực quan (`Header.tsx`, `AppLayout.tsx`):**
  - Badge trạng thái kết nối trên Header:
    - Xanh lá: `Trực tuyến` (`.online`).
    - Đỏ cảnh báo: `Ngoại tuyến (Chỉ xem)` (`.offline`).
  - Banner cảnh báo dính (sticky banner) khi mất kết nối mạng: Thông báo rõ ràng hệ thống đang ở chế độ chỉ đọc.
  - Mọi thao tác lập phiếu thu/chi tài chính khi ngoại tuyến đều bị từ chối ngay lập tức kèm thông báo lỗi rõ ràng.

### 1.5 Kiểm tra In Hóa đơn Trình duyệt & Định dạng PDF (`SaleDrawer.tsx`, `@media print`)
- Giữ nguyên luồng in hóa đơn chuẩn qua `window.print()`.
- Định dạng in ấn sạch sẽ:
  - Tự động ẩn toàn bộ UI điều hướng, sidebar, header, các nút bấm thao tác (`.no-print`, `.app-sidebar`, `.app-header`).
  - Giữ lại khung hóa đơn bán hàng chuẩn khổ giấy in (`.printable-invoice`) hiển thị đầy đủ thông tin cửa hàng, khách hàng, mã hóa đơn, danh sách máy/IMEI, giá bán, tiền thanh toán và công nợ.

---

## 2. Kết quả Kiểm thử Tự động & Bằng chứng Nghiệm thu

### 2.1 Backend & Unit Tests (`npm test` / Vitest)
Toàn bộ 80 bài kiểm thử backend và unit tests chạy trên cơ sở dữ liệu `_test` độc lập đều vượt qua:
```
 ✓ server/transactions.test.ts (45 tests) 5949ms
 ✓ server/foundation.test.ts (21 tests) 5714ms
 ✓ server/cash-reports.test.ts (4 tests) 1971ms
 ✓ tests/money.test.ts (3 tests) 95ms
 ✓ tests/ui/idempotency.test.ts (7 tests) 33ms

 Test Files  5 passed (5)
      Tests  80 passed (80)
   Duration  17.06s
```

### 2.2 TypeScript & Production Build (`npm run check`)
```
> qlchdt@1.0.0 build
> tsc --noEmit && vite build

✓ 1675 modules transformed.
dist/index.html                     0.78 kB │ gzip:   0.45 kB
dist/assets/index-Cz1sj8sL.css     17.83 kB │ gzip:   4.23 kB
dist/assets/index-B8FAtDoK.js   1,349.55 kB │ gzip: 325.16 kB
✓ built in 6.97s
```

### 2.3 E2E Integration Tests (`tests/e2e/reports-cash-pwa.spec.ts`)
Kiểm thử toàn diện luồng nghiệp vụ trên cơ sở dữ liệu `_test` thật thông qua máy chủ `scripts/e2e-server.mjs`:
1. **Desktop Chrome (1280x720):** **PASSED** (11.0s)
2. **Tablet Chrome (768x1024):** **PASSED** (13.9s)
3. **Mobile Chrome (Pixel 5 - 393x851):** **PASSED** (14.7s)

Nội dung kiểm tra chi tiết trong spec:
- Xác thực file `manifest.json` và tải về thành công các biểu tượng 192x192 và 512x512.
- Đăng ký và kiểm tra Service Worker hoạt động trong trình duyệt.
- Tải số liệu Sổ quỹ thực tế từ API và đối soát 3 thẻ số dư (`cash_balance`, `bank_balance`, tổng tồn quỹ).
- Xác thực lỗi nhập tiền `<= 0` và lưu trữ thành công phiếu chi phí hoạt động thủ công qua `POST /api/cash`.
- Xuất tệp `so-quy-*.xlsx`, kiểm tra cấu trúc sheet `So_Quy` và kiểu dữ liệu số nguyên VND.
- Đối soát 8 thẻ chỉ số tài chính của `GET /api/reports`, kiểm tra tính tách biệt giữa Thực thu và Doanh thu thuần.
- Kiểm tra các tab báo cáo theo ngày, top sản phẩm bán chạy, cảnh báo tồn kho thấp.
- Xuất tệp `bao-cao-tai-chinh-*.xlsx`, kiểm tra 4 sheets và các giá trị số nguyên.
- Giả lập ngắt kết nối mạng (`context.setOffline(true)`): Kiểm tra badge chuyển sang "Ngoại tuyến (Chỉ xem)", banner cảnh báo xuất hiện, thao tác ghi sổ quỹ bị từ chối với thông báo lỗi.
- Khôi phục mạng (`context.setOffline(false)`): Badge quay lại "Trực tuyến".
- Kiểm định CSS in hóa đơn (`@media print`): Sidebar, header và các nút `.no-print` ẩn (`display: none`), phần hóa đơn `.printable-invoice` hiển thị (`display: block`).

---

## 3. Ảnh chụp Màn hình Minh chứng Giao diện (Responsive Screenshots)

Các tệp ảnh chụp thực tế từ luồng Playwright được lưu trữ tại `tests/e2e/screenshots/`:
1. `tests/e2e/screenshots/desktop1280-cashbook.png`: Giao diện Sổ quỹ thu chi trên máy tính để bàn (1280x720).
2. `tests/e2e/screenshots/desktop1280-reports.png`: Dashboard Báo cáo tài chính & 8 thẻ chỉ số trên desktop (1280x720).
3. `tests/e2e/screenshots/tablet768-cashbook.png`: Bảng kê sổ quỹ và bố cục cuộn ngang trên Tablet (768x1024).
4. `tests/e2e/screenshots/mobile393-reports.png`: Bố cục đáp ứng co giãn thẻ chỉ số và menu trượt trên Mobile (393x851).

---

## 4. Kết luận Nghiệm thu
- Toàn bộ các yêu cầu của Task A-03b đã được hiện thực hóa đầy đủ, chính xác, không dùng dữ liệu giả lập (mock/placeholder).
- Tuân thủ tuyệt đối phạm vi phân quyền (`src/**`, `public/**`, `index.html`, `tests/e2e/**`, `docs/QA*.md`), không chỉnh sửa mã nguồn backend, migration hay package.json.
- Sẵn sàng bàn giao cho SOL thực hiện đánh giá tích hợp (SOL Review) và hoàn tất nghiệm thu toàn diện hệ thống.
