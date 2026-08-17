"use client";

import { useMemo, useState } from "react";

import { formatVnd } from "@/lib/money";
import { calculateInventory } from "@/lib/reports/inventory";
import type { Product } from "@/types/catalog";
import type { ConfirmedTransaction } from "@/types/transaction";

type Props = {
  products: Product[];
  movements: import("@/types/catalog").StockMovement[];
  transactions: ConfirmedTransaction[];
  asOfDate: string;
  onSaveProduct: (input: { name: string; defaultUnit: string; lowStockThreshold: number }) => Promise<void | Product>;
  onAddAdjustment: (input: { product: Product; quantityDelta: number; reason: string; occurredAt: string }) => Promise<void>;
};

export function ProductCatalogWorkspace({ products, movements, transactions, asOfDate, onSaveProduct, onAddAdjustment }: Props) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");
  const [threshold, setThreshold] = useState("0");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const report = useMemo(() => calculateInventory(transactions, asOfDate, products, movements), [asOfDate, movements, products, transactions]);

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSaveProduct({ name, defaultUnit: unit, lowStockThreshold: Number(threshold) });
      setName("");
      setMessage("Da luu san pham.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khong the luu san pham.");
    }
  }

  async function submitAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) {
      setMessage("Chon san pham truoc khi dieu chinh.");
      return;
    }
    try {
      await onAddAdjustment({ product, quantityDelta: Number(delta), reason, occurredAt: asOfDate });
      setDelta("");
      setReason("");
      setMessage("Da ghi dieu chinh ton co ly do.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Khong the dieu chinh ton.");
    }
  }

  return (
    <section className="catalog-workspace" aria-labelledby="catalog-title">
      <div className="inventory-heading"><div><span className="eyebrow">DANH MUC HANG</span><h2 id="catalog-title">San pham va dieu chinh ton</h2><p>Khong tu quy doi don vi. Moi dieu chinh ton phai co ly do.</p></div></div>
      <div className="catalog-forms">
        <form className="catalog-form" onSubmit={(event) => void submitProduct(event)}>
          <h3>San pham moi</h3>
          <label><span>Ten mat hang</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Xoai cat" required /></label>
          <label><span>Don vi mac dinh</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="kg" required /></label>
          <label><span>Canh bao khi con lai &lt;=</span><input type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
          <button className="primary-button" type="submit">Luu san pham</button>
        </form>
        <form className="catalog-form" onSubmit={(event) => void submitAdjustment(event)}>
          <h3>Dieu chinh ton</h3>
          <label><span>San pham</span><select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} required><option value="">Chon san pham</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label><span>So luong thay doi (+/-)</span><input type="number" step="0.01" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="-2" required /></label>
          <label><span>Ly do</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Kiem ke thuc te" required /></label>
          <button className="secondary-button" type="submit">Ghi dieu chinh</button>
        </form>
      </div>
      {products.length > 0 ? <div className="catalog-stock-list">{report.rows.filter((row) => row.productId !== null).map((row) => <div className="catalog-stock-item" key={row.key}><span><strong>{row.itemName}</strong><small>{row.unit ?? ""}</small></span><b className={row.stockQuantity < 0 ? "inventory-negative" : row.isLow ? "inventory-low" : undefined}>{row.stockQuantity.toLocaleString("vi-VN")}</b><small>{row.estimatedStockValue === null ? "Chua co gia nhap" : formatVnd(row.estimatedStockValue)}</small></div>)}</div> : <p className="inventory-empty">Chua co san pham. Bao cao van suy ra mat hang tu giao dich.</p>}
      {message ? <p className="form-error" role="status">{message}</p> : null}
    </section>
  );
}
