# Release checklist — Sổ Chợ AI

## Trước deploy

- Firebase Authentication: bật Google và Email/Password. Không bật Anonymous cho luồng người dùng mới; chỉ giữ nếu cần nâng cấp phiên cũ.
- Firebase Authorized domains: thêm domain Vercel production, preview cần dùng và localhost.
- Firestore Rules: deploy file firestore.rules.
- Vercel env:
  - NEXT_PUBLIC_FIREBASE_API_KEY
  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - NEXT_PUBLIC_FIREBASE_APP_ID
  - FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON (server-only)
  - GEMINI_API_KEY (server-only)
  - GEMINI_MODEL=gemini-2.5-flash
- Không đưa giá trị secret vào repo, screenshot hoặc log.

## Smoke test account

1. Open production in clean browser profile A and sign in with real account A.
2. Tạo tài khoản Google hoặc Email/Password; xác nhận profile/settings được tạo.
3. Tạo một giao dịch, một sản phẩm và một khoản công nợ.
4. Open clean browser profile B, sign in with a different real account, and confirm it cannot see A data.
5. Đăng xuất/đăng nhập lại A; xác nhận dữ liệu vẫn còn sau reload.
6. Với phiên anonymous cũ có dữ liệu, tạo tài khoản mới để kiểm tra UID được giữ nguyên.
7. Đăng nhập tài khoản đã tồn tại từ phiên anonymous cũ; phải hiện cảnh báo và không tự gộp dữ liệu.
8. Dùng nút Xóa tài khoản; endpoint phải trả thành công, Auth user không đăng nhập lại được, cây users/{uid} không còn dữ liệu.

## Smoke test offline

1. DevTools > Network > Offline.
2. Tạo/sửa/xóa transaction, debt, product và stock adjustment.
3. Bật mạng lại.
4. Xác nhận banner chờ đồng bộ biến mất và không có bản ghi trùng.
5. Reload và xác nhận dữ liệu vẫn đúng.

## Smoke test AI/OCR

- Tài khoản thật mới được dùng voice/image/insight.
- Voice luôn đi qua màn hình xác nhận trước khi lưu.
- Ảnh mờ/chữ viết tay bị đánh dấu beta hoặc yêu cầu nhập tay.
- Không có audio/ảnh raw trong log.
- AI không được ghi trực tiếp Firestore.

## Bằng chứng cần lưu

- Production URL opens from a clean browser profile after real-account sign-in.
- Ảnh/số liệu test A-B, offline sync và account deletion.
- Output npm test, npm run lint, npm run build, npm run verify:evidence.
## OCR benchmark

- `npm run eval:ocr:fixture`
- `npm run eval:ocr:png-fixture`
- Set `OCR_EVAL_ID_TOKEN` to a real Firebase account token, then run `npm run eval:ocr -- --base-url <production-url>`.
- Run `npm run score:ocr -- --actual evaluation/results/ocr-run.jsonl`.
- Never publish the synthetic dry-run as model accuracy; never commit the token or raw media.
