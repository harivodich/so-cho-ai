# Sổ Chợ AI - Hợp Đồng Kỹ Thuật AI (AI Contracts)

## 1. Ranh Giới Quyền Hạn & Quyền Riêng Tư (Privacy & Trust Boundaries)
1. **Zero-Execution Authority:** AI không bao giờ được phép trực tiếp ghi hay sửa đổi cơ sở dữ liệu (Firestore / Local DB). AI chỉ tạo bản nháp (`TransactionDraft`), bắt buộc người dùng bấm xác nhận.
2. **No Raw Media Persistence:** Tệp âm thanh và hình ảnh hóa đơn chỉ tồn tại trong bộ nhớ RAM tạm thời phục vụ trích xuất, tuyệt đối không lưu trữ lâu dài trên server hay log.
3. **Aggregate-Only Insights:** API `/api/insights` chỉ nhận các số liệu tổng hợp (KPIs, tổng thu chi, số lượng giao dịch), không nhận raw transaction payload.

## 2. ExtractionRun Metadata Contract
Mỗi lần gọi AI trích xuất (Voice / Image) sinh ra metadata định danh:
```typescript
export type ExtractionRun = {
  runId: string;
  mode: "voice" | "image";
  model: string;
  promptVersion: string;
  latencyMs: number;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  draftCount: number;
  qualityCheckCount: number;
  needsReview: boolean;
};
```

## 3. Human Feedback Contract (Privacy-Safe)
Ghi nhận tỷ lệ sửa đổi bản nháp của người dùng trước khi lưu để đánh giá chất lượng prompt:
```typescript
export type DraftCorrectionEvent = {
  runId: string;
  mode: "voice" | "image";
  field: "type" | "amount" | "item" | "quantity" | "unit" | "note";
  wasModified: boolean;
  originalEmpty: boolean;
};
```
