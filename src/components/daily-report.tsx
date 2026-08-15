import { UiIcon } from "@/components/ui-icon";
import { formatVietnameseDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { DailyReport as DailyReportData } from "@/lib/reports";

type Props = {
  report: DailyReportData;
};

export function DailyReport({ report }: Props) {
  return (
    <section className="report-card" aria-labelledby="report-title">
      <div className="section-heading report-heading">
        <div>
          <h2 id="report-title">Ngày {formatVietnameseDate(report.date)}</h2>
          <p className="section-description">{report.transactionCount} giao dịch đã xác nhận</p>
        </div>
      </div>

      <dl className="report-grid">
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
        <div className="profit">
          <dt><UiIcon name="check" size={17} /> Lãi gộp ước tính</dt>
          <dd>{report.estimatedGrossProfit === null ? "Chưa tính đủ" : formatVnd(report.estimatedGrossProfit)}</dd>
        </div>
      </dl>

      {report.uncostedSales.length > 0 ? (
        <p className="report-note"><UiIcon name="alert" size={18} /> Chưa tính lãi gộp vì {report.uncostedSales.length} giao dịch bán chưa có giá nhập hợp lệ trước ngày bán.</p>
      ) : (
        <p className="report-note"><UiIcon name="info" size={18} /> Giá vốn được ước tính theo lần nhập gần nhất không muộn hơn thời điểm bán.</p>
      )}
    </section>
  );
}
