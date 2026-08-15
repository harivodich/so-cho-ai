# Kịch bản demo 40 giây — Sổ Chợ AI

## Chuẩn bị

- Dùng dữ liệu demo không nhạy cảm và một transaction đã được xác nhận.
- Mở URL Vercel (hoặc local khi chưa deploy), chọn ngày có dữ liệu.
- Không bật voice giao dịch trong video như một metric đã được chứng minh. FLEURS hiện chỉ là negative-control; dùng luồng nhập tay hoặc draft mock có nhãn rõ ràng.

## Lời dẫn và thao tác

| Thời gian | Hình | Lời dẫn |
| --- | --- | --- |
| 0–6 giây | Trang chủ, nút nhập giao dịch | “Sổ Chợ AI giúp người bán nhỏ ghi giao dịch và luôn kiểm tra trước khi lưu.” |
| 6–14 giây | Draft xác nhận | “Gemini chỉ tạo bản nháp có cấu trúc. Người dùng sửa mọi trường và bấm xác nhận; AI không tự ghi dữ liệu.” |
| 14–22 giây | Cảnh báo Data Quality Guard | “Code độc lập kiểm tra số tiền, phép nhân, ngày và dấu hiệu nhiều giao dịch. Cảnh báo giải thích rõ việc cần làm.” |
| 22–30 giây | Báo cáo và evidence 7 ngày | “Báo cáo được tính bằng code. Nhận xét AI chỉ đọc aggregate 7 ngày, không nhận từng giao dịch.” |
| 30–40 giây | AI Quality Lab | “Chất lượng được đo trên 60 câu synthetic gắn nhãn trước. Dashboard hiển thị cả nhóm lỗi và mẫu model làm sai, không chỉ số đẹp.” |

## Câu chốt bắt buộc

“Bộ text evaluation chưa phải voice benchmark người thật. FLEURS chỉ đo việc từ chối audio ngoài nghiệp vụ; dự án chưa công bố accuracy trích xuất giao dịch bằng voice.”
