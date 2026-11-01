# Kế hoạch và nghiệm thu

| ID | Owner | Dependency | Module / điều kiện hoàn thành |
|---|---|---|---|
| SOL-00 | SOL | — | Khảo sát, Git, môi trường PostgreSQL riêng, contract; 6 docs có thể review |
| T-01 | TERRA | SOL-00 | Migration/auth/catalog/parties API; auth negative, duplicate SKU, migration repeat tests |
| A-01 | ANTIGRAVITY | SOL-00 | App shell/login/catalog/parties UI gắn API; responsive, keyboard, build |
| SOL-R1 | SOL | T-01,A-01 | Review diff, test, merge vào main |
| T-02 | TERRA | SOL-R1 | Nhập kho/IMEI/FIFO/POS/payments; rollback/race/idempotency tests PostgreSQL |
| A-02 | ANTIGRAVITY | SOL-R1 | Nhập/POS/hóa đơn/customer history; E2E luồng mua-bán-thu nợ |
| SOL-R2 | SOL | T-02,A-02 | Review invariant tài chính và đồng thời, merge khi test pass |
| T-03a | TERRA | T-02 | Trả/hủy bán hàng; FIFO, công nợ, hoàn tồn, audit/idempotency; hoàn thành `28f3d30`, SOL đã kiểm tra migration và tests |
| A-02 | ANTIGRAVITY | T-02 API | Nhập hàng, POS, hóa đơn, thu nợ; hoàn thành `e5a37ac` + `c2234bc`, SOL đã kiểm tra 28 E2E |
| A-02-QA1 | ANTIGRAVITY | A-02 | Sửa trạng thái drawer/table responsive; hoàn thành `3f06482`, SOL đã kiểm tra lại 28 E2E và ảnh mobile |
| T-03b | TERRA | T-03a | Hoàn nhập NCC và bảo hành API; hoàn thành `4b6e4de`, merge `3cbd6d5` |
| T-04 | TERRA | T-03b | Sổ quỹ, báo cáo tài chính, tồn kho, công nợ API; hoàn thành `66147e2`, merge `b022fa7` |
| T-05 | SOL | T-04 | E2E login rate limit riêng trong guarded test server; hoàn thành `d71348e`, merge `05e2994`; mặc định vẫn 5 lần/15 phút |
| A-03a | ANTIGRAVITY | T-03b API | UI trả/hủy, bảo hành, hoàn nhập NCC; hoàn thành `a24f9e6` + `ef3b4e9`, merge `5ba3814`; responsive E2E đã kiểm tra |
| A-03b | ANTIGRAVITY | T-04 API | Sổ quỹ/báo cáo, XLSX, PWA online-first; hoàn thành `86ce76b` + `e5339a5`, merge `bd0caaa`; desktop/tablet/mobile E2E |
| SOL-R3 | SOL | T-03b,T-04,A-03a,A-03b | Hoàn thành review/merge, `npm run check` (81 tests), full E2E (34 tests), tài liệu QA và kiểm tra runtime local; không deploy production. Còn cảnh báo bundle JS 1.26 MB |

Mỗi task có commit riêng. SOL xem diff trước merge, kiểm tra file boundary và test sau tích hợp. Tài liệu và task log ghi đúng thực tế, không tuyên bố pass khi chưa chạy. Không deploy production.

Điều phối thực tế: backend T-02 được bắt đầu sau khi riêng T-01 đã qua review gate, merge và 24 tests đạt; không phải chờ UI A-01 vì contract đã cố định và file tách biệt. SOL-R1 tổng thể chỉ hoàn tất khi A-01 được review và chạy UI thật. Chi tiết runtime và bằng chứng trong AGENT_TASKS.md.
