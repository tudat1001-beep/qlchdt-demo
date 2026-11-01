# Quy tắc nghiệp vụ — phiên bản 1

Phạm vi: một cửa hàng, một tài khoản quản lý. Online-first. Không seed hàng hóa/đơn hàng giả trong database sử dụng. Đây là sổ quản trị nội bộ, phiếu bán không thay thế hóa đơn điện tử thuế.

## Bất biến
- Mọi khoản tiền là số nguyên VND không âm, nằm trong Number.MAX_SAFE_INTEGER; database BIGINT và CHECK. Không dùng float cho tiền. Giới hạn đầu vào và kiểm tra tổng phép tính.
- IMEI là chuỗi 15 chữ số, UNIQUE toàn cục, giữ nguyên định danh thiết bị suốt vòng đời. Không xóa thiết bị hoặc chứng từ đã ghi sổ.
- Điện thoại: available → sold → available/quarantine qua trả hàng; quarantine → available qua xử lý bảo hành/kiểm tra có ghi audit. Hoàn nhập available → returned_supplier. Không bán quarantine/returned_supplier.
- Một máy chỉ thuộc một dòng bán đang hiệu lực; khóa hàng trong transaction, kiểm tra trạng thái trước cập nhật. Phụ kiện FIFO theo lô nhập, khóa các lô theo thứ tự ổn định. Không âm tồn.
- Mỗi phiếu nhập/bán/trả/hoàn nhập/thu nợ/chi là transaction nguyên tử gồm chứng từ, dòng, thanh toán, ledger kho/quỹ/công nợ, audit và idempotency. Lỗi bất kỳ phải rollback toàn bộ.
- Mọi POST nghiệp vụ nhận Idempotency-Key: UUID. Cùng khóa/cùng nội dung trả kết quả cũ; cùng khóa/khác nội dung trả 409. Key và kết quả ghi trong cùng transaction. Không thực thi hai lần khi gửi đồng thời.
- Dữ liệu gốc và sổ kho/quỹ/audit append-only; điều chỉnh bằng chứng từ đảo có liên kết, không DELETE lịch sử.

## Giá vốn, nhập và bán
- Điện thoại giá vốn riêng từng máy = đơn giá nhập + phần chi phí phân bổ; chi phí mua phân bổ đều theo tổng số đơn vị, phần dư đồng phân bổ lần lượt, bảo toàn tổng. Phụ kiện FIFO, giá vốn trả lại theo đúng phân bổ của dòng bán gốc.
- Sản phẩm PHONE quản lý từng IMEI với tình trạng NEW/USED, ngoại hình, pin 0–100, lỗi, phụ kiện kèm; sản phẩm ACCESSORY quản lý SKU duy nhất và số lượng.
- Nhập cho nhà cung cấp, thanh toán tối đa tổng phiếu; phần còn lại là phải trả. SKU/IMEI và số tiền được xác thực tại server. Không nhập lại IMEI cũ bằng phiếu mới.
- Giá bán là giá trên dòng tại thời điểm ghi sổ, không đổi khi sửa bảng giá. Chiết khấu cả phiếu là số tiền, không vượt tổng hàng; phân bổ nguyên đồng theo giá trị dòng, phần dư theo thứ tự dòng. Giá trị dòng không âm.
- Thanh toán tiền mặt/chuyển khoản, có thể kết hợp. Không nhận vượt giá trị phải thu/phải trả. Bán chịu bắt buộc khách hàng. Phiếu nháp chỉ tồn tại ở UI, chưa tác động sổ.
- Doanh thu thuần = bán sau chiết khấu trừ trả/hủy; giá vốn = giá vốn bán trừ giá vốn trả; lãi gộp = doanh thu thuần − giá vốn. Tiền đã thu khác doanh thu; chi phí vận hành hiển thị riêng. Không suy lãi từ số dư quỹ.

## Đổi trả, hủy và bảo hành
- Trả hàng theo dòng bán gốc, không vượt số lượng chưa trả, không trả hai lần cùng IMEI. Giá trị hoàn tối đa phần giá trị gốc còn lại sau chiết khấu; giảm công nợ trước, sau đó hoàn tiền đã thu. Khóa phiếu gốc để chống trả đồng thời.
- Máy trả phải chọn available hoặc quarantine. Phụ kiện nhập lại đúng giá vốn phân bổ gốc. Hoàn tiền bằng cash/bank và có ledger riêng. Hủy đơn là trả toàn bộ phần chưa trả, lưu lý do, không xóa.
- Đổi máy: tạo trả hàng gốc rồi bán mới, liên kết hai chứng từ; chưa có thao tác đổi nguyên tử riêng phải mô tả rõ hai chứng từ.
- Hoàn nhập theo phiếu nhập, chỉ hàng còn tồn thuộc lô/IMEI gốc; chặn hàng đã bán/quarantine và phần không còn tồn. Giảm phải trả trước rồi nhận lại tiền nhà cung cấp; lưu chứng từ đảo, không sửa phiếu nhập.
- Bảo hành liên kết IMEI và khách hàng/phiếu bán; trạng thái received/processing/completed/cancelled. Máy tồn nhận bảo hành phải quarantine, chỉ được available lại bằng hành động có audit. Máy của khách đã bán giữ sold khi bảo hành, không tự tăng tồn.
- Thu nợ khách/chi nợ NCC phải liên kết chứng từ, không vượt dư nợ; cùng transaction ghi cash ledger và audit. Thu/chi khác yêu cầu lý do.

## Truy cập và lưu trữ
- Server xác thực mọi API dữ liệu, kiểm tra Origin cho mutation, cookie HttpOnly SameSite strict, session có hạn, mật khẩu scrypt có salt, giới hạn thử đăng nhập. Không chứa mật khẩu trong source/Git.
- Không cache API, thông tin khách hàng hoặc giao dịch trong service worker. Mất mạng khóa ghi, không thông báo ghi thành công. Idempotency key giữ qua retry, đổi khi nội dung đổi.
- Database thật không reset khi chạy test. Database test riêng, chỉ được dọn dữ liệu khi tên kết thúc _test; không xóa/reset database người dùng.
- Thời gian lưu UTC; ngày báo cáo theo Asia/Ho_Chi_Minh, khoảng ngày gồm đầu ngày đến trước ngày kế tiếp.
- Sao lưu bằng pg_dump; khôi phục vào database mới để kiểm chứng, không ghi đè dữ liệu đang dùng.
