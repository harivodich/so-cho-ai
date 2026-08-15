import type { MonthlyReport } from "@/lib/reports";

export type RevenueGoalStatus = {
  target: number;
  achievedPercent: number;
  remainingRevenue: number;
  remainingDays: number;
  requiredDailyAverage: number | null;
  isAchieved: boolean;
  periodEnded: boolean;
};

export type MonthlyAction = {
  id: string;
  tone: "attention" | "positive" | "neutral";
  title: string;
  description: string;
};

export function calculateRevenueGoalStatus(
  report: MonthlyReport,
  target: number,
  today: string,
): RevenueGoalStatus {
  const safeTarget = Number.isFinite(target) && target > 0 ? Math.round(target) : 0;
  const currentMonth = today.slice(0, 7);
  const remainingRevenue = Math.max(safeTarget - report.revenue, 0);
  const remainingDays = report.month < currentMonth
    ? 0
    : report.month > currentMonth
      ? report.dailyRevenue.length
      : report.dailyRevenue.filter((day) => day.date >= today).length;

  return {
    target: safeTarget,
    achievedPercent: safeTarget > 0 ? Math.min((report.revenue / safeTarget) * 100, 100) : 0,
    remainingRevenue,
    remainingDays,
    requiredDailyAverage:
      remainingRevenue === 0 ? 0 : remainingDays > 0 ? Math.ceil(remainingRevenue / remainingDays) : null,
    isAchieved: safeTarget > 0 && report.revenue >= safeTarget,
    periodEnded: report.month < currentMonth,
  };
}

export function buildMonthlyActions(
  report: MonthlyReport,
  goal: RevenueGoalStatus,
): MonthlyAction[] {
  const actions: MonthlyAction[] = [];

  if (report.uncostedSales.length > 0) {
    actions.push({
      id: "missing-cost",
      tone: "attention",
      title: "Bổ sung giá vốn",
      description: `${report.uncostedSales.length} giao dịch bán chưa có giá nhập phù hợp.`,
    });
  }

  if (goal.target > 0) {
    if (goal.isAchieved) {
      actions.push({
        id: "goal-achieved",
        tone: "positive",
        title: "Đã đạt mục tiêu tháng",
        description: "Tiếp tục ghi đủ giao dịch để theo dõi kết quả đến cuối tháng.",
      });
    } else if (goal.requiredDailyAverage !== null) {
      actions.push({
        id: "goal-progress",
        tone: "neutral",
        title: "Theo dõi nhịp doanh thu",
        description: `Còn ${goal.remainingDays} ngày để hoàn thành mục tiêu đã đặt.`,
      });
    } else if (goal.periodEnded) {
      actions.push({
        id: "goal-missed",
        tone: "attention",
        title: "Mục tiêu kỳ này chưa đạt",
        description: "Dùng kết quả thực tế để đặt mục tiêu phù hợp hơn cho tháng tiếp theo.",
      });
    }
  }

  if (report.revenueChangePercent !== null && report.revenueChangePercent < 0) {
    actions.push({
      id: "revenue-down",
      tone: "attention",
      title: "Doanh thu đang giảm",
      description: `Thấp hơn ${Math.round(Math.abs(report.revenueChangePercent))}% so với tháng trước.`,
    });
  }

  const topItem = report.topItems[0];
  if (topItem) {
    actions.push({
      id: "top-item",
      tone: "positive",
      title: "Mặt hàng tạo doanh thu cao nhất",
      description: `${topItem.itemName} đang đứng đầu theo doanh thu đã ghi.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "need-data",
      tone: "neutral",
      title: "Tiếp tục ghi giao dịch",
      description: "Cần thêm dữ liệu bán và giá nhập để tạo việc cần làm hữu ích.",
    });
  }

  return actions.slice(0, 4);
}
