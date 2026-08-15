# Kiến trúc AI/ML — Sổ Chợ AI

```mermaid
flowchart LR
  A[Audio tối đa 5 MB] --> B[POST /api/extract<br/>Firebase ID token + quota]
  B --> C[Gemini 2.5 Flash<br/>Structured Output]
  C --> D[Zod schema]
  D --> E[Data Quality Guard<br/>amount, date, multi-transaction, outlier]
  E --> F[Người dùng sửa và xác nhận]
  F --> G[Firestore theo UID]
  G --> H[Code tính report + evidence 7 ngày]
  H --> I[Gemini insight<br/>chỉ aggregate, quota riêng]
```

## Ranh giới tin cậy

- Audio và nội dung nói là dữ liệu không tin cậy; chúng không thể đổi prompt, gọi tool hay ghi dữ liệu.
- Gemini chỉ trả draft; không có quyền Firestore.
- Zod và Data Quality Guard chạy server-side trước màn hình xác nhận.
- Chỉ thao tác xác nhận của người dùng mới ghi transaction.
- Insight chỉ nhận aggregate do code tính. Không gửi raw transaction, UID, audio hay transcript riêng tư.

## Bằng chứng chất lượng

- Evaluation text: 60 mẫu project-authored, nhãn khóa trước khi gọi model.
- Report public chỉ được sinh bằng `publish-text-report.mjs`; script từ chối fixture.
- Model/prompt/timestamp, field metrics, nhóm lỗi và ví dụ đúng/sai/guard được hiển thị trong AI Quality Lab.
- Voice benchmark tách riêng khỏi text benchmark và chỉ công bố khi có audio synthetic/public hợp lệ.
