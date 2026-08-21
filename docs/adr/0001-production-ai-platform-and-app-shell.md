# ADR 0001: Nâng Cấp Kiến Trúc Sổ Chợ AI Thành Production AI Platform & App Shell

## 1. Trạng Thái
**Đã duyệt (Accepted)** — Áp dụng cho toàn bộ dự án Sổ Chợ AI từ v0.2.0.

## 2. Bối Cảnh (Context)
Sổ Chợ AI đã hoàn thành giai đoạn MVP với các tính năng cốt lõi:
- Nhận diện giao dịch giọng nói / hóa đơn ảnh bằng Gemini Flash 2.5.
- Xác thực Firebase Auth & lưu trữ Firestore cô lập theo UID.
- Local fallback và outbox offline.
- Báo cáo doanh thu, công nợ, tồn kho, thuế và mục tiêu kinh doanh.

Tuy nhiên, hệ thống cần được nâng cấp để đạt chuẩn **Production AI Platform**:
- Tách biệt tầng Server HTTP, Authentication, Observability, và Model Gateway.
- Prompt registry có phiên bản và schema validation chặt chẽ.
- Hệ thống Outbox với exponential backoff & dead-letter queue.
- Giao diện AppShell module hóa thay vì dồn toàn bộ trên 1 trang đơn dài.
- Tuân thủ khả năng tiếp cận WCAG (cho phép pinch-to-zoom, accessible dialogs).

## 3. Quyết Định Kỹ Thuật (Decisions)

### 3.1. Phân Tách Server Layer & Error Taxonomy
- Gom toàn bộ logic xác thực vào `src/server/auth/require-user.ts`.
- Chuẩn hóa mã lỗi theo chuẩn REST & AI Platform (`401`, `403`, `413`, `422`, `429`, `502`, `503`) trong `src/server/http/errors.ts`.
- Mọi request API đều có `requestId` (header `x-request-id`) và log có cấu trúc (băm UID, không lưu PII/ảnh/audio thô).

### 3.2. AI Model Gateway & Prompt Registry
- Không gọi trực tiếp SDK Gemini trong các Route Handlers. Mọi thao tác AI đi qua `src/server/ai/provider.ts` và `src/server/ai/providers/gemini.ts`.
- Quản lý prompts tập trung trong `src/server/ai/prompts/` với metadata rõ ràng (id, version, schema contract, changelog).
- Thu thập metadata phiên trích xuất (`ExtractionRun`) và feedback sửa lỗi của người dùng phục vụ đánh giá (Evaluation).

### 3.3. Outbox Resilience & Data Layer
- Outbox offline bổ sung `retryCount`, `nextAttemptAt`, `lastErrorCode`, và áp dụng cơ chế Exponential Backoff (bắt đầu từ 1s, nhân đôi tối đa 60s).
- Thao tác nhạy cảm hỗ trợ `Idempotency-Key` ngăn chặn lãng phí quota AI hoặc trùng lặp thao tác ghi.

### 3.4. App Shell & Giao Diện Module Hóa
- Tách `page.tsx` thành `AppShell` hỗ trợ điều hướng đa nền tảng (Desktop Side Rail / Mobile Bottom Navigation).
- Cho phép pinch-to-zoom trên trình duyệt (`maximumScale` không bị khóa cứng).
- Tách CSS thành hệ thống tokens (`src/styles/tokens.css`) và motion (`src/styles/motion.css`).

## 4. Hệ Quả (Consequences)
- **Tích cực:** Độ tin cậy cao, dễ dàng kiểm thử độc lập từng tầng, sẵn sàng cho việc mở rộng quy mô (scale) và tích hợp các provider AI khác nếu cần.
- **Lưu ý:** Cần đảm bảo backward compatibility cho các dữ liệu outbox đã lưu ở phiên bản cũ và duy trì 100% test pass.
