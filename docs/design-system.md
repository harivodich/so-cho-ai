# Sổ Chợ AI - Design System ("Modern Market Ledger")

## 1. Triết Lý Thiết Kế (Design Philosophy)
Thiết kế giao diện sổ chợ hiện đại: Thân thiện, tin cậy, tối ưu cho thao tác một tay trên thiết bị di động, tôn trọng độ tương phản và khả năng tiếp cận (Accessibility).

## 2. Bảng Màu (Color Tokens)
- **Canvas / Background:** `#f6f5ee` (Nền giấy ấm cổ điển, giảm mỏi mắt)
- **Surface:** `#ffffff` (Bề mặt thẻ trắng sáng)
- **Surface Soft:** `#f4f6f1` (Nền vùng phụ trợ)
- **Ink Primary:** `#142219` (Chữ chính xanh đen đậm, tương phản > 7:1)
- **Ink Soft:** `#4a5d52` (Chữ phụ chú giải)
- **Ink Faint:** `#738479` (Placeholder & viền mờ)
- **Brand Green (Primary / Trust):** `#0f6b4a` / `#09543a` (Xanh ngọc thương hiệu)
- **Amber (Warning / Debt Alert):** `#9b650e` / `#fff8e5` (Cảnh báo tài chính)
- **Coral Red (Destructive / Overdue):** `#b44738` / `#fff0ed` (Lỗi / Quá hạn)
- **AI Violet (AI Badge / Insight):** `#5b21b6` / `#f3e8ff` (Điểm nhấn trí tuệ nhân tạo)

## 3. Thang Đo Bo Góc Đồng Tâm (Concentric Radius Scale)
- `--radius-full: 9999px` (Badges, Pills, Chips, Filter buttons)
- `--radius-xl: 20px` (Khung bao lớn: Panels, Workspaces, Modal Shells)
- `--radius-lg: 14px` (Thẻ con: KPI Cards, Debt Items, Form Boxes)
- `--radius-md: 10px` (Tương tác: Buttons, Inputs, Selects, Date Pickers)
- `--radius-sm: 8px` (Micro elements: Nested action buttons, tags)
- `--radius-xs: 6px` (Pointers, Tooltips)

## 4. Quy Tắc Chuyển Động (Motion & Interaction Guidelines)
- **Hover Transitions:** `150ms - 200ms cubic-bezier(0.4, 0, 0.2, 1)`.
- **Active / Press States:** `transform: scale(0.97)` cho phản hồi vật lý.
- **Card Lift:** `transform: translateY(-2px)` kèm tăng độ sâu bóng đổ `box-shadow`.
- **Accessibility:** Tôn trọng `@media (prefers-reduced-motion: reduce)` (tắt transform lớn và lặp vô hạn).
