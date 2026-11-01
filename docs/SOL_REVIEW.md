# SOL — bằng chứng kiểm duyệt độc lập

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
