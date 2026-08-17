"use client";

import { useMemo, useState } from "react";

import { DailyReport } from "@/components/daily-report";
import { DailyInsight } from "@/components/daily-insight";
import { InventoryWorkspace } from "@/components/inventory-workspace";
import { EvaluationLab } from "@/components/evaluation-lab";
import { MonthlyDashboard, PeriodDashboard } from "@/components/monthly-dashboard";
import { CashFlowPanel } from "@/components/cash-flow-panel";
import { RevenueGoalPanel } from "@/components/revenue-goal-panel";
import { TaxEstimatePanel } from "@/components/tax-estimate-panel";
import { UiIcon } from "@/components/ui-icon";
import {
  addDays,
  daysInclusive,
  formatVietnameseDateRange,
} from "@/lib/date";
import { downloadTransactionsCsv, transactionsForExport } from "@/lib/export-transactions";
import { calculateSevenDayEvidence } from "@/lib/insights/seven-day";
import {
  calculateDailyReport,
  calculateMonthlyReport,
  calculatePeriodReport,
  transactionItemKey,
  type ReportFilters,
} from "@/lib/reports";
import type { ConfirmedTransaction, TransactionType } from "@/types/transaction";
import type { Product, StockMovement } from "@/types/catalog";

import type { DebtEntry } from "@/types/debt";
type ReportMode = "day" | "week" | "month" | "custom";

type Props = {
  focusDate: string;
  debts?: DebtEntry[];
  getIdToken: () => Promise<string>;
  transactions: ConfirmedTransaction[];
  products?: Product[];
  movements?: StockMovement[];
  userId?: string | null;
};

const TRANSACTION_TYPE_OPTIONS: Array<{ value: "all" | TransactionType; label: string }> = [
  { value: "all", label: "Tất cả giao dịch" },
  { value: "sale", label: "Chỉ giao dịch bán" },
  { value: "purchase", label: "Chỉ giao dịch nhập" },
  { value: "expense", label: "Chỉ chi phí khác" },
];

export function ReportWorkspace({ debts = [], focusDate, getIdToken, transactions, products = [], movements = [], userId = null }: Props) {
  const [reportMode, setReportMode] = useState<ReportMode>("day");
  const [selectedDate, setSelectedDate] = useState(focusDate);
  const [selectedMonth, setSelectedMonth] = useState(focusDate.slice(0, 7));
  const [customStartDate, setCustomStartDate] = useState(addDays(focusDate, -29));
  const [customEndDate, setCustomEndDate] = useState(focusDate);
  const [transactionType, setTransactionType] = useState<"all" | TransactionType>("all");
  const [selectedItemKey, setSelectedItemKey] = useState("all");


  const filters = useMemo<ReportFilters>(
    () => ({ transactionType, itemKey: selectedItemKey }),
    [selectedItemKey, transactionType],
  );
  const itemOptions = useMemo(() => {
    const items = new Map<string, string>();
    for (const transaction of transactions) {
      if (!transaction.itemName) {
        continue;
      }
      items.set(transactionItemKey(transaction), transaction.itemName);
    }
    return [...items.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "vi-VN"));
  }, [transactions]);

  const dailyReport = useMemo(
    () => calculateDailyReport(transactions, selectedDate, filters),
    [filters, selectedDate, transactions],
  );
  const weekStartDate = addDays(selectedDate, -6);
  const sevenDayEvidence = useMemo(
    () => calculateSevenDayEvidence(transactions, selectedDate),
    [selectedDate, transactions],
  );
  const weekReport = useMemo(
    () => calculatePeriodReport(transactions, weekStartDate, selectedDate, filters),
    [filters, selectedDate, transactions, weekStartDate],
  );
  const monthlyReport = useMemo(
    () => calculateMonthlyReport(transactions, selectedMonth, filters),
    [filters, selectedMonth, transactions],
  );
  const customDayCount = daysInclusive(customStartDate, customEndDate);
  const customRangeIsValid = customDayCount > 0 && customDayCount <= 366;
  const customReport = useMemo(
    () => calculatePeriodReport(transactions, customStartDate, customEndDate, filters),
    [customEndDate, customStartDate, filters, transactions],
  );
  const hasActiveFilters = transactionType !== "all" || selectedItemKey !== "all";
  const activeStartDate = reportMode === "day"
    ? selectedDate
    : reportMode === "week"
      ? weekStartDate
      : reportMode === "month"
        ? monthlyReport.startDate
        : customStartDate;
  const activeEndDate = reportMode === "day" || reportMode === "week"
    ? selectedDate
    : reportMode === "month"
      ? monthlyReport.endDate
      : customEndDate;
  const exportRows = useMemo(
    () => transactionsForExport(transactions, activeStartDate, activeEndDate, filters),
    [activeEndDate, activeStartDate, filters, transactions],
  );
  const exportIsAvailable = exportRows.length > 0 && (reportMode !== "custom" || customRangeIsValid);

  function resetFilters() {
    setTransactionType("all");
    setSelectedItemKey("all");
  }

  function exportCurrentReport() {
    if (!exportIsAvailable) return;
    downloadTransactionsCsv(exportRows, `so-cho-ai-${activeStartDate}-${activeEndDate}.csv`);
  }

  return (
    <>
      <section className="report-controls" aria-labelledby="report-controls-title">
        <div className="report-controls-top">
          <div>
            <h2 id="report-controls-title">Phân tích sổ</h2>
            <p>Xem số liệu đã xác nhận theo thời gian và mặt hàng.</p>
          </div>
          <div className="report-mode-switch" aria-label="Loại báo cáo">
            <button aria-pressed={reportMode === "day"} type="button" onClick={() => setReportMode("day")}>Ngày</button>
            <button aria-pressed={reportMode === "week"} type="button" onClick={() => setReportMode("week")}>7 ngày</button>
            <button aria-pressed={reportMode === "month"} type="button" onClick={() => setReportMode("month")}>Tháng</button>
            <button aria-pressed={reportMode === "custom"} type="button" onClick={() => setReportMode("custom")}>Tùy chọn</button>
          </div>
        </div>

        <div className="report-period-fields">
          {reportMode === "day" || reportMode === "week" ? (
            <label className="report-period-input">
              <span><UiIcon name="calendar" size={18} /> {reportMode === "day" ? "Ngày báo cáo" : "Ngày kết thúc"}</span>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
            </label>
          ) : null}
          {reportMode === "month" ? (
            <label className="report-period-input">
              <span><UiIcon name="calendar" size={18} /> Tháng báo cáo</span>
              <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            </label>
          ) : null}
          {reportMode === "custom" ? (
            <>
              <label className="report-period-input">
                <span>Từ ngày</span>
                <input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
              </label>
              <label className="report-period-input">
                <span>Đến ngày</span>
                <input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
              </label>
            </>
          ) : null}
        </div>

        <div className="report-filter-grid">
          <label>
            <span>Loại giao dịch</span>
            <select value={transactionType} onChange={(event) => setTransactionType(event.target.value as "all" | TransactionType)}>
              {TRANSACTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Mặt hàng</span>
            <select value={selectedItemKey} onChange={(event) => setSelectedItemKey(event.target.value)}>
              <option value="all">Tất cả mặt hàng</option>
              {itemOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button className="report-reset-button" type="button" onClick={resetFilters} disabled={!hasActiveFilters}>
            Xóa bộ lọc
          </button>
        </div>
        {hasActiveFilters ? <p className="report-filter-note"><UiIcon name="info" size={16} /> Dashboard đang chỉ tính các giao dịch khớp bộ lọc.</p> : null}
        <div className="report-tools">
          <button type="button" onClick={exportCurrentReport} disabled={!exportIsAvailable}>
            <UiIcon name="book" size={18} /> Xuất CSV kỳ đang xem
          </button>
          <a href="https://agro.gov.vn/vn/nguonwmy.aspx" target="_blank" rel="noreferrer">
            <UiIcon name="chart" size={18} /> Tra giá nông sản công khai
          </a>
          <p>Nguồn giá chỉ để tham khảo theo mặt hàng, khu vực và thời điểm; ứng dụng không tự đổi giá bán.</p>
        </div>
      </section>

      <InventoryWorkspace asOfDate={activeEndDate} movements={movements} products={products} transactions={transactions} />

      {reportMode === "day" ? (
        <>
          <DailyReport report={dailyReport} />
          <DailyInsight aiEnabled={Boolean(userId)} evidence={sevenDayEvidence} getIdToken={getIdToken} report={dailyReport} />
        </>
      ) : null}
      {reportMode === "week" ? (
        <PeriodDashboard
          report={weekReport}
          title={`7 ngày · ${formatVietnameseDateRange(weekStartDate, selectedDate)}`}
        />
      ) : null}
      {reportMode === "month" ? (
        <>
          <CashFlowPanel debts={debts} endDate={monthlyReport.endDate} startDate={monthlyReport.startDate} transactions={transactions} />
          <RevenueGoalPanel report={monthlyReport} userId={userId} />
          <MonthlyDashboard report={monthlyReport} />
          <TaxEstimatePanel endDate={monthlyReport.endDate} report={monthlyReport} startDate={monthlyReport.startDate} transactions={transactions} />
        </>
      ) : null}
      {reportMode === "custom" && customRangeIsValid ? (
        <PeriodDashboard
          report={customReport}
          title={formatVietnameseDateRange(customStartDate, customEndDate)}
        />
      ) : null}
      {reportMode === "custom" && !customRangeIsValid ? (
        <p className="form-error" role="alert">
          <UiIcon name="alert" size={19} /> Chọn ngày bắt đầu trước ngày kết thúc, tối đa 366 ngày.
        </p>
      ) : null}
      <EvaluationLab />
    </>
  );
}
