"use client";

import { useState } from "react";

import { UiIcon } from "@/components/ui-icon";
import { formatVietnameseDate, formatVietnameseMonth } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { triggerHapticFeedback } from "@/lib/haptic";
import type { MonthlyItemPerformance, MonthlyReport, PeriodReport } from "@/lib/reports";

type PeriodDashboardProps = {
  report: PeriodReport;
  title: string;
  comparisonLabel?: string;
};

const CHART_WIDTH = 420;
const CHART_HEIGHT = 164;
const CHART_PADDING_X = 14;
const CHART_PADDING_Y = 18;

function roundPercentage(value: number): string {
  const rounded = Math.round(Math.abs(value));
  return `${rounded}%`;
}

function revenueTrendCopy(report: PeriodReport, comparisonLabel: string): string {
  if (report.revenueChangePercent === null) {
    return `${comparisonLabel} chưa có doanh thu để so sánh`;
  }

  if (report.revenueChangePercent === 0) {
    return `Doanh thu bằng ${comparisonLabel}`;
  }

  return `${report.revenueChangePercent > 0 ? "Tăng" : "Giảm"} ${roundPercentage(report.revenueChangePercent)} so với ${comparisonLabel}`;
}

function profitCopy(item: MonthlyItemPerformance): string {
  if (item.estimatedGrossProfit === null) {
    return `Thiếu giá vốn ở ${item.missingCostSaleCount} giao dịch`;
  }
  return `Lãi gộp ước tính ${formatVnd(item.estimatedGrossProfit)}`;
}

export function PeriodDashboard({
  report,
  title,
  comparisonLabel = "kỳ trước",
}: PeriodDashboardProps) {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [activeDay, setActiveDay] = useState<{ date: string; revenue: number; transactionCount: number } | null>(null);

  const chartMaximum = Math.max(...report.dailyRevenue.map((day) => day.revenue), 1);
  const chartUsableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const chartUsableHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const dayCount = report.dailyRevenue.length;
  const barWidth = Math.max(Math.min(chartUsableWidth / Math.max(dayCount, 1) - 3, 28), 5);

  const chartPoints = report.dailyRevenue.map((day, index) => {
    const x = CHART_PADDING_X + (chartUsableWidth * index) / Math.max(dayCount - 1, 1);
    const y = CHART_HEIGHT - CHART_PADDING_Y - (day.revenue / chartMaximum) * chartUsableHeight;
    return { ...day, x, y };
  });

  const linePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const firstPoint = chartPoints[0];
  const lastPoint = chartPoints.at(-1);
  const bestRevenueDay = report.bestRevenueDay;
  const bestChartPoint = bestRevenueDay
    ? chartPoints.find((point) => point.date === bestRevenueDay.date)
    : undefined;

  const trendIcon: "chart" | "trend-down" | "trend-up" =
    report.revenueChangePercent === null || report.revenueChangePercent === 0
      ? "chart"
      : report.revenueChangePercent < 0
        ? "trend-down"
        : "trend-up";

  const topProfitItem = report.topItems
    .filter((item) => item.estimatedGrossProfit !== null)
    .sort((left, right) => (right.estimatedGrossProfit ?? 0) - (left.estimatedGrossProfit ?? 0))[0];

  return (
    <section className="monthly-dashboard" aria-labelledby="period-dashboard-title">
      <div className="monthly-dashboard-header">
        <div>
          <h2 id="period-dashboard-title">{title}</h2>
          <p>{report.transactionCount} giao dịch đã xác nhận · {report.daysWithTransactions} ngày có ghi sổ</p>
        </div>
        <span className={report.revenueChangePercent !== null && report.revenueChangePercent < 0 ? "monthly-trend is-down" : "monthly-trend"}>
          <UiIcon name={trendIcon} size={17} />
          {revenueTrendCopy(report, comparisonLabel)}
        </span>
      </div>

      <dl className="monthly-kpi-grid">
        <div>
          <dt><UiIcon name="sale" size={17} /> Doanh thu</dt>
          <dd>{formatVnd(report.revenue)}</dd>
        </div>
        <div>
          <dt><UiIcon name="purchase" size={17} /> Giá vốn ước tính</dt>
          <dd>{formatVnd(report.estimatedCostOfGoods)}</dd>
        </div>
        <div>
          <dt><UiIcon name="expense" size={17} /> Chi phí khác</dt>
          <dd>{formatVnd(report.otherExpenses)}</dd>
        </div>
        <div className="monthly-profit">
          <dt><UiIcon name="check" size={17} /> Lãi gộp ước tính</dt>
          <dd>{report.estimatedGrossProfit === null ? "Chưa tính đủ" : formatVnd(report.estimatedGrossProfit)}</dd>
        </div>
        <div>
          <dt><UiIcon name="book" size={17} /> Lượt bán</dt>
          <dd>{report.saleCount}</dd>
        </div>
        <div>
          <dt><UiIcon name="chart" size={17} /> Trung bình mỗi lượt bán</dt>
          <dd>{formatVnd(report.averageSaleValue)}</dd>
        </div>
      </dl>

      <section className="monthly-chart-section" aria-labelledby="period-chart-title">
        <div className="monthly-section-heading chart-heading-with-switch">
          <div>
            <h3 id="period-chart-title">Doanh thu từng ngày</h3>
            <p>
              {activeDay
                ? `${formatVietnameseDate(activeDay.date)}: ${formatVnd(activeDay.revenue)} (${activeDay.transactionCount} giao dịch)`
                : bestRevenueDay
                  ? `Cao nhất ${formatVnd(bestRevenueDay.revenue)} vào ${formatVietnameseDate(bestRevenueDay.date)}`
                  : "Chưa có doanh thu trong kỳ này"}
            </p>
          </div>
          {bestRevenueDay ? (
            <div className="chart-type-switch" role="group" aria-label="Kiểu biểu đồ">
              <button
                type="button"
                className={chartType === "bar" ? "active" : ""}
                onClick={() => {
                  triggerHapticFeedback(15);
                  setChartType("bar");
                }}
                title="Biểu đồ cột"
              >
                Cột
              </button>
              <button
                type="button"
                className={chartType === "line" ? "active" : ""}
                onClick={() => {
                  triggerHapticFeedback(15);
                  setChartType("line");
                }}
                title="Biểu đồ đường"
              >
                Đường
              </button>
            </div>
          ) : null}
        </div>

        {bestRevenueDay && firstPoint && lastPoint ? (
          <>
            <div
              className="monthly-chart interactive-chart"
              role="img"
              aria-label={`Biểu đồ doanh thu theo ngày trong ${title}. Cao nhất ${formatVnd(bestRevenueDay.revenue)} vào ${formatVietnameseDate(bestRevenueDay.date)}.`}
            >
              <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#16a34a" />
                    <stop offset="100%" stopColor="#0f6b4a" />
                  </linearGradient>
                  <linearGradient id="barBestGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <line
                  className="chart-grid-line"
                  x1={CHART_PADDING_X}
                  x2={CHART_WIDTH - CHART_PADDING_X}
                  y1={CHART_HEIGHT - CHART_PADDING_Y}
                  y2={CHART_HEIGHT - CHART_PADDING_Y}
                />
                <line
                  className="chart-grid-line"
                  x1={CHART_PADDING_X}
                  x2={CHART_WIDTH - CHART_PADDING_X}
                  y1={CHART_PADDING_Y + chartUsableHeight / 2}
                  y2={CHART_PADDING_Y + chartUsableHeight / 2}
                />

                {chartType === "bar" ? (
                  // Bar Chart View
                  report.dailyRevenue.map((day, idx) => {
                    const barHeight = day.revenue > 0 ? Math.max((day.revenue / chartMaximum) * chartUsableHeight, 4) : 0;
                    const x = CHART_PADDING_X + (chartUsableWidth * idx) / Math.max(dayCount, 1);
                    const y = CHART_HEIGHT - CHART_PADDING_Y - barHeight;
                    const isBest = bestRevenueDay?.date === day.date;
                    const isSelected = activeDay?.date === day.date;

                    return (
                      <g
                        key={day.date}
                        className="chart-bar-group"
                        style={{ cursor: "pointer", outline: "none" }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${formatVietnameseDate(day.date)}: ${formatVnd(day.revenue)} (${day.transactionCount} giao dịch)`}
                        onClick={() => {
                          triggerHapticFeedback(15);
                          setActiveDay(isSelected ? null : day);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            triggerHapticFeedback(15);
                            setActiveDay(isSelected ? null : day);
                          }
                        }}
                        onMouseEnter={() => setActiveDay(day)}
                        onMouseLeave={() => setActiveDay(null)}
                      >
                        {/* Transparent hit area for easy touch */}
                        <rect
                          x={x - 2}
                          y={CHART_PADDING_Y}
                          width={barWidth + 4}
                          height={chartUsableHeight + CHART_PADDING_Y}
                          fill="transparent"
                        />
                        {/* Background track for 0 revenue days */}
                        <rect
                          x={x}
                          y={CHART_HEIGHT - CHART_PADDING_Y - 2}
                          width={barWidth}
                          height={2}
                          rx={1}
                          fill={isSelected ? "#10b981" : "#e2e8f0"}
                        />
                        {/* Actual Revenue Bar */}
                        {barHeight > 0 ? (
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            rx={Math.min(barWidth / 2, 4)}
                            fill={isBest ? "url(#barBestGradient)" : isSelected ? "#059669" : "url(#barGradient)"}
                            stroke={isSelected ? "#047857" : "none"}
                            strokeWidth={isSelected ? 1.5 : 0}
                          />
                        ) : null}
                      </g>
                    );
                  })
                ) : (
                  // Line Chart View
                  <>
                    <polyline className="chart-line" points={linePoints} />
                    {bestChartPoint ? (
                      <circle className="chart-point is-best" cx={bestChartPoint.x} cy={bestChartPoint.y} r="5" />
                    ) : null}
                    <circle className="chart-endpoint" cx={firstPoint.x} cy={firstPoint.y} r="3" />
                    <circle className="chart-endpoint" cx={lastPoint.x} cy={lastPoint.y} r="3" />
                  </>
                )}
              </svg>
            </div>
            <div className="monthly-chart-axis" aria-hidden="true">
              <span>{formatVietnameseDate(firstPoint.date).slice(0, 5)}</span>
              <span>{formatVietnameseDate(chartPoints[Math.floor(chartPoints.length / 2)].date).slice(0, 5)}</span>
              <span>{formatVietnameseDate(lastPoint.date).slice(0, 5)}</span>
            </div>
          </>
        ) : (
          <div className="monthly-chart-empty">
            <UiIcon name="chart" size={24} />
            <p>Chưa có giao dịch bán trong kỳ này.</p>
            <span>Thêm giao dịch để xem xu hướng doanh thu theo ngày.</span>
          </div>
        )}

        <details className="monthly-data-details">
          <summary>Xem doanh thu từng ngày</summary>
          <ul>
            {report.dailyRevenue.map((day) => (
              <li key={day.date} className={bestRevenueDay?.date === day.date ? "best-day-item" : undefined}>
                <span>
                  {formatVietnameseDate(day.date)}
                  {bestRevenueDay?.date === day.date ? " (Cao nhất)" : ""}
                </span>
                <strong>{formatVnd(day.revenue)}</strong>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <div className="monthly-insight-grid">
        <section aria-labelledby="period-insights-title">
          <div className="monthly-section-heading">
            <div>
              <h3 id="period-insights-title">Điểm cần theo dõi</h3>
              <p>Nhận xét chỉ dựa trên giao dịch bạn đã xác nhận.</p>
            </div>
          </div>
          <ul className="monthly-insights">
            {report.uncostedSales.length > 0 ? (
              <li className="needs-attention">
                <UiIcon name="alert" size={18} />
                <span>
                  <strong>Cần bổ sung giá vốn</strong>
                  {report.uncostedSales.length} giao dịch bán chưa có giá nhập hợp lệ; chưa nên so sánh lợi nhuận.
                </span>
              </li>
            ) : null}
            {bestRevenueDay ? (
              <li>
                <UiIcon name="calendar" size={18} />
                <span>
                  <strong>Ngày bán tốt nhất</strong>
                  {formatVietnameseDate(bestRevenueDay.date)} đạt {formatVnd(bestRevenueDay.revenue)} doanh thu.
                </span>
              </li>
            ) : null}
            {topProfitItem ? (
              <li>
                <UiIcon name="check" size={18} />
                <span>
                  <strong>Lãi gộp cao nhất</strong>
                  {topProfitItem.itemName} đạt {formatVnd(topProfitItem.estimatedGrossProfit ?? 0)} lãi gộp ước tính.
                </span>
              </li>
            ) : null}
            {report.uncostedSales.length === 0 && !bestRevenueDay ? (
              <li>
                <UiIcon name="info" size={18} />
                <span>
                  <strong>Chưa đủ dữ liệu</strong>
                  Ghi thêm giao dịch bán và giá nhập để dashboard tạo được nhận xét hữu ích.
                </span>
              </li>
            ) : null}
          </ul>
        </section>

        <section aria-labelledby="top-items-title">
          <div className="monthly-section-heading">
            <div>
              <h3 id="top-items-title">Mặt hàng bán chạy</h3>
              <p>Xếp hạng theo doanh thu, không phải theo lợi nhuận.</p>
            </div>
          </div>
          {report.topItems.length > 0 ? (
            <ol className="monthly-ranking">
              {report.topItems.map((item, index) => (
                <li key={`${item.itemName}-${index}`}>
                  <span className="ranking-index">{index + 1}</span>
                  <div>
                    <strong>{item.itemName}</strong>
                    <small>{item.saleCount} giao dịch bán · {profitCopy(item)}</small>
                  </div>
                  <b>{formatVnd(item.revenue)}</b>
                </li>
              ))}
            </ol>
          ) : (
            <div className="monthly-ranking-empty">Chưa có mặt hàng bán trong kỳ này.</div>
          )}
        </section>
      </div>
    </section>
  );
}

export function MonthlyDashboard({ report }: { report: MonthlyReport }) {
  return (
    <PeriodDashboard
      report={report}
      title={formatVietnameseMonth(report.month)}
      comparisonLabel="tháng trước"
    />
  );
}
