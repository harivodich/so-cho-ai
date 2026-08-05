import { formatVietnameseDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { DailyReport as DailyReportData } from "@/lib/reports";

type Props = {
  report: DailyReportData;
};

export function DailyReport({ report }: Props) {
  return (
    <section className="report-card" aria-labelledby="report-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Báo cáo ngày {formatVietnameseDate(report.date)}</p>
          <h2 id="report-title">Bạn đã ghi {report.transactionCount} giao dịch</h2>
        </div>
      </div>

      <dl className="report-grid">
        <div><dt>Doanh thu</dt><dd>{formatVnd(report.revenue)}</dd></div>
        <div><dt>Chi phí khác</dt><dd>{formatVnd(report.otherExpenses)}</dd></div>
        <div><dt>Giá vốn ước tính</dt><dd>{formatVnd(report.estimatedCostOfGoods)}</dd></div>
        <div className="profit"><dt>Lãi gộp ước tính</dt><dd>{report.estimatedGrossProfit === null ? "Chưa tính đủ" : formatVnd(report.estimatedGrossProfit)}</dd></div>
      </dl>

      {report.uncostedSales.length > 0 ? (
        <p className="report-note">
          Chưa tính lãi gộp vì {report.uncostedSales.length} giao dịch bán chưa có giá nhập hợp lệ trước ngày bán.
        </p>
      ) : (
        <p className="report-note">Giá vốn được ước tính theo lần nhập gần nhất không muộn hơn thời điểm bán.</p>
      )}
    </section>
  );
}
