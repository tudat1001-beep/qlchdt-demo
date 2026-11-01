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
| T-03 | TERRA | SOL-R2 | Trả/hủy/hoàn nhập/warranty/quỹ/reports; reversal/rounding/race tests |
| A-03 | ANTIGRAVITY | SOL-R2 | UI module còn lại, XLSX, print, PWA; E2E thành công/lỗi và offline |
| SOL-R3 | SOL | T-03,A-03 | Review/merge; QA toàn app, docs vận hành, build, test, mở app thật |

Mỗi task có commit riêng. SOL xem diff trước merge, kiểm tra file boundary và test sau tích hợp. Tài liệu và task log ghi đúng thực tế, không tuyên bố pass khi chưa chạy. Không deploy production.

Điều phối thực tế: backend T-02 được bắt đầu sau khi riêng T-01 đã qua review gate, merge và 24 tests đạt; không phải chờ UI A-01 vì contract đã cố định và file tách biệt. SOL-R1 tổng thể chỉ hoàn tất khi A-01 được review và chạy UI thật. Chi tiết runtime và bằng chứng trong AGENT_TASKS.md.
