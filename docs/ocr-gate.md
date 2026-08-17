# OCR hóa đơn — cổng beta

## Phạm vi hiện tại

- Nhận JPG, PNG và WebP tối đa 5 MB.
- Gemini 2.5 Flash trả tối đa 20 bản nháp, một bản nháp cho mỗi dòng in nhận diện được.
- Không lưu ảnh/audio trong Firestore hoặc Cloud Storage; API chỉ trả bản nháp.
- Mọi dòng đều đi qua Data Quality Guard và màn hình xác nhận trước khi lưu.
- Chữ viết tay, ảnh mờ và dòng không đọc được không được đoán; có thể trả về `[]` hoặc cảnh báo cần sửa.

## Bộ benchmark công khai

- Manifest nguồn: `evaluation/fixtures/ocr-printed-invoice.jsonl`.
- Ảnh tổng hợp SVG: `evaluation/fixtures/ocr-images/`.
- Ảnh PNG để gửi qua API: `evaluation/fixtures/ocr-png/`.
- Tái tạo ảnh PNG: `npm run eval:ocr:fixture` rồi `npm run eval:ocr:png-fixture`.
- Bộ này chỉ chứa dữ liệu tổng hợp công khai, không có ảnh người dùng hay PII.

## Chạy benchmark thật

Runner yêu cầu ID token Firebase của tài khoản thật để không biến benchmark thành luồng anonymous:

```powershell
$env:OCR_EVAL_ID_TOKEN = "<Firebase ID token cua tai khoan that>"
npm run eval:ocr -- --base-url https://<domain> --output evaluation/results/ocr-run.jsonl
npm run score:ocr -- --actual evaluation/results/ocr-run.jsonl
```

ID token chỉ dùng cục bộ trong phiên chạy, không commit, không ghi vào manifest và không in ra log. Runner chỉ lưu các trường nháp cần chấm (`type`, `itemName`, `quantity`, `unitPrice`, `amount`, `unit`, `occurredAt`, cờ review); không lưu `rawInput`, ảnh hoặc audio.

`npm run score:ocr` tạo JSON và Markdown report, chấm riêng toàn giao dịch, `type`, `amount`, `quantity`, `unitPrice`, tỷ lệ từ chối mẫu âm và nhóm chất lượng. Không được gọi report fixture hoàn hảo là accuracy của Gemini.

## Cổng công bố

Chưa coi OCR là luồng chính cho đến khi có tối thiểu 15 ảnh hóa đơn in rõ được gắn nhãn trước khi gọi model. Chỉ công bố mức hỗ trợ thực tế; ảnh mờ/chữ viết tay vẫn là beta. Nếu độ chính xác toàn giao dịch trên ảnh in rõ dưới 80%, giữ OCR ở chế độ demo beta và ưu tiên nhập tay/voice.

Fixture contract và dry-run scorer chỉ chứng minh pipeline tái lập được; accuracy thật phải đến từ `eval:ocr` với token tài khoản thật và report đã lưu.