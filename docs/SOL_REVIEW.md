# SOL — bằng chứng kiểm duyệt độc lập

## T-02 bán hàng/FIFO/công nợ

Commit17eee52 đã review DDL003, sales/payment service và read models liên quan, merge a7523fc. SOL chạy lại `npm run check`: build/typecheck đạt, 50/50 tests đạt (21 foundation,21 giao dịch,3 tiền,5 UI idempotency) trong11.16s. Migration003 chạy trên database sử dụng thành công, không seed chứng từ. Đã chấp thuận backend T-02 và mở gate trả/hủy T-03a; giao diện POS A-02 đang triển khai, chưa nghiệm thu luồng nhập-bán trên UI.

## T-03a và A-02 — kiểm tra lại 2026-11-01

T-03a commit `28f3d30` đã review và merge. Migration004 áp dụng thành công; trả/hủy giữ nguyên chứng từ gốc, ghi phân bổ FIFO/cost, hoàn tồn và công nợ trong transaction. `npm run check` sau merge đạt build và 64 tests; bao gồm 14 test trả/hủy. A-02 commit `c2234bc` và `e5a37ac` đã review phạm vi, API integration, idempotency và báo cáo QA trước merge `c1166d8`. Build/typecheck và 66 tests đạt; E2E Playwright tích hợp chạy lại trực tiếp sau merge đạt 28/28 trong 1.3 phút, trên desktop/tablet/mobile và database `_test` tách biệt. Luồng có nhập điện thoại IMEI + phụ kiện, thanh toán hỗn hợp, bán có nợ, thu nợ, reload kiểm tra tồn kho/IMEI và in.

Follow-up ANTIGRAVITY `3f06482`, merge `4bfcdbb`, xử lý ảnh mobile bị chụp khi sidebar đang chuyển động: đóng drawer khi đổi route/Escape/resize, bọc ba bảng kho trong vùng cuộn ngang, thêm assertions sidebar/scroll và cập nhật ảnh QA. SOL review diff và xem ảnh mobile mới; `npm run check` đạt 66 tests, Playwright đạt lại 28/28 trong 1.3 phút sau merge. Hình ảnh mobile hiện không còn bị menu phủ; bảng cuộn ngang được kiểm chứng qua DOM.

Đã resolve gate cho T-03b. Hoàn nhập nhà cung cấp và bảo hành đang được TERRA triển khai; chưa được review/merge. Chưa kiểm chứng print/PDF trên máy in thực, dùng chức năng in/lưu PDF của trình duyệt. Build cảnh báo bundle JS khoảng744KB minified; chưa chia bundle.

## Nền giao diện A-01 — kiểm tra lại 2026-11-01

Tích hợp commit ANTIGRAVITY 4ff3ace qua merge f9d857d. Đã đọc API client/idempotency, logout, luồng Playwright dùng API thật và xem screenshot mobile sau sửa. `npm run check` trên main đạt build/typecheck và 36 tests; `npm run test:e2e` đạt 27/27 trong 58.9s trên desktop/tablet/mobile, gồm luồng đăng nhập → tạo/sửa sản phẩm → khách/NCC → reload → logout trên PostgreSQL test. Những test mock riêng chỉ chứng minh UI. Gate A-01 và SOL-R1 đã resolve; A-02 đang triển khai.

PostgreSQL riêng đã dừng giữa phiên và được khởi động lại; lỗi ECONNREFUSED ban đầu là lỗi môi trường, kiểm tra lại sau khởi động đạt. T-02 cũ dừng do provider usage limit (terminal thể hiện rõ), đã fence Dispatch cũ và tiếp tục đúng task/worktree bằng Dispatch mới ctx_692dac4e8dfe, bảo toàn mọi file chưa commit. ANTIGRAVITY A-02 Dispatch ctx_8c9fe016e6a5. Chưa nghiệm thu sales hoặc giao diện nhập/POS tại mốc này.

Local app dùng cổng 5175 vì 5173 thuộc dự án khác đang chạy; không tắt server dự án đó. API3001 và web5175 đã kiểm HTTP thành công. Build còn cảnh báo bundle JS590KB, chưa tối ưu chia bundle. PWA mới có manifest nền, chưa hoàn tất service worker/cài đặt.

## Nền backend T-01

Ngày 2026-11-01, commit TERRA 25155ea, merge 0329dd9. Đã xem diff 17 file, schema/constraints/index, auth/session/origin/rate limiter, migration checksum/advisory lock, validation, SQL parameter binding, transaction cleanup, idempotency và test. Không sửa UI/CRUD đã giao worker.

- Chạy độc lập tại worktree TERRA: `node node_modules/vitest/vitest.mjs run server/foundation.test.ts`: 21/21 đạt, 5.86s.
- Sau merge trên main: `npm test`: 24/24 đạt, gồm 21 backend + 3 SOL financial invariant tests, 6.10s.
- `npm run db:migrate`: thành công, 1 migration mới, bootstrap manager; database sử dụng không có seed hàng hóa/khách/đơn.
- API thật chạy qua Orca terminal trên 127.0.0.1:3001. HTTP asserts đạt: public health200; products anonymous401; login200; authenticated product list rỗng; no-store; API missing404; logout200; session cũ401.
- `node scripts/check-local.mjs`: hai database app/test khác nhau, runtime role không có superuser/createdb/createrole, bootstrap role không đăng nhập được.
- `node scripts/postgres.mjs setup` chạy lại không xóa dữ liệu. `backup` tạo dump; khôi phục dump đã migrate vào database tạm mới tên qlchdt_restore_<random>_test, đối chiếu users=1, products=0, schema_migrations=1; xóa đúng database tạm vừa tạo sau kiểm tra. Không ghi đè hoặc reset database sử dụng.
- `npm audit`: 0 vulnerabilities sau cập nhật @fastify/static10.1.8/Vitest5.0.5 và override glob14.0.2.

Chấp thuận foundation backend. Chưa chấp thuận toàn ứng dụng: UI, nhập/bán/trả/bảo hành/báo cáo/PWA chưa hoàn tất tại mốc này. Auth HTTPS kiểm tra bằng inject; chưa kiểm tra HTTPS trên thiết bị thật.

## Quyết định từ review

- Backend và UI giữ identifiers sản phẩm bất biến khi PATCH; không DELETE dữ liệu lịch sử.
- SKU/model có thể lặp qua nhiều dòng nhập để giá vốn từng máy cũ khác nhau; IMEI toàn cục không trùng. Phụ kiện bán gộp một dòng/SKU, nhiều điện thoại cùng model có thể khác device_id.
- SOL sở hữu shared/money.ts: BigInt intermediate, checked sums/products; discount bảo toàn tổng và không âm dòng; partial returns dùng giá trị lũy kế. Tests duyệt nhiều tổ hợp nhỏ và biên MAX_SAFE_INTEGER.
- Giao ANTIGRAVITY sửa idempotency trước parse response, loại TTL, giữ khóa chưa rõ kết quả qua reload bằng hash; sửa logout thất bại và focus containment của modal/drawer. Những điểm này chờ evidence UI trước gate A-01.
