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
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

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
    setHighlightedIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) {
      if (event.key === "ArrowDown") {
        setShowSuggestions(true);
        setHighlightedIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        event.preventDefault();
        selectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
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
        <label htmlFor="manual-item-name-input">
          <span className="field-label">Tên mặt hàng {type === "expense" ? <em>Không bắt buộc</em> : null}</span>
          <input
            id="manual-item-name-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-controls="item-name-suggestions"
            aria-activedescendant={
              showSuggestions && highlightedIndex >= 0 ? `suggestion-opt-${highlightedIndex}` : undefined
            }
            value={itemName}
            onChange={(event) => {
              setItemName(event.target.value);
              setShowSuggestions(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
            onKeyDown={handleKeyDown}
            placeholder={type === "expense" ? "Ví dụ: tiền đá, vận chuyển" : "Ví dụ: xoài Cát Hòa Lộc"}
            autoComplete="off"
          />
        </label>
        {showSuggestions && suggestions.length > 0 ? (
          <div className="item-autocomplete-dropdown" id="item-name-suggestions" role="listbox" aria-label="Gợi ý mặt hàng">
            {suggestions.map((item, idx) => (
              <button
                type="button"
                id={`suggestion-opt-${idx}`}
                role="option"
                aria-selected={highlightedIndex === idx || itemName === item.name}
                className={`autocomplete-item ${highlightedIndex === idx ? "focused" : ""}`}
                key={item.name}
                onMouseEnter={() => setHighlightedIndex(idx)}
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
          <span className="field-label">Đơn vị tính</span>
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="kg, thùng, bó..."
          />
        </label>
      </div>

      <div className="field-grid">
        <label>
          <span className="field-label">Đơn giá (VND)</span>
          <input
            inputMode="numeric"
            value={unitPrice}
            onChange={(event) => {
              const value = event.target.value;
              setUnitPrice(value);
              updateCalculatedAmount(quantity, value);
            }}
            placeholder="15000"
          />
        </label>

        <label>
          <span className="field-label">Ngày giao dịch</span>
          <input
            type="date"
            max={currentLocalDate()}
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </label>
      </div>

      <label>
        <span className="field-label">Tổng tiền (VND) *</span>
        <input
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="300000"
          required
        />
      </label>

      <div className="quick-amount-chips">
        {QUICK_AMOUNTS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="quick-chip"
            onClick={() => addQuickAmount(chip.value)}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          className="quick-chip quick-chip-clear"
          onClick={clearAmount}
          title="Xóa số tiền"
        >
          Xóa
        </button>
      </div>

      {/* Tax Section */}
      <div className="tax-collapsible">
        <label className="tax-checkbox-label">
          <input
            type="checkbox"
            checked={taxApplied}
            onChange={(e) => {
              triggerHapticFeedback(15);
              setTaxApplied(e.target.checked);
              if (e.target.checked && taxRate === "0") setTaxRate("1.5");
            }}
          />
          <span>Tính thuế khoán tham khảo (hộ kinh doanh)</span>
        </label>

        {taxApplied ? (
          <div className="tax-inputs-row">
            <label>
              <span className="field-label">Thuế suất %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </label>
            <div className="tax-summary-badge">
              <span>Tiền thuế: </span>
              <strong>
                {formatVnd(Math.round(((decimalValue(amount) || 0) * (Number(taxRate) || 0)) / 100))}
              </strong>
            </div>
          </div>
        ) : null}
      </div>

      {formError ? (
        <p className="form-error" role="alert">
          <UiIcon name="alert" size={18} /> {formError}
        </p>
      ) : null}

      <div className="form-actions">
        <button className="primary-button" type="submit">
          Xem trước bản nháp <UiIcon name="chevron-right" size={17} />
        </button>
      </div>
    </form>
  );
}
