"use client";

import { useMemo } from "react";

import { UiIcon } from "@/components/ui-icon";
import { formatVnd } from "@/lib/money";
import { calculateInventory } from "@/lib/reports/inventory";
import type { Product, StockMovement } from "@/types/catalog";
import type { ConfirmedTransaction } from "@/types/transaction";

type Props = {
  asOfDate: string;
  transactions: ConfirmedTransaction[];
  products?: Product[];
  movements?: StockMovement[];
};

export function InventoryWorkspace({ asOfDate, transactions, products = [], movements = [] }: Props) {
  const report = useMemo(() => calculateInventory(transactions, asOfDate, products, movements), [asOfDate, movements, products, transactions]);

  return (
    <section className="inventory-workspace" aria-labelledby="inventory-title">
      <div className="inventory-heading">
        <div>
          <span className="eyebrow">THEO DÕI HÀNG</span>
          <h2 id="inventory-title">Tồn kho ước tính</h2>
          <p>Được tính từ các giao dịch nhập và bán đã xác nhận đến {asOfDate}.</p>
        </div>
        <UiIcon name="chart" size={22} />
      </div>

      {report.rows.length === 0 ? (
        <div className="inventory-empty">
          <strong>Chưa đủ dữ liệu tồn kho</strong>
          <span>Thêm giao dịch nhập hoặc bán có mặt hàng và số lượng để xem số lượng ước tính.</span>
        </div>
      ) : (
        <>
          <div className="inventory-summary">
            <span>{report.rows.length} mặt hàng</span>
            <span>{report.negativeStockCount} âm · {report.lowStockCount} sắp hết</span>
          </div>
          <div className="inventory-table-wrap">
            <table className="inventory-table">
              <thead>
                <tr><th>Mặt hàng</th><th>Đã nhập</th><th>Đã bán</th><th>Điều chỉnh</th><th>Còn lại</th><th>Giá trị ước tính</th></tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row"><strong>{row.itemName}</strong><small>{row.unit ?? "Chưa có đơn vị"}</small></th>
                    <td>{row.purchasedQuantity.toLocaleString("vi-VN")}</td>
                    <td>{row.soldQuantity.toLocaleString("vi-VN")}</td>
                    <td>{row.adjustmentQuantity.toLocaleString("vi-VN")}</td>
                    <td className={row.stockQuantity < 0 ? "inventory-negative" : row.isLow ? "inventory-low" : undefined}>{row.stockQuantity.toLocaleString("vi-VN")}{row.isLow ? " · sắp hết" : ""}</td>
                    <td>{row.estimatedStockValue === null ? "Thiếu giá nhập" : formatVnd(row.estimatedStockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.incompleteItemCount > 0 ? (
            <p className="inventory-note"><UiIcon name="info" size={16} /> {report.incompleteItemCount} mặt hàng có giao dịch thiếu số lượng nên số tồn chỉ là một phần.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
