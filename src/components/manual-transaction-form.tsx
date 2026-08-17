"use client";

import { useState } from "react";

import { UiIcon, type IconName } from "@/components/ui-icon";
import { currentLocalDate } from "@/lib/date";
import { createManualDraft, type TransactionDraft, type TransactionType } from "@/types/transaction";

type Props = {
  initialDraft?: TransactionDraft | null;
  onCancel: () => void;
  onPreview: (draft: TransactionDraft) => void;
};

const typeOptions: Record<TransactionType, { label: string; icon: IconName }> = {
  sale: { label: "Bán hàng", icon: "sale" },
  purchase: { label: "Nhập hàng", icon: "purchase" },
  expense: { label: "Chi phí", icon: "expense" },
};

function decimalValue(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function ManualTransactionForm({ initialDraft, onCancel, onPreview }: Props) {
  const [type, setType] = useState<TransactionType>(initialDraft?.type ?? "sale");
  const [itemName, setItemName] = useState(initialDraft?.itemName ?? "");
  const [quantity, setQuantity] = useState(initialDraft?.quantity?.toString() ?? "");
  const [unit, setUnit] = useState(initialDraft?.unit ?? "kg");
  const [unitPrice, setUnitPrice] = useState(initialDraft?.unitPrice?.toString() ?? "");
  const [amount, setAmount] = useState(initialDraft?.amount?.toString() ?? "");
  const [occurredAt, setOccurredAt] = useState(initialDraft?.occurredAt ?? currentLocalDate());
  const [taxApplied, setTaxApplied] = useState(initialDraft?.tax?.applied ?? false);
  const [taxRate, setTaxRate] = useState(String(initialDraft?.tax?.taxRatePercent ?? 0));
  const [formError, setFormError] = useState<string | null>(null);

  function updateCalculatedAmount(nextQuantity: string, nextUnitPrice: string) {
    const parsedQuantity = decimalValue(nextQuantity);
    const parsedUnitPrice = decimalValue(nextUnitPrice);
    if (parsedQuantity && parsedUnitPrice) {
      setAmount(String(Math.round(parsedQuantity * parsedUnitPrice)));
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = decimalValue(amount);
    const parsedQuantity = decimalValue(quantity);
    const parsedUnitPrice = decimalValue(unitPrice);

    if (!parsedAmount) {
      setFormError("Nhập tổng tiền lớn hơn 0 trước khi xem bản nháp.");
      return;
    }
    if ((type === "sale" || type === "purchase") && !itemName.trim()) {
      setFormError("Bán hàng hoặc nhập hàng cần có tên mặt hàng.");
      return;
    }
    if (!occurredAt) {
      setFormError("Chọn ngày giao dịch.");
      return;
    }

    setFormError(null);
    const parsedTaxRate = Math.min(Math.max(Number(taxRate) || 0, 0), 100);
    const baseDraft = createManualDraft({
      type,
      itemName,
      quantity: parsedQuantity,
      unit: unit.trim() || undefined,
      unitPrice: parsedUnitPrice,
      amount: parsedAmount,
      occurredAt,
    });
    onPreview({
      ...baseDraft,
      tax: {
        applied: taxApplied,
        subtotal: parsedAmount,
        taxRatePercent: taxApplied ? parsedTaxRate : 0,
        taxAmount: taxApplied ? Math.round(parsedAmount * parsedTaxRate / 100) : 0,
        total: parsedAmount + (taxApplied ? Math.round(parsedAmount * parsedTaxRate / 100) : 0),
      },
    });
  }

  return (
    <form className="entry-form" onSubmit={submit} noValidate>
      <div className="section-heading panel-heading">
        <div>
          <h1>Nhập giao dịch</h1>
          <p className="section-description">Điền nhanh các thông tin bạn có. Bạn sẽ kiểm tra lại trước khi lưu.</p>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>
          <UiIcon name="arrow-left" size={18} /> Quay lại
        </button>
      </div>

      <fieldset>
        <legend>Loại giao dịch</legend>
        <div className="type-options">
          {(Object.keys(typeOptions) as TransactionType[]).map((value) => (
            <label className={type === value ? "type-option selected" : "type-option"} key={value}>
              <input checked={type === value} name="type" type="radio" value={value} onChange={() => setType(value)} />
              <UiIcon name={typeOptions[value].icon} size={19} />
              <span>{typeOptions[value].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span className="field-label">Tên mặt hàng {type === "expense" ? <em>Không bắt buộc</em> : null}</span>
        <input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={type === "expense" ? "Ví dụ: tiền đá, vận chuyển" : "Ví dụ: xoài Cát Hòa Lộc"} />
      </label>

      <div className="field-grid">
        <label>
          <span className="field-label">Số lượng</span>
          <input
            inputMode="decimal"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => {
              const value = event.target.value;
              setQuantity(value);
              updateCalculatedAmount(value, unitPrice);
            }}
            placeholder="20"
          />
        </label>
        <label>
          <span className="field-label">Đơn vị</span>
          <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="kg" />
        </label>
      </div>

      <div className="field-grid">
        <label>
          <span className="field-label">Đơn giá <em>đ</em></span>
          <input
            inputMode="numeric"
            min="0"
            value={unitPrice}
            onChange={(event) => {
              const value = event.target.value;
              setUnitPrice(value);
              updateCalculatedAmount(quantity, value);
            }}
            placeholder="35.000"
          />
        </label>
        <label>
          <span className="field-label">Tổng tiền <b>*</b></span>
          <input inputMode="numeric" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="700.000" />
        </label>
      </div>

      <fieldset className="tax-inline-fields">
        <legend>Thuế (tùy chọn)</legend>
        <label><span className="field-label"><input type="checkbox" checked={taxApplied} onChange={(event) => setTaxApplied(event.target.checked)} /> Áp dụng thuế cho giao dịch này</span></label>
        {taxApplied ? <label><span className="field-label">Tỷ lệ thuế (%)</span><input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></label> : null}
      </fieldset>
      <label>
        <span className="field-label">Ngày giao dịch</span>
        <input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
      </label>

      {formError ? <p className="form-error" role="alert"><UiIcon name="alert" size={19} />{formError}</p> : null}
      <button className="primary-button form-submit" type="submit">
        Xem bản nháp <UiIcon name="chevron-right" size={19} />
      </button>
    </form>
  );
}
