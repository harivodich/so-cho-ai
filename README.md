# Sổ Chợ AI

Web app mobile-first giúp người bán nhỏ ghi giao dịch, xác nhận trước khi lưu và xem doanh thu/lãi gộp ước tính theo ngày.

## Tuần 1 đã có

- Luồng nhập tay → xem lại → xác nhận → lưu.
- Sổ giao dịch: lọc, sửa, xóa và xóa dữ liệu của người dùng.
- Báo cáo doanh thu, chi phí khác và lãi gộp ước tính.
- Giá vốn chỉ lấy từ lần nhập cùng mặt hàng gần nhất, không muộn hơn thời điểm bán.
- Local persistence hoạt động ngay trong trình duyệt.
- Firebase Anonymous Authentication + Firestore adapter và rules đã sẵn sàng khi cấu hình project.
- Dockerfile cho Cloud Run.

## Chạy local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`.

Nếu chưa cấu hình Firebase, ứng dụng chạy bằng local storage và hiển thị rõ trạng thái đó. Không dùng local mode để thử dữ liệu thật lâu dài.

## Kết nối Firebase

1. Tạo Firebase app web trong Google Cloud project.
2. Bật Anonymous Authentication và Cloud Firestore.
3. Dán cấu hình web vào `.env.local` theo `.env.example`.
4. Deploy nội dung `firestore.rules` bằng Firebase Console/CLI.
5. Kiểm thử bằng hai cửa sổ ẩn danh để bảo đảm dữ liệu không truy cập chéo.

Không đặt Gemini key ở biến `NEXT_PUBLIC_*`.

## Kiểm tra

```powershell
npm test
npm run lint
npm run build
```

## Triển khai Cloud Run

Sau khi có Google Cloud project và billing account:

```powershell
gcloud run deploy so-cho-ai --source . --region asia-southeast1 --allow-unauthenticated --min-instances 0 --max-instances 1
```

Đặt các biến Firebase trong Cloud Run. Gemini server-side chỉ được thêm khi triển khai route trích xuất ở tuần 2.

## Giới hạn hiện tại

- Chưa triển khai giọng nói, ảnh hóa đơn hoặc Gemini API; các phần này bắt đầu sau khi luồng nhập tay được kiểm thử ổn định.
- Chưa có tồn kho, thuế, công nợ hoặc nhiều cửa hàng.
- “Lãi gộp ước tính” không hiển thị nếu thiếu giá vốn của bất kỳ giao dịch bán nào trong ngày.
