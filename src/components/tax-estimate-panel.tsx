"use client";

import { useMemo, useState } from "react";

import { formatVnd } from "@/lib/money";
import { calculateTaxEstimate, calculateTaxPeriodSummary } from "@/lib/reports/tax";
import type { ConfirmedTransaction } from "@/types/transaction";
import type { MonthlyReport } from "@/lib/reports";

type Props = { report: MonthlyReport; transactions: ConfirmedTransaction[]; startDate: string; endDate: string };

export function TaxEstimatePanel({ report, transactions, startDate, endDate }: Props) {
  const [revenueRate, setRevenueRate] = useState(0);
  const [incomeRate, setIncomeRate] = useState(0);
  const period = useMemo(() => calculateTaxPeriodSummary(transactions, startDate, endDate), [endDate, startDate, transactions]);
  const estimate = useMemo(
    () => calculateTaxEstimate(report, { revenueRatePercent: revenueRate, incomeRatePercent: incomeRate }),
    [incomeRate, report, revenueRate],
  );

  return (
    <section className="tax-estimate-panel" aria-labelledby="tax-estimate-title">
      <div>
        <span className="eyebrow">CÔNG CỤ THAM KHẢO</span>
        <h3 id="tax-estimate-title">Ước tính thuế theo tỷ lệ bạn nhập</h3>
        <p>Không phải tờ khai thuế. Hãy dùng tỷ lệ đã được cơ quan thuế hoặc kế toán của bạn xác nhận.</p>
      </div>
      <div className="tax-rate-grid">
        <label><span>Thuế trên doanh thu (%)</span><input type="number" min="0" max="100" step="0.01" value={revenueRate} onChange={(event) => setRevenueRate(Number(event.target.value))} /></label>
        <label><span>Thuế trên lãi ước tính (%)</span><input type="number" min="0" max="100" step="0.01" value={incomeRate} onChange={(event) => setIncomeRate(Number(event.target.value))} /></label>
      </div>
      <dl className="tax-estimate-results">
        <div><dt>Doanh thu làm căn cứ</dt><dd>{formatVnd(estimate.revenueBase)}</dd></div>
        <div><dt>Thuế doanh thu ước tính</dt><dd>{formatVnd(estimate.estimatedRevenueTax)}</dd></div>
        <div><dt>Thuế trên lãi ước tính</dt><dd>{estimate.estimatedIncomeTax === null ? "Chưa đủ giá vốn" : formatVnd(estimate.estimatedIncomeTax)}</dd></div>
        <div className="tax-total"><dt>Tổng ước tính</dt><dd>{estimate.estimatedTotal === null ? "Chưa tính đủ" : formatVnd(estimate.estimatedTotal)}</dd></div>
      </dl>      <div className="tax-period-summary"><strong>Đã ghi nhận theo giao dịch</strong><span>{period.appliedTransactionCount} giao dịch · Căn cứ {formatVnd(period.subtotal)} · Thuế {formatVnd(period.taxAmount)} · Tổng {formatVnd(period.total)}</span></div>

    </section>
  );
}
