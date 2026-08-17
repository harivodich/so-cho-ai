# Product brief — Sổ Chợ AI

## Vấn đề

Người bán thực phẩm quy mô nhỏ thường ghi thu/chi rời rạc và khó biết kết quả cuối ngày. Biểu mẫu kế toán đầy đủ tạo quá nhiều thao tác cho một giao dịch tại quầy.

## Người dùng ưu tiên

Người bán rau, trái cây hoặc thực phẩm tại chợ truyền thống, dùng điện thoại Android, hiện ghi bằng sổ tay, ghi chú hoặc trí nhớ.

Nếu đến 10/08 không phỏng vấn được đúng nhóm này, persona phải đổi thành nhóm người bán nhỏ thực tế đã phỏng vấn; hồ sơ không được tuyên bố đã kiểm chứng với tiểu thương chợ.

## Giải pháp

Người dùng nhập giao dịch bằng giọng nói, nhập tay hoặc hóa đơn rõ. AI tạo bản nháp; người dùng sửa và xác nhận; ứng dụng tính doanh thu, chi phí và lãi gộp ước tính.

## Giá trị đề xuất

> Ghi một giao dịch trong tối đa 30 giây bằng cách nói tự nhiên, luôn kiểm tra trước khi lưu và biết dữ liệu nào còn thiếu để tính lãi gộp.

## Phạm vi MVP

- Nhập tay, sau đó là voice-first.
- Xác nhận trước khi lưu.
- Sổ giao dịch, sửa/xóa, báo cáo theo ngày.
- Firebase Authentication (Google + Email/Password; chỉ nâng cấp phiên anonymous cũ), Firestore và Vercel cho bản demo công khai. Cloud Run là lựa chọn sau này khi có billing.
- Catalog, tồn kho, công nợ và thuế tham khảo theo UID; backup/import và offline outbox được hỗ trợ.

Không làm: nhiều cửa hàng, nhân viên, dự báo dài hạn hoặc cam kết đọc mọi chữ viết tay.

## Quy tắc dữ liệu và quyền riêng tư

- Không có AI nào ghi trực tiếp vào Firestore.
- Không lưu audio/ảnh sau khi trích xuất.
- Không dùng dữ liệu thực của người phỏng vấn trong demo nếu chưa có sự đồng ý.
- Người dùng có thể xóa dữ liệu của mình.
- Lãi gộp chỉ là ước tính; nếu thiếu giá vốn, không hiện một con số lợi nhuận hoàn chỉnh.
