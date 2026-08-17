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
      setMessage("Đã lưu sản phẩm.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu sản phẩm.");
    }
  }

  async function submitAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) {
      setMessage("Chọn sản phẩm trước khi điều chỉnh.");
      return;
    }
    try {
      await onAddAdjustment({ product, quantityDelta: Number(delta), reason, occurredAt: asOfDate });
      setDelta("");
      setReason("");
      setMessage("Đã ghi điều chỉnh tồn có lý do.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể điều chỉnh tồn.");
    }
  }

  return (
    <section className="catalog-workspace" aria-labelledby="catalog-title">
      <div className="inventory-heading"><div><span className="eyebrow">DANH MỤC HÀNG</span><h2 id="catalog-title">Sản phẩm và điều chỉnh tồn</h2><p>Không tự quy đổi đơn vị. Mỗi điều chỉnh tồn phải có lý do.</p></div></div>
      <div className="catalog-forms">
        <form className="catalog-form" onSubmit={(event) => void submitProduct(event)}>
          <h3>Sản phẩm mới</h3>
          <label><span>Tên mặt hàng</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Xoài cát" required /></label>
          <label><span>Đơn vị mặc định</span><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="kg" required /></label>
          <label><span>Cảnh báo khi còn lại &lt;=</span><input type="number" min="0" step="0.01" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
          <button className="primary-button" type="submit">Lưu sản phẩm</button>
        </form>
        <form className="catalog-form" onSubmit={(event) => void submitAdjustment(event)}>
          <h3>Điều chỉnh tồn</h3>
          <label><span>Sản phẩm</span><select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} required><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label><span>Số lượng thay đổi (+/-)</span><input type="number" step="0.01" value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="-2" required /></label>
          <label><span>Lý do</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Kiểm kê thực tế" required /></label>
          <button className="secondary-button" type="submit">Ghi điều chỉnh</button>
        </form>
      </div>
      {products.length > 0 ? <div className="catalog-stock-list">{report.rows.filter((row) => row.productId !== null).map((row) => <div className="catalog-stock-item" key={row.key}><span><strong>{row.itemName}</strong><small>{row.unit ?? ""}</small></span><b className={row.stockQuantity < 0 ? "inventory-negative" : row.isLow ? "inventory-low" : undefined}>{row.stockQuantity.toLocaleString("vi-VN")}</b><small>{row.estimatedStockValue === null ? "Chưa có giá nhập" : formatVnd(row.estimatedStockValue)}</small></div>)}</div> : <p className="inventory-empty">Chưa có sản phẩm. Báo cáo vẫn suy ra mặt hàng từ giao dịch.</p>}
      {message ? <p className="form-error" role="status">{message}</p> : null}
    </section>
  );
}
