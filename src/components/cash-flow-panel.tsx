"use client";

import { useMemo } from "react";

import { UiIcon } from "@/components/ui-icon";
import { formatVnd } from "@/lib/money";
import { calculateCashFlowSummary } from "@/lib/reports/cash-flow";
import type { DebtEntry } from "@/types/debt";
import type { ConfirmedTransaction } from "@/types/transaction";

type Props = {
  debts: DebtEntry[];
  endDate: string;
  startDate: string;
  transactions: ConfirmedTransaction[];
};

export function CashFlowPanel({ debts, endDate, startDate, transactions }: Props) {
  const summary = useMemo(
    () => calculateCashFlowSummary(transactions, debts, startDate, endDate),
    [debts, endDate, startDate, transactions],
  );

  return (
    <section className="tax-estimate-panel cash-flow-panel" aria-labelledby="cash-flow-title">
      <div>
        <span className="eyebrow">DÒNG TIỀN ĐÃ GHI NHẬN</span>
        <h3 id="cash-flow-title">Tiền thực nhận so với doanh thu</h3>
        <p>Chỉ tính các khoản thanh toán công nợ đã ghi trong kỳ; công nợ chưa thanh toán không tự biến thành tiền mặt.</p>
      </div>
      <dl className="tax-estimate-results">
        <div><dt>Doanh thu ghi nhận</dt><dd>{formatVnd(summary.recognizedRevenue)}</dd></div>
        <div><dt>Tiền thu công nợ</dt><dd>{formatVnd(summary.recordedReceipts)}</dd></div>
        <div><dt>Tiền trả công nợ</dt><dd>{formatVnd(summary.recordedPayments)}</dd></div>
        <div className="tax-total"><dt>Dòng tiền công nợ ròng</dt><dd><UiIcon name="chart" size={16} /> {formatVnd(summary.netRecordedCash)}</dd></div>
      </dl>
    </section>
  );
}
