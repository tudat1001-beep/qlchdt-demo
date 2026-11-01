# SOL — thiết kế giao dịch và phản biện trước T-02/03

Các quy tắc sau bổ sung contract, không thêm endpoint. TERRA triển khai và gửi SOL phản biện nếu cần thay đổi.

## Thứ tự khóa

Idempotency advisory lock → product rows theo UUID tăng dần → chứng từ gốc → device rows theo UUID → lots theo created_at/id. Mọi luồng thay đổi tồn tuân cùng thứ tự. Có thể đọc dòng chứng từ immutable trước khóa để tìm product IDs, sau khóa đọc lại trạng thái/returned quantity. Thu/chi nợ chỉ khóa chứng từ và không lấy khóa sản phẩm nên không tạo chu kỳ ngược. Không dùng phép đọc tồn rồi cập nhật ở transaction khác.

Khóa idempotency và INSERT response phải trong cùng transaction kinh doanh. Hash từ payload JSON chuẩn hóa và operation/path, gắn actor; không lưu key khi rollback. Client giữ key khi response bị mất/chưa parse được. Cùng payload với key mới là giao dịch mới có chủ ý. Giới hạn thời gian chờ lock/query và ánh xạ deadlock/timeout sang lỗi có thể thử lại; không báo thành công trước COMMIT.

## Số nguyên và phân bổ

Dùng BigInt khi nhân/chia phân bổ; chỉ đổi sang number sau khi kiểm tra <= MAX_SAFE_INTEGER. Không cộng tiền bằng float rồi làm tròn. Tổng/giá vốn có thể vượt ngưỡng dù từng trường hợp lệ, phải kiểm tra trước ghi.

Chi phí nhập chia theo tổng số đơn vị N: extra mỗi đơn vị = extra_cost div N; r = extra_cost mod N. Đúng r đơn vị đầu theo thứ tự dòng/thiết bị nhận thêm 1 đồng. Với phụ kiện tạo nhiều nhất hai nhóm giá vốn đơn vị khác nhau; không gộp làm mất đồng. Tổng cost nhận = tổng quantity×unit_cost + extra_cost.

Chiết khấu phiếu D chia theo giá trị gộp dòng Gi: di = floor(D×Gi/sum(G)). Phân đồng dư cho dòng có Gi>0 theo thứ tự đến hết, không cho discount dòng vượt Gi. D=0 và tổng G=0 không chia cho 0. Tất cả di cộng bằng D, tổng net line bằng total. Server lưu di và snapshot net/cost.

Trả phụ kiện từng phần phải dùng giá trị lũy kế: target_net_returned(q) = floor(original_net×q/original_quantity); giá trị lần này = target(q_trước+q_mới)−target(q_trước). Do đó trả từng chiếc hoặc trả cả dòng cho cùng tổng tiền. Giá vốn trả lấy từ phân bổ FIFO bán gốc theo thứ tự ổn định và lượng đã trả, không dùng giá nhập/giá vốn hiện tại.

## Nợ và hoàn tiền

Ở thời điểm trả: V là giá trị trả; debt_before là công nợ chưa thu còn lại sau các trả/thu trước. debt_reduction=min(V,debt_before); refund=V−debt_reduction. Không tạo một khoản thu giả để giảm nợ. Cập nhật trạng thái và ledger có liên kết return_id; tổng thanh toán thu ròng sau hoàn phản ánh tiền thực.

Hoàn nhập tương tự ở phía NCC. Chỉ nhận hoàn tiền cho phần đã chi; giá trị giảm phải trả không tạo tiền vào quỹ. Chi phí mua đã phân bổ được coi là phần giá vốn được hoàn trong chính sách v1; UI phải hiển thị giá trị server tính. Nhà cung cấp thực tế hoàn khác giá vốn phải ghi chênh lệch bằng chi phí/thu khác riêng có lý do.

## Lịch sử và vòng đời

Không dùng UNIQUE(device_id) vĩnh viễn trên sale_lines vì máy có thể bán→trả→bán lại. Nếu cần unique active allocation dùng partial index cho phân bổ đang active, đồng thời khóa device và kiểm tra available. IMEI UNIQUE vĩnh viễn trên devices. Giữ tất cả sale_lines cũ và stock_movements.

Hủy chứng từ không DELETE, tạo reversal cho phần còn lại; hủy sau trả một phần không đảo lần hai phần đã trả. Bảo hành máy khách giữ sold; máy cửa hàng quarantine phải có action explicit để available và ghi audit. Một máy không mở hai hồ sơ warranty còn hoạt động.

## Bằng chứng yêu cầu

Test thật: parallel sale cùng IMEI, parallel sale chiếc phụ kiện cuối; same-key parallel; lỗi sau ghi stock nhưng trước payment/audit rollback; BigInt/discount/extra-cost bảo toàn đồng; partial returns 1+1+1 so với full; sold→return→resale; concurrent return/payment; supplier return chỉ dùng đúng lot còn tồn. SOL kiểm tra test bằng PostgreSQL và kiểm tra counterexamples trước merge.
