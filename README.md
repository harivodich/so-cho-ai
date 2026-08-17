# Sổ Chợ AI

Web app mobile-first giúp người bán nhỏ ghi giao dịch, kiểm tra trước khi lưu và hiểu doanh thu/lãi gộp ước tính mà không cần bảng tính.

## Chức năng hiện có

- Nhập tay hoặc ghi một giao dịch bằng giọng nói; mọi bản nháp đều phải sửa/xác nhận trước khi lưu.
- Sổ giao dịch theo tài khoản Google hoặc Email/Password: thêm, sửa, xóa, lọc và xóa toàn bộ dữ liệu.
- Báo cáo ngày, 7 ngày, tháng hoặc khoảng tùy chọn; lọc theo loại và mặt hàng.
- Dashboard gồm doanh thu, tồn kho, công nợ, thuế tham khảo, dòng tiền công nợ đã ghi nhận, mục tiêu doanh thu và các báo cáo theo kỳ.
- Mục tiêu doanh thu tháng và “Việc cần làm” được tính bằng code. Mục tiêu được scope theo UID và có fallback local khi offline.
- Nhận xét AI cuối ngày chỉ nhận số tổng hợp; không nhận từng giao dịch và không được tự tính số. Hỏi nhanh về doanh thu/lãi/đơn trung bình trả lời trực tiếp bằng code.
- Xuất CSV đúng kỳ và bộ lọc đang xem; dữ liệu được bảo vệ khỏi công thức spreadsheet. Có link tra giá nông sản công khai, nhưng ứng dụng không tự đổi hay đề xuất giá bán.
- Dockerfile cho Cloud Run và bộ evaluation TTS/public có thể chạy lại tại [`evaluation/`](evaluation/README.md).

## Nguyên tắc tài chính và riêng tư

- Tiền lưu dưới dạng số nguyên VND.
- Giá vốn của một giao dịch bán lấy từ lần nhập cùng mặt hàng gần nhất, không muộn hơn thời điểm bán.
- Nếu có bất kỳ giao dịch bán nào thiếu giá vốn, ứng dụng không hiển thị lãi gộp hoàn chỉnh.
- Audio chỉ tồn tại trong bộ nhớ để chuyển WAV/gửi phân tích; không lưu Firestore, Cloud Storage hoặc log.
- Gemini key và Firebase Admin credential chỉ ở server. AI không có đường ghi Firestore.

## Chạy local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`. Nếu Firebase chưa kết nối, app dùng local storage và hiển thị cảnh báo; không dùng chế độ này cho dữ liệu cần lưu lâu dài.

## Cấu hình Firebase

1. Tạo Firebase web app, bật Google, Email/Password và Cloud Firestore. Anonymous chỉ cần giữ nếu cần nâng cấp các phiên cũ.
2. Điền bốn giá trị Firebase web vào `.env.local` theo `.env.example`.
3. Deploy [`firestore.rules`](firestore.rules).
4. Verify with two clean browser profiles after signing in to two real accounts; neither UID may read the other account data.

Firebase web config là cấu hình public. Service-account JSON, Application Default Credentials và Gemini API key không phải public và không được commit.

## Cấu hình Gemini

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

`POST /api/extract` và `POST /api/insights` đều xác minh Firebase ID token. Extraction có quota 30 lượt/ngày/người dùng; nhận xét cuối ngày có quota riêng 5 lượt/ngày. Trên local cần Application Default Credentials có quyền Firestore; trên Cloud Run dùng runtime service account với quyền tối thiểu.

Tài liệu chính thức: [Gemini audio](https://ai.google.dev/gemini-api/docs/audio), [Interactions API](https://ai.google.dev/api/interactions-api-v1), [Gemini models](https://ai.google.dev/gemini-api/docs/models).

## Kiểm tra

```powershell
npm test
npm run lint
npm run build
npm run verify:evidence
npm run smoke:public
```

## Evaluation không thu dữ liệu cá nhân

- 60 câu giao dịch synthetic do dự án tự soạn, nhãn được khóa trước khi gọi Gemini; 30 prompt TTS chỉ được dùng khi dịch vụ TTS khả dụng.
- 30 audio FLEURS tiếng Việt công khai (CC-BY-4.0): 15 clip rõ và 15 biến thể nhiễu xác định ở 20 dB SNR để đo khả năng từ chối ngoài phạm vi.
- Runner gọi đúng API ứng dụng, gồm Firebase auth, quota, Zod và Gemini; không dùng prompt đánh giá riêng.
- `npm run verify:evidence` + `npm run smoke:public` kiểm tra coverage, provenance, artifact public và các trường không được công bố trước demo/nộp bài.
- Không gọi metric text/negative-control là accuracy giọng người dùng thật và không gộp mẫu giao dịch với mẫu âm tính thành một con số gây hiểu nhầm.

Chi tiết và lệnh chạy: [`evaluation/README.md`](evaluation/README.md).

## Triển khai Vercel miễn phí

Bản demo công khai dùng Vercel Hobby, không yêu cầu Google Cloud Billing. Xem checklist service account tối thiểu, biến môi trường, deploy và smoke test tại [`docs/vercel-deploy.md`](docs/vercel-deploy.md).

`GEMINI_API_KEY` và `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` chỉ được đặt trong Vercel Environment Variables; không đưa secret vào image, repository hoặc biến `NEXT_PUBLIC_*`. Cloud Run vẫn có thể dùng sau này nếu có billing; checklist cũ ở [`docs/cloud-access.md`](docs/cloud-access.md).

## Giới hạn công bố

- Voice chỉ hỗ trợ một giao dịch mỗi audio và chưa có benchmark giọng người thật.
- Ảnh hóa đơn in rõ là luồng beta; chữ viết tay vẫn giới hạn. Tồn kho, công nợ và thuế là công cụ ghi nhận/tham khảo, chưa thay thế kế toán hoặc hỗ trợ nhiều cửa hàng/nhân viên.
- Mục tiêu và “Việc cần làm” hỗ trợ theo dõi, không phải dự báo hay cam kết tăng doanh thu.
- Giá công khai phụ thuộc mặt hàng, khu vực và thời điểm; người bán phải tự quyết định giá thực tế.

## Bằng chứng AI/ML

- **Evaluation có thể tái chạy:** 60 câu tiếng Việt do dự án tự soạn, có `expected` khóa trước khi gọi Gemini 2.5 Flash. Runner lưu model, prompt version, timestamp, output JSON/Markdown và metric theo `type`, `amount`, `quantity`, `unitPrice`.
- **Không cherry-pick demo:** AI Quality Lab publish từ report thật, hiển thị exact-match, tỷ lệ cần người sửa, nhóm lỗi và một ví dụ đúng/sai/guard. Publisher từ chối fixture.
- **Human-in-the-loop:** Gemini chỉ tạo draft. Zod và Data Quality Guard kiểm tra lại; chỉ nút xác nhận của người dùng mới ghi Firestore.
- **Insight có căn cứ:** code tính evidence 7 ngày; Gemini chỉ diễn giải aggregate, không nhận raw transaction, UID, audio hoặc transcript.
- **Nguồn dữ liệu:** text benchmark là project-authored synthetic. Voice benchmark tách riêng, chỉ dùng synthetic/public có manifest và license. Không diễn giải metric text như độ chính xác voice người thật.

Xem [kiến trúc AI/ML](docs/architecture-ai.md), [phương pháp evaluation](evaluation/README.md), [audit AI/ML mới nhất](docs/daily/2026-08-19-status.md) và [kịch bản demo 40 giây](docs/submission-demo-script.md).
