# Ma trận kiểm chứng bắt buộc

Đánh dấu đạt chỉ sau khi chạy test thật. TERRA ghi evidence test backend tại BACKEND_TESTS.md; ANTIGRAVITY ghi QA*.md. SOL kiểm tra lại trước tích hợp.

| Nhóm | Trường hợp quan trọng |
|---|---|
| Auth | API dữ liệu chưa login trả 401; mật khẩu sai không tạo session; logout vô hiệu hóa session; Origin lạ bị chặn; cookie HttpOnly/SameSite, rate limit; malformed JSON không 500 |
| Danh mục | SKU trùng, số tiền thập phân/âm/quá lớn, sửa mô tả không đổi snapshot chứng từ, identifiers không sửa |
| Nhập | IMEI trùng trong request và database; pin/quantity invalid; phân bổ chi phí bảo toàn tổng; phiếu+stock+quỹ+audit hoặc rollback tất cả |
| Bán | PHONE đúng IMEI, phụ kiện FIFO nhiều lô, thiếu tồn, trùng device trong request, giá/discount overflow, khách vãng lai bán chịu bị chặn |
| Đồng thời | Hai lần bán cùng IMEI chỉ một thành công; hai đơn tranh đơn vị phụ kiện cuối; hai yêu cầu cùng key chỉ một chứng từ; cùng key khác payload 409; key không bị lưu nếu rollback |
| Nợ/quỹ | Tiền mặt/chuyển khoản kết hợp, thu nợ không vượt dư, hai thu nợ đồng thời không vượt dư; doanh thu khác đã thu và lãi; chi NCC đúng quỹ |
| Trả/hủy | Trả từng phần đến hết không lệch đồng sau discount; hai trả đồng thời; bán-trả-bán-trả cùng IMEI giữ lịch sử; trả giảm nợ trước hoàn tiền; hủy không xóa ledger |
| Hoàn nhập | Không hoàn hàng đã bán, không hoàn vượt lô còn tồn, hoàn giảm phải trả trước rồi nhận tiền, không đảo nhầm giá vốn lô được nhập lại |
| Bảo hành | Máy bán không tự tăng tồn khi nhận/hoàn thành; máy cửa hàng cách ly không bán được; thay đổi trạng thái/release có audit |
| Báo cáo | Doanh thu và giá vốn trừ trả, expenses riêng; biên ngày Việt Nam; tồn khớp ledger; công nợ khớp chứng từ+payments |
| UI | Luồng tạo NCC+SP→nhập→bán chịu→thu nợ→trả; validation và lỗi kho hiện rõ; không submit bằng Enter ngoài ngữ cảnh; Tab/ShiftTab và drawer Escape |
| PWA | Manifest và PNG 192/512 hợp lệ; shell cache không chứa API; offline không ghi/không báo thành công; service worker cập nhật được |
| Xuất/in | Phiếu in giá trị khớp server, không cắt bảng ở A4; XLSX mở được và không thực thi nội dung người dùng như công thức |
| Responsive | PC 1440×900, tablet 768×1024, mobile 390×844; drawer/form thao tác được, bảng cuộn trong container, không tràn toàn trang |
| Vận hành | Build/typecheck; migration chạy lại; DB test tách biệt; restart giữ dữ liệu; backup+restore vào DB mới; không secrets trong Git |

Không tự coi coverage, build xanh hoặc một lần bán thành công là bằng chứng đã xử lý race/rollback. Test mutation dùng dữ liệu riêng trong database test; database dùng thật giữ trống đến khi người quản lý nhập dữ liệu.
