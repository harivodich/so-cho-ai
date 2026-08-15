# Google Cloud/Firebase — quyền truy cập và chi phí

## Chủ billing account thực hiện

1. Tạo project riêng cho Sổ Chợ AI.
2. Liên kết billing account.
3. Bật Cloud Run Admin API (un.googleapis.com) trước deploy đầu tiên.
4. Tạo cảnh báo ngân sách 100.000 VND ở 50%, 90% và 100%.
5. Cấp IAM cho tài khoản Google của người phát triển; không chia sẻ mật khẩu, OTP hoặc thông tin thẻ.
6. Bật Firebase Authentication (Anonymous) và Firestore.

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
## Phát hành Cloud Run lần đầu (sau khi bật API)

Dùng runtime service account riêng. Không tải service-account JSON key hoặc đặt `GOOGLE_APPLICATION_CREDENTIALS` trên Cloud Run; Firebase Admin sẽ dùng Application Default Credentials của service identity đã gán.

```powershell
$project = "sochoai"
$region = "asia-southeast1"
$runtimeServiceAccount = "so-cho-ai-runtime@$project.iam.gserviceaccount.com"

# Một lần duy nhất: chỉ Owner/admin thực hiện các lệnh hạ tầng này.
gcloud iam service-accounts create so-cho-ai-runtime --project $project
gcloud projects add-iam-policy-binding $project --member "serviceAccount:$runtimeServiceAccount" --role roles/datastore.user

# Tạo Gemini key trong Secret Manager bằng Console, sau đó cấp quyền đọc cho identity này.
gcloud secrets add-iam-policy-binding so-cho-ai-gemini-api-key --project $project --member "serviceAccount:$runtimeServiceAccount" --role roles/secretmanager.secretAccessor
```

Tài khoản deployer cũng cần quyền gắn service account (`roles/iam.serviceAccountUser`). Deploy từ source sẽ dùng Dockerfile của repository; `.gcloudignore` loại trừ `.env.local`.

Deploy Firestore rules bằng Firebase Console, hoặc Firebase CLI đã đăng nhập đúng project:

```powershell
npx firebase-tools deploy --only firestore:rules --project sochoai
```

Tạo Secret Manager secret `so-cho-ai-gemini-api-key` trước khi deploy. Sau đó chạy lệnh dưới đây với Firebase **web config**; đây là cấu hình client công khai, không phải private key:

```powershell
gcloud run deploy so-cho-ai --project sochoai --source . --region asia-southeast1 --allow-unauthenticated --min-instances 0 --max-instances 1 --service-account so-cho-ai-runtime@sochoai.iam.gserviceaccount.com --set-secrets GEMINI_API_KEY=so-cho-ai-gemini-api-key:latest --set-env-vars "GOOGLE_CLOUD_PROJECT=sochoai,GEMINI_MODEL=gemini-2.5-flash,NEXT_PUBLIC_FIREBASE_API_KEY=REPLACE_ME,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=REPLACE_ME,NEXT_PUBLIC_FIREBASE_PROJECT_ID=sochoai,NEXT_PUBLIC_FIREBASE_APP_ID=REPLACE_ME"
```

Sau khi deploy, mở URL trả về trong cửa sổ ẩn danh. Xác nhận `/api/firebase-config` trả `configured: true`, Anonymous Authentication tạo UID, Firestore rules cô lập profile trình duyệt thứ hai, lưu tay hoạt động, và bearer token thiếu/không hợp lệ nhận `401` từ cả hai AI API.

Tham chiếu chính thức: [Cloud Run service identity](https://cloud.google.com/run/docs/securing/service-identity), [Cloud Run source deployment](https://cloud.google.com/run/docs/deploying-source-code) và [Firebase Admin SDK với Application Default Credentials](https://firebase.google.com/docs/admin/setup).
