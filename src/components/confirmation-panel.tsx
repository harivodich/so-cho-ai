"use client";

import { UiIcon } from "@/components/ui-icon";
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

const missingFieldMessages: Record<string, string> = {
  type: "Chưa có loại giao dịch. Chọn loại trước khi lưu.",
  itemName: "Chưa nhận rõ mặt hàng. Bạn có thể bổ sung trước khi lưu.",
  quantity: "Chưa có số lượng. Bạn vẫn có thể lưu vì đã có tổng tiền.",
  unitPrice: "Chưa có đơn giá. Bạn vẫn có thể lưu vì đã có tổng tiền.",
  amount: "Chưa có tổng tiền. Nhập tổng tiền trước khi lưu.",
  occurredAt: "Chưa có ngày giao dịch. Chọn ngày trước khi lưu.",
};

function missingFieldMessage(field: string): string {
  return missingFieldMessages[field] ?? `Cần kiểm tra: ${field}`;
}

export function ConfirmationPanel({ draft, isSaving, onEdit, onSave }: Props) {
  const notices = [...draft.warnings, ...draft.missingFields.map(missingFieldMessage)];

  return (
    <section className="confirmation-panel" aria-labelledby="confirmation-title">
      <div className="section-heading panel-heading">
        <div>
          <h1 id="confirmation-title">Kiểm tra giao dịch</h1>
          <p className="section-description">Đây là bản nháp. Giao dịch chỉ được ghi vào sổ khi bạn bấm lưu.</p>
        </div>
        <span className="review-badge"><UiIcon name="pencil" size={15} /> Chưa lưu</span>
      </div>

      <dl className="summary-list">
        <div><dt>Loại giao dịch</dt><dd>{draft.type ? labels[draft.type] : "Chưa xác định"}</dd></div>
        <div><dt>Mặt hàng</dt><dd>{draft.itemName ?? "—"}</dd></div>
        <div><dt>Số lượng</dt><dd>{draft.quantity ? `${draft.quantity} ${draft.unit ?? ""}`.trim() : "—"}</dd></div>
        <div><dt>Đơn giá</dt><dd>{draft.unitPrice ? formatVnd(draft.unitPrice) : "—"}</dd></div>
        <div className="summary-total"><dt>Tổng tiền</dt><dd>{draft.amount ? formatVnd(draft.amount) : "—"}</dd></div>
        {draft.tax ? <div><dt>Thuế</dt><dd>{draft.tax.applied ? draft.tax.taxRatePercent + "% · " + formatVnd(draft.tax.taxAmount) + " · tổng " + formatVnd(draft.tax.total) : "Không áp dụng"}</dd></div> : null}
        <div><dt>Ngày giao dịch</dt><dd>{draft.occurredAt ? formatVietnameseDate(draft.occurredAt) : "—"}</dd></div>
      </dl>

      {draft.qualityChecks.length > 0 ? (
        <section className="quality-checks" aria-labelledby="quality-checks-title">
          <h2 id="quality-checks-title"><UiIcon name="alert" size={18} /> Cần kiểm tra trước khi lưu</h2>
          {draft.qualityChecks.map((check) => (
            <article key={`${check.field}-${check.reason}`} className="quality-check">
              <strong>{check.field}</strong>
              <span>Giá trị AI: {check.value}</span>
              <p>{check.reason}</p>
              <p><b>Bạn cần làm:</b> {check.action}</p>
            </article>
          ))}
        </section>
      ) : null}

      {notices.map((warning) => (
        <p className="warning" key={warning}><UiIcon name="alert" size={18} />{warning}</p>
      ))}

      <div className="action-row">
        <button className="secondary-button" type="button" onClick={onEdit} disabled={isSaving}>
          <UiIcon name="pencil" size={18} /> Sửa lại
        </button>
        <button className="primary-button" type="button" onClick={onSave} disabled={isSaving}>
          <UiIcon name="check" size={19} /> {isSaving ? "Đang lưu…" : "Lưu giao dịch"}
        </button>
      </div>
    </section>
  );
}
