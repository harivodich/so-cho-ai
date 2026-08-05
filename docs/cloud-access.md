# Google Cloud/Firebase — quyền truy cập và chi phí

## Chủ billing account thực hiện

1. Tạo project riêng cho Sổ Chợ AI.
2. Liên kết billing account.
3. Tạo cảnh báo ngân sách 100.000 VND ở 50%, 90% và 100%.
4. Cấp IAM cho tài khoản Google của người phát triển; không chia sẻ mật khẩu, OTP hoặc thông tin thẻ.
5. Bật Firebase Authentication (Anonymous) và Firestore.

## Cấu hình triển khai MVP

- Region: `asia-southeast1` trừ khi thể lệ yêu cầu khác.
- Cloud Run: `min instances = 0`, `max instances = 1`.
- Không dùng GPU, Cloud SQL hoặc VPC connector.
- Deploy `firestore.rules` trước khi có dữ liệu thật.

## Thông tin cần đưa cho người phát triển

Chỉ cần Firebase Web App config để điền `.env.local`:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

Không gửi Gemini API key qua chat hoặc commit vào Git.
