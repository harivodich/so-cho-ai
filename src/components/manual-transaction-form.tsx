"use client";

import { useState } from "react";

import { currentLocalDate } from "@/lib/date";
import { createManualDraft, type TransactionDraft, type TransactionType } from "@/types/transaction";

type Props = {
  initialDraft?: TransactionDraft | null;
  onCancel: () => void;
  onPreview: (draft: TransactionDraft) => void;
};

const typeLabels: Record<TransactionType, string> = {
  sale: "Bán hàng",
  purchase: "Nhập hàng",
  expense: "Chi phí khác",
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
      setFormError("Nhập tổng tiền lớn hơn 0 trước khi xem lại.");
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
    onPreview(
      createManualDraft({
        type,
        itemName,
        quantity: parsedQuantity,
        unit: unit.trim() || undefined,
        unitPrice: parsedUnitPrice,
        amount: parsedAmount,
        occurredAt,
      }),
    );
  }

  return (
    <form className="entry-form" onSubmit={submit} noValidate>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Nhập tay</p>
          <h2>Ghi một giao dịch</h2>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>
          Hủy
        </button>
      </div>

      <fieldset>
        <legend>Loại giao dịch</legend>
        <div className="type-options">
          {(Object.keys(typeLabels) as TransactionType[]).map((value) => (
            <label className={type === value ? "type-option selected" : "type-option"} key={value}>
              <input checked={type === value} name="type" type="radio" value={value} onChange={() => setType(value)} />
              {typeLabels[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Tên mặt hàng {type === "expense" ? "(không bắt buộc)" : ""}
        <input value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder={type === "expense" ? "Ví dụ: tiền đá" : "Ví dụ: xoài"} />
      </label>

      <div className="field-grid">
        <label>
          Số lượng
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
          Đơn vị
          <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="kg" />
        </label>
      </div>

      <div className="field-grid">
        <label>
          Đơn giá (đ)
          <input
            inputMode="numeric"
            min="0"
            value={unitPrice}
            onChange={(event) => {
              const value = event.target.value;
              setUnitPrice(value);
              updateCalculatedAmount(quantity, value);
            }}
            placeholder="35000"
          />
        </label>
        <label>
          Tổng tiền (đ) <span className="required">*</span>
          <input inputMode="numeric" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="700000" />
        </label>
      </div>

      <label>
        Ngày giao dịch
        <input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
      </label>

      {formError ? <p className="form-error" role="alert">{formError}</p> : null}
      <button className="primary-button" type="submit">Xem lại trước khi lưu</button>
    </form>
  );
}
