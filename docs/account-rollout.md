# Tài khoản và dữ liệu riêng

## Luồng đã triển khai

- Người dùng mới lưu cục bộ theo device scope khi chưa đăng nhập; Firebase không tự tạo anonymous mới. Phiên anonymous cũ vẫn được giữ để có thể nâng cấp có chủ đích.
- Nâng cấp bằng Google hoặc email/mật khẩu sẽ liên kết với phiên hiện tại; UID giao dịch được giữ nguyên.
- Nếu trình duyệt có giao dịch local cũ, panel Tài khoản hiện nút nhập vào tài khoản sau khi đăng nhập.
- API voice, ảnh và nhận xét AI từ chối token Anonymous ở server.
- Hồ sơ tối thiểu được ghi ở `users/{uid}/profile/main`; giao dịch ở `users/{uid}/transactions`; công nợ ở `users/{uid}/debts`.

## Checklist Firebase Console

1. Authentication → Sign-in method: bật Google và Email/Password.
2. Authentication → Settings → Authorized domains: thêm domain Vercel production và `localhost` khi chạy local.
3. Firestore Rules: deploy `firestore.rules` sau khi kiểm tra trên hai tài khoản khác nhau.
4. Vercel: đặt `NEXT_PUBLIC_FIREBASE_*` ở Production/Preview; không đưa Admin service account hoặc Gemini key vào bundle.
5. Test: đăng nhập bằng hai tài khoản, tạo giao dịch/công nợ ở tài khoản A và xác nhận tài khoản B không đọc được.

## Giới hạn công khai

- Phiên tạm vẫn có thể ghi sổ thủ công để tránh mất dữ liệu; cần tài khoản thật cho các luồng AI.
- Xóa tài khoản trong ứng dụng sẽ xóa giao dịch và công nợ trước khi xóa user Auth.
- Khu vực Sao lưu dữ liệu cho phép xuất/nhập JSON có kiểm tra schema; nên lưu một bản trước khi đổi thiết bị hoặc xóa tài khoản.
- Tỷ lệ thuế là tham số tham khảo do người dùng nhập, không phải tư vấn hoặc tờ khai thuế.


## Chuyen tai khoan an toan

- Tao tai khoan moi bang Google hoac email se link vao UID tam hien tai va giu du lieu.
- Dang nhap vao tai khoan da ton tai se doi UID; UI bat buoc xac nhan va khuyen nghi xuat backup truoc.
- Sau khi dang nhap, nhap backup lai neu can gop du lieu; khong tu dong tron hai UID de tranh ghi de am tham.
- Ho so tai khoan luu tai users/{uid}/profile/main; settings va muc tieu doanh thu luu trong users/{uid}/settings.
## Xóa tài khoản an toàn

- Client gửi Firebase ID token tới POST /api/account/delete.
- Server xác minh token với verifyIdToken(token, true).
- Firebase Admin recursiveDelete xóa toàn bộ cây users/{uid}; chỉ sau khi bước này thành công mới xóa Firebase Auth user.
- Client chỉ dọn fallback local sau khi server trả về thành công; lỗi mạng không làm mất dữ liệu trước khi người dùng retry.