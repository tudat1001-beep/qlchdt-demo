# Phân công và trạng thái

SOL là coordinator hiện tại. TERRA ánh xạ agent codex (model mặc định cấu hình, xác minh từ launch). ANTIGRAVITY ánh xạ agent antigravity (model mặc định cấu hình, xác minh từ launch). Không suy tên role là model ID.

Mỗi worker bắt buộc worktree/branch độc lập do Orca tạo; đọc docs và hỏi coordinator bằng Orca ask nếu contract thiếu/sai. Không sửa file của worker khác, không merge main, không sửa package/lock/config gốc. Đề xuất dependency cho SOL. Mỗi module kết thúc bằng commit và worker_done thật, gửi SHA, lệnh kiểm chứng và kết quả.

| Task | Phạm vi sở hữu | Không sửa | Nghiệm thu |
|---|---|---|---|
| T-01/02/03 | server/**, shared/**, docs/DATABASE.md, docs/BACKEND_TESTS.md | src/**, public/**, package*, scripts/** | API theo contract, validation/auth, PostgreSQL tests, SHA review |
| A-01/02/03 | src/**, public/**, index.html, tests/e2e/**, playwright.config.ts, docs/QA*.md | server/**, shared/**, package*, scripts/** | UI tiếng Việt, API thật, responsive, keyboard, E2E, screenshots và console/network evidence |
| SOL | package*, root config, scripts/**, docs thiết kế/vận hành, integration/security cross-module tests | Không làm thay UI/CRUD giao worker | Independent review, atomicity/race checks, integration, app running |

Task dependencies và tiêu chí chi tiết: IMPLEMENTATION_PLAN.md. Runtime IDs, launch effective model, commit và kết quả sẽ ghi dưới đây sau khi có receipt thật.

## Khảo sát
- 2026-11-01: thư mục trống, chưa Git; Node 24.18.0; PostgreSQL 18 sẵn binary, instance hệ thống cần mật khẩu; dùng cluster riêng không đụng hệ thống. Orca 1.4.244 ready, account codex và antigravity available. CLI không có agent list; xác minh agent/model từ account và launch receipts.
- Không có code/graphify corpus để truy vấn trong lần khảo sát đầu.
