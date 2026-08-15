# Triển khai miễn phí trên Vercel

Vercel Hobby là phương án public demo không cần Google Cloud Billing. Vercel chạy Next.js và hai API server (`/api/extract`, `/api/insights`); Firebase vẫn là nơi xác thực và lưu Firestore.

> Không dán Gemini API key hoặc service-account JSON vào GitHub, chat, source code hay biến `NEXT_PUBLIC_*`.

## 1. Tạo service account riêng cho Vercel

Trong Google Cloud Console của project `sochoai`:

1. Vào **IAM & Admin → Service Accounts → Create service account**; đặt tên `so-cho-ai-vercel`.
2. Chỉ cấp hai role cho service account này: **Cloud Datastore User** và **Firebase Authentication Admin**.
3. Mở service account vừa tạo → **Keys → Add key → Create new key → JSON**. Tải file xuống một nơi an toàn, ngoài repository.

Key này cho API server xác minh Firebase ID token (kể cả revoked token) và đọc/ghi quota Firestore. Nó không được đưa vào browser. Nếu nghi ngờ lộ key, xóa key trong Google Cloud Console, tạo key mới và cập nhật Vercel ngay.

## 2. Tạo Vercel project

1. Đăng nhập [Vercel](https://vercel.com), chọn **Add New → Project**.
2. Import GitHub repository `so-cho-ai`; framework phải được nhận là **Next.js**, Root Directory là `.`.
3. Không thêm Build Command, Output Directory hoặc `vercel.json`: Vercel tự nhận diện Next.js.
4. Trong **Project → Settings → Environment Variables**, tạo các biến sau cho **Production**. Có thể thêm cả **Preview** khi muốn thử deployment nhánh.

| Biến | Giá trị | Có công khai? |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web config | Có |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web config | Có |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `sochoai` | Có |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web config | Có |
| `GEMINI_API_KEY` | Gemini key mới/đã xoay | Không |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Không cần công khai |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` | Toàn bộ nội dung JSON của key ở bước 1, trên **một dòng** | Không |

Không import trực tiếp toàn bộ `.env.local` vào dashboard. Tạo từng biến để tránh nạp nhầm biến local hoặc secret không liên quan. Vercel chỉ áp dụng biến mới cho deployment kế tiếp, nên cần redeploy sau khi lưu.

## 3. Deploy và smoke test

1. Bấm **Deploy**. Vercel trả một URL `https://…vercel.app`.
2. Mở URL bằng cửa sổ ẩn danh và xác nhận `/api/firebase-config` trả `configured: true`.
3. Nhập tay một giao dịch, tải lại trang, bảo đảm dữ liệu vẫn còn.
4. Mở cửa sổ ẩn danh thứ hai; UID mới không được thấy dữ liệu cửa sổ đầu.
5. Thử một request AI hợp lệ và một request thiếu bearer token; request thiếu token phải nhận `401`.
6. Nếu Anonymous Authentication báo lỗi domain, thêm hostname `…vercel.app` vào Firebase Authentication → Settings → Authorized domains rồi thử lại.

## Sự cố thường gặp

| Hiện tượng | Kiểm tra trước |
| --- | --- |
| API trả `503` khi xác thực Firebase | JSON service account phải nguyên vẹn, cùng project `sochoai`, không có prefix `NEXT_PUBLIC_`; redeploy sau khi sửa. |
| Build có giao diện nhưng Firebase báo chưa cấu hình | Kiểm tra đủ bốn biến `NEXT_PUBLIC_FIREBASE_*` ở môi trường Production. |
| Gemini trả `503` | Kiểm tra `GEMINI_API_KEY`, model `gemini-2.5-flash`, quota Gemini; không gửi key qua chat để debug. |
| Vercel URL hoạt động nhưng Firebase đăng nhập lỗi | Kiểm tra Anonymous Authentication đang bật và hostname nằm trong Authorized domains khi Firebase yêu cầu. |

Vercel Hobby có giới hạn dành cho demo nhỏ. [Vercel Hobby](https://vercel.com/docs/plans/hobby) và [Vercel Environment Variables](https://vercel.com/docs/environment-variables) là nguồn tham chiếu cho quota/cấu hình hiện hành. Hướng dẫn Cloud Run cũ vẫn nằm ở [`cloud-access.md`](cloud-access.md) nếu sau này có billing; không cần dùng nó cho deployment này.
