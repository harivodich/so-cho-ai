"use client";

import { formatVietnameseDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { TransactionDraft } from "@/types/transaction";

type Props = {
  draft: TransactionDraft;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
};

const labels = {
  sale: "Bán hàng",
  purchase: "Nhập hàng",
  expense: "Chi phí khác",
} as const;

export function ConfirmationPanel({ draft, isSaving, onEdit, onSave }: Props) {
  return (
    <section className="confirmation-panel" aria-labelledby="confirmation-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Xác nhận bắt buộc</p>
          <h2 id="confirmation-title">Kiểm tra trước khi lưu</h2>
        </div>
        <span className="review-badge">Chưa lưu</span>
      </div>

      <dl className="summary-list">
        <div><dt>Loại</dt><dd>{draft.type ? labels[draft.type] : "Chưa xác định"}</dd></div>
        <div><dt>Mặt hàng</dt><dd>{draft.itemName ?? "—"}</dd></div>
        <div><dt>Số lượng</dt><dd>{draft.quantity ? `${draft.quantity} ${draft.unit ?? ""}`.trim() : "—"}</dd></div>
        <div><dt>Đơn giá</dt><dd>{draft.unitPrice ? formatVnd(draft.unitPrice) : "—"}</dd></div>
        <div><dt>Tổng tiền</dt><dd className="amount">{draft.amount ? formatVnd(draft.amount) : "—"}</dd></div>
        <div><dt>Ngày</dt><dd>{draft.occurredAt ? formatVietnameseDate(draft.occurredAt) : "—"}</dd></div>
      </dl>

      {[...draft.warnings, ...draft.missingFields.map((field) => `Thiếu thông tin: ${field}`)].map((warning) => (
        <p className="warning" key={warning}>{warning}</p>
      ))}

      <div className="action-row">
        <button className="secondary-button" type="button" onClick={onEdit} disabled={isSaving}>Chỉnh sửa</button>
        <button className="primary-button" type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Đang lưu…" : "Xác nhận lưu"}
        </button>
      </div>
    </section>
  );
}
