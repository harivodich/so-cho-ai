# Kế hoạch nâng cấp Sổ Chợ AI

Mục tiêu là mở rộng sản phẩm theo hướng có thể đo, bảo vệ dữ liệu và không biến tính năng thử nghiệm thành lời hứa quá mức.

## Đã triển khai trong vòng này

- Tài khoản Google/email, liên kết phiên tạm, xác minh email, hồ sơ UID và settings theo người dùng.
- Cảnh báo rõ khi chuyển từ phiên tạm sang tài khoản đã tồn tại; xuất/nhập backup là đường di trú có kiểm soát.
- Catalog mặt hàng, điều chỉnh tồn, ngưỡng thiếu hàng và rules theo UID.
- Công nợ phải thu/phải trả, thanh toán một phần, trạng thái settled và overdue.
- Trường thuế trên giao dịch, tổng hợp theo kỳ và cột thuế trong CSV.
- Outbox offline cho giao dịch, công nợ, catalog; tự retry khi trình duyệt online trở lại.
- 15 fixture OCR SVG tổng hợp, không PII, có manifest và contract test tái chạy được.

## Giai đoạn 1 — chốt tài khoản và dữ liệu

1. Bật Google và Email/Password trong Firebase Console.
2. Kiểm thử hai tài khoản thật: A tạo dữ liệu, B không đọc được dữ liệu A.
3. Kiểm thử link tài khoản mới giữ nguyên UID; kiểm thử login tài khoản cũ yêu cầu backup trước.
4. Kiểm tra Firestore rules, authorized domains, nút xóa tài khoản và khôi phục backup.

Cổng: hai tài khoản độc lập, không lộ dữ liệu chéo, reload không mất phiên.

## Giai đoạn 2 — tồn kho và công nợ dùng được hàng ngày

1. Nhập catalog và ngưỡng thiếu hàng.
2. Ghi điều chỉnh tồn có lý do; đối chiếu với giao dịch nhập/bán.
3. Ghi khoản phải thu/phải trả và các lần thanh toán.
4. Kiểm tra báo cáo thiếu giá vốn, số dư còn lại và khoản quá hạn.

Cổng: công thức có unit test, UI có empty/loading/error state, không tự ghi giao dịch trước xác nhận.

## Giai đoạn 3 — OCR có bằng chứng

1. Tái tạo fixture bằng `npm run eval:ocr:fixture`.
2. Chạy model trên tối thiểu 15 ảnh in rõ và lưu expected/actual riêng.
3. Chấm toàn giao dịch, loại, tổng tiền, số lượng và đơn giá.
4. Chỉ mở OCR thành luồng chính nếu ảnh in rõ đạt ngưỡng đã công bố; chữ viết tay vẫn beta.

Cổng: không dùng fixture tổng hợp để tuyên bố accuracy thực tế.

## Giai đoạn 4 — offline và phát hành

1. Tắt mạng trong DevTools, tạo/sửa/xóa giao dịch và điều chỉnh tồn.
2. Bật mạng, xác nhận outbox tự retry và không tạo bản ghi trùng.
3. Chạy `npm test`, `npm run lint`, `npm run build`, `npm run verify:evidence`.
4. Smoke test mobile and a clean browser profile, inspect the bundle for secrets, then deploy.

Cổng: không còn P0/P1 đã biết; mọi giới hạn và số liệu được ghi trong README/changelog.

## Không làm trong MVP

- Không tự động hỗ trợ mọi chữ viết tay.
- Không triển khai tồn kho theo lô, thuế pháp lý, công nợ tự động đối soát hoặc bán vượt tồn.
- Không gửi audio/ảnh vào log; không lưu API key trong client.
### Cổng xóa tài khoản

Luồng xóa tài khoản đã chuyển sang POST /api/account/delete: server xác minh ID token, xóa đệ quy cây users/{uid} bằng Admin SDK rồi xóa Auth user. Client không xóa Firestore trước khi server xác nhận thành công.
## Giai đoạn 5 — dashboard và mục tiêu doanh thu

- Báo cáo ngày/tháng dùng cùng một bộ công thức tài chính bằng code.
- Mục tiêu doanh thu được lưu trong `users/{uid}/settings/default` và cache theo UID; không dùng chung giữa tài khoản.
- Khi mất mạng, mục tiêu và dữ liệu liên quan được đưa vào outbox, tự đồng bộ khi online trở lại.
- Đối tác được lưu theo UID, có trạng thái loading/empty/error và retry offline.

Cổng: tài khoản A không thấy mục tiêu, đối tác hoặc dữ liệu của tài khoản B; reload và chuyển online không tạo bản ghi trùng.

## Việc cần làm thủ công trước release

1. Bật Google và Email/Password trong Firebase Authentication.
2. Thêm domain Vercel vào Authorized domains.
3. Publish `firestore.rules` và kiểm thử hai tài khoản thật.
4. Điền biến môi trường Vercel cho Production/Preview, trong đó Admin SDK và Gemini chỉ ở server; sau đó redeploy.
5. Chạy checklist trong `docs/release-checklist.md`: đăng nhập, cô lập dữ liệu, link tài khoản tạm, backup/import, xóa tài khoản và offline sync.

## Account-safe synchronization

- Local repositories and the offline outbox are scoped by Firebase UID (or device scope before sign-in); switching accounts cannot reuse another account's cache.
- Confirmed sale/purchase transactions create deterministic stock movements and edits/deletes reconcile those movements idempotently.
- Backup import remaps every record owner to the currently signed-in account before writing.

## Trạng thái kiểm chứng sau vòng nâng cấp

- Tài khoản: profile/settings và dữ liệu nghiệp vụ đều scope theo UID; AI chỉ nhận tài khoản thật.
- Dashboard: báo cáo ngày/tháng, tồn kho, công nợ, thuế tham khảo và mục tiêu doanh thu đã có công thức/test riêng.
- Offline: transaction, catalog, debt và mục tiêu có outbox theo scope; cần smoke test thủ công khi tắt mạng.
- OCR: đã có 15 fixture SVG + 15 PNG, runner `npm run eval:ocr` và scorer `npm run score:ocr`. Dry-run hoàn hảo chỉ kiểm tra pipeline; chưa phải accuracy model.
- Current automated verification: 46 files / 130 tests pass, lint pass, build pass, evidence pass; Firebase reconnect, outbox refresh, account-scoped cache cleanup, and aggregate pending-sync status and partial-save retry idempotency are covered by contract tests; public smoke passes at https://so-cho-ai-tau.vercel.app and local production smoke passes. Firebase Rules release `cloud.firestore` was read back from the Rules API on 2026-08-17; its non-blank normalized SHA-256 (`16dee1d9210a672793ae7ace895d6ba9754c79c8c10bf7bb1a09d341aa5f7fda`) matches the repository file.
- External Firebase readback on 2026-08-17 confirms Email/Password and Google providers enabled, authorized domains `localhost`, `sochoai.firebaseapp.com`, `sochoai.web.app`, and `so-cho-ai-tau.vercel.app`, plus the published `cloud.firestore` Rules release.
- Deployed Rules simulator on the live ruleset passed 14 cross-UID cases (`SUCCESS`): owner reads/profile/settings, creates and updates across all five data collections are allowed; mismatched-owner writes and cross-UID reads/deletes are denied; the run performed no writes.
- Google Cloud readback confirms the server service account `so-cho-ai-vercel` exists and is enabled with `roles/datastore.user` and `roles/firebaseauth.admin`; Vercel secret wiring still needs an authenticated production delete smoke.

### Cổng còn mở trước khi gọi là hoàn tất

1. Firebase Auth Google/Email và production authorized domain đã được xác nhận bằng đăng nhập thật; Firestore Rules đã publish và đã được đọc lại từ Rules API, khớp file local về nội dung.
2. Vercel Production public config, redeploy và public smoke đã pass; chưa có bằng chứng đọc trực tiếp secret server-only (Admin SDK/Gemini) từ Vercel; Preview env vẫn cần kiểm tra nếu dùng preview URL.
3. Tạo hai tài khoản thật để kiểm tra cô lập A/B, reload, logout/login, link anonymous, backup/import và xóa tài khoản.
4. Chạy offline smoke test trên trình duyệt khác.
5. Dùng ID token tài khoản thật cho OCR runner và lưu report; không dùng token anonymous, không commit token.
6. Chỉ mở OCR khỏi beta nếu ảnh in rõ đạt ngưỡng đã công bố; không suy rộng sang chữ viết tay.
