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
- Orca Run `run_e88aaef69773`; active coordinator `term_a54b26aa-d56d-4ff4-aa21-560ae7c2f472`.
- TERRA được ánh xạ sang agent Codex trong worktree `C:/Users/My-PC/orca/workspaces/QLCHDT/terra-backend`, branch `task-t-01-baseline`. ANTIGRAVITY được ánh xạ sang agent antigravity trong worktree `C:/Users/My-PC/orca/workspaces/QLCHDT/antigravity-ui`, branch `task-a-02`. Vai trò không đồng nghĩa model ID.
- T-01 `task_9c4a45de7cd5`: commit `25155ea`, merge `0329dd9`; SOL review diff và 21 tests. Foundation sau tích hợp: 24 tests, migration và auth API kiểm tra đạt.
- A-01 `task_aaeaee27a92b`: commit `4ff3ace`, merge `f9d857d`; 36 unit/integration tests và 27 E2E đạt desktop/tablet/mobile.
- T-02 `task_03fd14f2d1c8`: commit `17eee52`, merge `a7523fc`; backend nhập/FIFO/bán/thu nợ, SOL độc lập chạy 50 tests đạt.
- A-02 `task_6000bc32d973`: commits `e5a37ac`, `c2234bc`, merge `c1166d8`; nhập hàng, kho, POS, hóa đơn, thu nợ. SOL độc lập chạy build + 66 tests và 28 E2E trên DB test đạt.
- T-03a `task_10a888efbcac`: commit `28f3d30`, merge `226f8ff`; migration004, trả/hủy bán hàng. SOL áp dụng migration và chạy build + 64 tests đạt.
- T-03b `task_4119abfa5439`, Dispatch `ctx_73423707f405`: đang làm hoàn nhập NCC và bảo hành trong cùng worktree backend. Gate `gate_dbe60feed08e` đã resolve sau review T-03a. Chưa có commit nghiệm thu.
- Tiếp theo: SOL review/merge T-03b; lập task riêng cho sổ quỹ/báo cáo và UI bảo hành/trả hàng/PWA/XLSX; kiểm thử lại đầy đủ trước khi gọi ứng dụng hoàn thiện.
- `npm audit`: 0 vulnerabilities tại lần kiểm tra gần nhất. `scripts/check-local.mjs` xác nhận hai database tách biệt và runtime role qlchdt_app không superuser/createdb/createrole. Không có dữ liệu giả được seed vào DB dùng thường.
