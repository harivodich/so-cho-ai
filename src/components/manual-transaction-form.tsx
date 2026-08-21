"use client";

import { useMemo, useState } from "react";

import { UiIcon, type IconName } from "@/components/ui-icon";
import { currentLocalDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { triggerHapticFeedback } from "@/lib/haptic";
import { canonicalizeItemName, createManualDraft, type ConfirmedTransaction, type TransactionDraft, type TransactionType } from "@/types/transaction";
import type { Product } from "@/types/catalog";

type Props = {
  initialDraft?: TransactionDraft | null;
  products?: Product[];
  transactions?: ConfirmedTransaction[];
  onCancel: () => void;
  onPreview: (draft: TransactionDraft) => void;
};

const typeOptions: Record<TransactionType, { label: string; icon: IconName }> = {
  sale: { label: "Bán hàng", icon: "sale" },
  purchase: { label: "Nhập hàng", icon: "purchase" },
  expense: { label: "Chi phí", icon: "expense" },
};

const QUICK_AMOUNTS = [
  { label: "+10k", value: 10_000 },
  { label: "+20k", value: 20_000 },
  { label: "+50k", value: 50_000 },
  { label: "+100k", value: 100_000 },
  { label: "+200k", value: 200_000 },
  { label: "+500k", value: 500_000 },
];

function decimalValue(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const number = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function ManualTransactionForm({ initialDraft, products = [], transactions = [], onCancel, onPreview }: Props) {
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
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Suggestions from catalog products and recent transactions
  const suggestions = useMemo(() => {
    const query = itemName.trim().toLowerCase();
    const map = new Map<string, { name: string; unit: string; latestPrice?: number }>();

    // Add catalog products
    for (const p of products) {
      map.set(p.canonicalName, { name: p.name, unit: p.defaultUnit });
    }

    // Add distinct items from recent transactions with their unit and price
    for (const t of transactions) {
      if (t.itemName) {
        const key = canonicalizeItemName(t.itemName) ?? t.itemName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: t.itemName,
            unit: t.unit ?? "kg",
            latestPrice: t.unitPrice ?? undefined,
          });
        } else if (t.unitPrice && !map.get(key)?.latestPrice) {
          const item = map.get(key)!;
          item.latestPrice = t.unitPrice;
        }
      }
    }

    const all = Array.from(map.values());
    if (!query) return all.slice(0, 6);
    return all.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 6);
  }, [itemName, products, transactions]);

  function selectSuggestion(item: { name: string; unit: string; latestPrice?: number }) {
    triggerHapticFeedback(20);
    setItemName(item.name);
    if (item.unit) setUnit(item.unit);
    if (item.latestPrice) {
      setUnitPrice(String(item.latestPrice));
      const parsedQty = decimalValue(quantity);
      if (parsedQty) {
        setAmount(String(Math.round(parsedQty * item.latestPrice)));
      }
    }
    setShowSuggestions(false);
  }

  function addQuickAmount(delta: number) {
    triggerHapticFeedback(15);
    const current = Number(amount.replace(/[^0-9]/g, "")) || 0;
    const nextAmount = current + delta;
    setAmount(String(nextAmount));
  }

  function clearAmount() {
    triggerHapticFeedback(15);
    setAmount("");
  }

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

    triggerHapticFeedback(30);
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
              <input
                checked={type === value}
                name="type"
                type="radio"
                value={value}
                onChange={() => {
                  triggerHapticFeedback(15);
                  setType(value);
                }}
              />
              <UiIcon name={typeOptions[value].icon} size={19} />
              <span>{typeOptions[value].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="item-name-field-container">
        <label>
          <span className="field-label">Tên mặt hàng {type === "expense" ? <em>Không bắt buộc</em> : null}</span>
          <input
            value={itemName}
            onChange={(event) => {
              setItemName(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={type === "expense" ? "Ví dụ: tiền đá, vận chuyển" : "Ví dụ: xoài Cát Hòa Lộc"}
            autoComplete="off"
          />
        </label>
        {showSuggestions && suggestions.length > 0 ? (
          <div className="item-autocomplete-dropdown" role="listbox">
            {suggestions.map((item) => (
              <button
                type="button"
                className="autocomplete-item"
                key={item.name}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(item);
                }}
              >
                <span className="autocomplete-name">{item.name}</span>
                <span className="autocomplete-meta">
                  {item.unit ? `ĐV: ${item.unit}` : ""}
                  {item.latestPrice ? ` · ${formatVnd(item.latestPrice)}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

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

      {/* Quick Amount Chips */}
      <div className="quick-amount-section">
        <span className="quick-amount-label">Cộng nhanh số tiền:</span>
        <div className="quick-amount-chips">
          {QUICK_AMOUNTS.map((item) => (
            <button
              type="button"
              className="quick-amount-chip"
              key={item.label}
              onClick={() => addQuickAmount(item.value)}
            >
              {item.label}
            </button>
          ))}
          {amount ? (
            <button
              type="button"
              className="quick-amount-chip chip-clear"
              onClick={clearAmount}
              title="Xóa tổng tiền"
            >
              <UiIcon name="trash" size={13} /> Xóa
            </button>
          ) : null}
        </div>
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
