# Phân công và trạng thái

SOL là coordinator hiện tại. TERRA ánh xạ agent codex (model mặc định cấu hình, xác minh từ launch). ANTIGRAVITY ánh xạ agent antigravity (model mặc định cấu hình, xác minh từ launch). Không suy tên role là model ID.

Mỗi worker bắt buộc worktree/branch độc lập do Orca tạo; đọc docs và hỏi coordinator bằng Orca ask nếu contract thiếu/sai. Không sửa file của worker khác, không tích hợp feature vào main, không sửa package/lock/config gốc. Được cập nhật main vào feature branch theo chỉ thị SOL. Đề xuất dependency cho SOL. Mỗi module kết thúc bằng commit và worker_done thật, gửi SHA, lệnh kiểm chứng và kết quả. Ngoại lệ sở hữu: shared/money.ts và tests/money.test.ts do SOL trực tiếp viết/kiểm chứng; TERRA chỉ gọi helper.

| Task | Phạm vi sở hữu | Không sửa | Nghiệm thu |
|---|---|---|---|
| T-01/02/03 | server/**, shared/**, docs/DATABASE.md, docs/BACKEND_TESTS.md | src/**, public/**, package*, scripts/** | API theo contract, validation/auth, PostgreSQL tests, SHA review |
| A-01/02/03 | src/**, public/**, index.html, tests/e2e/**, playwright.config.ts, docs/QA*.md | server/**, shared/**, package*, scripts/** | UI tiếng Việt, API thật, responsive, keyboard, E2E, screenshots và console/network evidence |
| SOL | package*, root config, scripts/**, docs thiết kế/vận hành, integration/security cross-module tests | Không làm thay UI/CRUD giao worker | Independent review, atomicity/race checks, integration, app running |

Task dependencies và tiêu chí chi tiết: IMPLEMENTATION_PLAN.md. Runtime IDs, launch effective model, commit và kết quả sẽ ghi dưới đây sau khi có receipt thật.

## Khảo sát
- 2026-11-01: thư mục trống, chưa Git; Node 24.18.0; PostgreSQL 18 sẵn binary, instance hệ thống cần mật khẩu; dùng cluster riêng không đụng hệ thống. Orca 1.4.244 ready, account codex và antigravity available. CLI không có agent list; xác minh agent/model từ account và launch receipts.
- Không có code/graphify corpus để truy vấn trong lần khảo sát đầu.

## Runtime thực tế và kết quả
- Orca Run `run_e88aaef69773`; SOL coordinator `term_6721979e-501d-47b4-806b-a0cae962af24`.
- TERRA: agent codex, model quan sát từ transcript `gpt-6.1-sol` (mặc định cấu hình, high); worktree `C:/Users/My-PC/orca/workspaces/QLCHDT/terra-backend`, branch `task-t-01-baseline`. Tên vai trò TERRA không được giả là model Terra.
- ANTIGRAVITY: agent antigravity, terminal hiển thị Gemini 3.8 Flash medium (mặc định cấu hình); worktree `C:/Users/My-PC/orca/workspaces/QLCHDT/antigravity-ui`, branch `task-a-01`.
- T-01 `task_9c4a45de7cd5`, Dispatch `ctx_08f4a885ebb0`: worker_done succeeded, commit `25155ea`; SOL xem toàn bộ diff trong 17 file, chạy lại 21 tests rồi merge `0329dd9`. Sau merge main chạy 24 tests đạt, migration database sử dụng đạt. Không insert dữ liệu hàng hóa/khách/phiếu giả.
- T-02 `task_03fd14f2d1c8`, Dispatch `ctx_1d7ffa652ee6`: gate `gate_432db4a46900` đã SOL resolve sau review/test T-01; tái sử dụng đúng terminal TERRA, đang triển khai nhập/kho rồi bán/thanh toán theo commit riêng. Giao diện A-01 tiếp tục độc lập theo contract đã cố định.
- A-01 `task_aaeaee27a92b`, Dispatch `ctx_6ef296949ea6`: đang triển khai; chưa tuyên bố E2E đạt.
- Gate tích hợp UI nền `gate_e0c40cc674bd` / task SOL-R1 `task_32f6b03c652e` còn chờ A-01 và kiểm chứng UI.
- `npm audit` sau cập nhật static/Vitest và override glob: 0 vulnerabilities. Script check-local xác nhận hai database tách biệt, role runtime qlchdt_app không superuser/createdb/createrole.
