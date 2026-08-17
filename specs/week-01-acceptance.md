# Acceptance criteria — tuần 1

- Người dùng nhập bán hàng, nhập hàng hoặc chi phí với tổng tiền VND dương.
- Người dùng phải xem màn hình xác nhận trước khi giao dịch xuất hiện trong sổ.
- Người dùng sửa, xóa và lọc giao dịch.
- Báo cáo không dùng giao dịch nhập sau thời điểm bán làm giá vốn.
- Nếu thiếu giá vốn của một giao dịch bán, lãi gộp hoàn chỉnh không được hiển thị.
- Khi Firebase chưa được cấu hình, dữ liệu lưu local và UI phải nói rõ điều đó.
- Khi Firebase được cấu hình nhưng chưa đăng nhập, dữ liệu vẫn lưu local theo device scope và ứng dụng không tự tạo anonymous; người dùng đăng nhập Google/email để đồng bộ tài khoản thật và AI chỉ nhận token tài khoản thật.
- `npm test`, `npm run lint` và `npm run build` phải thành công.

- Tồn kho được tính từ giao dịch nhập/bán đã xác nhận; công nợ có sổ riêng phải thu/phải trả.
- Backup JSON được kiểm tra schema trước khi nhập lại.


## Acceptance bo sung — tai khoan va mo rong

- Ho so, settings, catalog, counterparties, debts va stock movements deu nam duoi UID Firebase.
- Chuyen tu phien tam sang tai khoan moi link cung UID; dang nhap tai khoan cu can xac nhan va khuyen nghi backup.
- Khi mat mang, giao dich/cong no/catalog duoc luu tam va dua vao outbox retry khi online.
- OCR co 15 fixture tong hop khong PII; fixture khong duoc dung de tuyen bo accuracy model.
