# Acceptance criteria — tuần 1

- Người dùng nhập bán hàng, nhập hàng hoặc chi phí với tổng tiền VND dương.
- Người dùng phải xem màn hình xác nhận trước khi giao dịch xuất hiện trong sổ.
- Người dùng sửa, xóa và lọc giao dịch.
- Báo cáo không dùng giao dịch nhập sau thời điểm bán làm giá vốn.
- Nếu thiếu giá vốn của một giao dịch bán, lãi gộp hoàn chỉnh không được hiển thị.
- Khi Firebase chưa được cấu hình, dữ liệu lưu local và UI phải nói rõ điều đó.
- Khi Firebase được cấu hình, ứng dụng dùng Anonymous Authentication và chỉ truy cập `users/{uid}/transactions`.
- `npm test`, `npm run lint` và `npm run build` phải thành công.
