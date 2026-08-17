"use client";

import { useState } from "react";

import { UiIcon } from "@/components/ui-icon";
import { formatVnd } from "@/lib/money";
import type { DailyInsight as DailyInsightData } from "@/lib/insights/schema";
import type { SevenDayEvidence } from "@/lib/insights/seven-day";
import type { DailyReport } from "@/lib/reports";

type QuickQuestion = "revenue" | "profit" | "average";
type Props = { evidence: SevenDayEvidence; report: DailyReport; getIdToken: () => Promise<string>; aiEnabled?: boolean };
type InsightResponse = { insight?: DailyInsightData; error?: unknown };

export function DailyInsight({ evidence, report, getIdToken, aiEnabled = true }: Props) {
  const [insight, setInsight] = useState<DailyInsightData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuickQuestion>("revenue");

  const quickAnswers: Record<QuickQuestion, string> = {
    revenue: `Doanh thu đã xác nhận là ${formatVnd(report.revenue)} từ ${report.saleCount} giao dịch bán.`,
    profit: report.estimatedGrossProfit === null
      ? `Chưa thể tính đủ lãi gộp ước tính vì ${report.uncostedSales.length} giao dịch bán thiếu giá vốn phù hợp.`
      : `Lãi gộp ước tính là ${formatVnd(report.estimatedGrossProfit)}.`,
    average: report.saleCount === 0
      ? "Ngày này chưa có giao dịch bán để tính giá trị trung bình."
      : `Mỗi giao dịch bán đạt trung bình ${formatVnd(report.averageSaleValue)}.`,
  };

  async function requestInsight() {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          date: report.date,
          revenue: report.revenue,
          purchases: report.purchases,
          otherExpenses: report.otherExpenses,
          estimatedCostOfGoods: report.estimatedCostOfGoods,
          estimatedGrossProfit: report.estimatedGrossProfit,
          transactionCount: report.transactionCount,
          saleCount: report.saleCount,
          averageSaleValue: report.averageSaleValue,
          missingCostSaleCount: report.uncostedSales.length,
          sevenDay: evidence,
        }),
      });
      const payload = (await response.json().catch(() => null)) as InsightResponse | null;
      if (!response.ok || !payload?.insight) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Không thể tạo nhận xét lúc này.");
      }
      setInsight(payload.insight);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo nhận xét lúc này.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="daily-insight-panel" aria-labelledby="daily-insight-title">
      <div className="daily-insight-heading">
        <div>
          <p className="section-eyebrow">Hiểu số liệu</p>
          <h3 id="daily-insight-title">Nhận xét cuối ngày</h3>
          <p>AI chỉ diễn giải số tổng hợp do ứng dụng tính; không nhận dữ liệu từng giao dịch.</p>
        </div>
        <button type="button" onClick={() => void requestInsight()} disabled={!aiEnabled || isLoading || report.transactionCount === 0} title={!aiEnabled ? "Đăng nhập Google hoặc Email để dùng tính năng AI." : undefined}>
          <UiIcon name="chart" size={18} /> {isLoading ? "Đang nhận xét…" : insight ? "Tạo lại" : "Nhận xét bằng AI"}
        </button>
      </div>
      {!aiEnabled ? <p className="daily-insight-empty">Đăng nhập Google hoặc Email để dùng nhận xét AI; các câu hỏi nhanh vẫn dùng được từ số liệu đã tính.</p> : null}
      {aiEnabled && report.transactionCount === 0 ? <p className="daily-insight-empty">Cần ít nhất một giao dịch đã xác nhận để tạo nhận xét.</p> : null}
      {error ? <p className="form-error" role="alert"><UiIcon name="alert" size={18} /> {error}</p> : null}
      <section className="insight-evidence" aria-label="Căn cứ nhận xét 7 ngày">
        <strong>Căn cứ 7 ngày gần nhất</strong>
        <span>Hôm nay: {formatVnd(evidence.todayRevenue)}</span>
        <span>Trung bình/ngày: {formatVnd(evidence.averageDailyRevenue)}</span>
        <span>Chênh lệch: {evidence.revenueDelta >= 0 ? "+" : ""}{formatVnd(evidence.revenueDelta)}</span>
        {evidence.topItemName ? <span>Mặt hàng doanh thu cao nhất: {evidence.topItemName}</span> : null}
      </section>
      {insight ? (
        <div className="daily-insight-result" aria-live="polite">
          <strong>{insight.headline}</strong>
          <ul>{insight.observations.map((item) => <li key={item}>{item}</li>)}</ul>
          {insight.cautions.map((item) => <p key={item}><UiIcon name="info" size={17} /> {item}</p>)}
        </div>
      ) : null}

      <div className="ledger-quick-answers">
        <div><strong>Hỏi nhanh về ngày này</strong><span>Trả lời trực tiếp từ số liệu, không dùng AI.</span></div>
        <div className="quick-question-buttons" aria-label="Câu hỏi nhanh">
          <button type="button" aria-pressed={question === "revenue"} onClick={() => setQuestion("revenue")}>Doanh thu?</button>
          <button type="button" aria-pressed={question === "profit"} onClick={() => setQuestion("profit")}>Lãi đã đủ?</button>
          <button type="button" aria-pressed={question === "average"} onClick={() => setQuestion("average")}>Đơn trung bình?</button>
        </div>
        <p className="quick-answer" aria-live="polite">{quickAnswers[question]}</p>
      </div>
    </section>
  );
}
