"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import { UiIcon } from "@/components/ui-icon";
import { currentLocalDate } from "@/lib/date";
import { buildMonthlyActions, calculateRevenueGoalStatus } from "@/lib/growth";
import { formatVnd } from "@/lib/money";
import {
  getRevenueGoal,
  removeRevenueGoal,
  saveRevenueGoal,
  subscribeToRevenueGoals,
} from "@/lib/revenue-goals";
import type { MonthlyReport } from "@/lib/reports";

type Props = {
  report: MonthlyReport;
};

export function RevenueGoalPanel({ report }: Props) {
  const [formError, setFormError] = useState<string | null>(null);
  const getSnapshot = useCallback(() => getRevenueGoal(report.month), [report.month]);
  const target = useSyncExternalStore(subscribeToRevenueGoals, getSnapshot, () => 0);
  const goal = calculateRevenueGoalStatus(report, target, currentLocalDate());
  const actions = buildMonthlyActions(report, goal);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const amount = Math.round(Number(new FormData(event.currentTarget).get("target")));
    try {
      saveRevenueGoal(report.month, amount);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Không thể lưu mục tiêu lúc này.");
    }
  }

  function handleRemove() {
    removeRevenueGoal(report.month);
    setFormError(null);
  }

  return (
    <section className="revenue-goal-panel" aria-labelledby="revenue-goal-title">
      <div className="revenue-goal-heading">
        <div>
          <p className="section-eyebrow">Kế hoạch tháng</p>
          <h2 id="revenue-goal-title">Mục tiêu doanh thu</h2>
          <p>Mục tiêu được lưu trên thiết bị này và không ảnh hưởng số liệu giao dịch.</p>
        </div>
        {target > 0 ? (
          <strong className={goal.isAchieved ? "goal-status is-achieved" : "goal-status"}>
            {goal.isAchieved ? "Đã đạt mục tiêu" : `${Math.round(goal.achievedPercent)}% mục tiêu`}
          </strong>
        ) : null}
      </div>

      {target > 0 ? (
        <div className="goal-progress-area">
          <div className="goal-progress-copy">
            <span>Đã ghi {formatVnd(report.revenue)}</span>
            <strong>{formatVnd(target)}</strong>
          </div>
          <progress aria-label="Tiến độ mục tiêu doanh thu" max={target} value={Math.min(report.revenue, target)} />
          <dl className="goal-metrics">
            <div><dt>Còn lại</dt><dd>{formatVnd(goal.remainingRevenue)}</dd></div>
            <div><dt>Ngày còn lại</dt><dd>{goal.remainingDays}</dd></div>
            <div>
              <dt>Cần trung bình mỗi ngày</dt>
              <dd>{goal.requiredDailyAverage === null ? "Đã hết kỳ" : formatVnd(goal.requiredDailyAverage)}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="goal-empty-state">
          <UiIcon name="chart" size={22} />
          <div>
            <strong>Chưa đặt mục tiêu cho tháng này</strong>
            <p>Đặt một con số vừa sức để theo dõi tiến độ. Đây không phải dự báo doanh thu.</p>
          </div>
        </div>
      )}

      <form className="goal-form" key={`${report.month}-${target}`} onSubmit={handleSubmit}>
        <label>
          <span>{target > 0 ? "Cập nhật mục tiêu" : "Mục tiêu doanh thu tháng"}</span>
          <input
            defaultValue={target || undefined}
            inputMode="numeric"
            max="999999999999"
            min="1000"
            name="target"
            placeholder="Ví dụ: 30.000.000"
            required
            step="1000"
            type="number"
          />
        </label>
        <button className="primary-action goal-save-button" type="submit">{target > 0 ? "Cập nhật" : "Đặt mục tiêu"}</button>
        {target > 0 ? <button className="goal-remove-button" type="button" onClick={handleRemove}>Bỏ mục tiêu</button> : null}
      </form>
      {formError ? <p className="form-error goal-form-error" role="alert"><UiIcon name="alert" size={18} /> {formError}</p> : null}

      <div className="monthly-action-center">
        <div className="monthly-action-heading">
          <h3>Việc cần làm</h3>
          <p>Gợi ý được tạo từ dữ liệu bạn đã xác nhận, không dùng AI để suy đoán.</p>
        </div>
        <ul>
          {actions.map((action) => (
            <li className={`is-${action.tone}`} key={action.id}>
              <UiIcon
                name={action.tone === "attention" ? "alert" : action.tone === "positive" ? "check" : "info"}
                size={19}
              />
              <span><strong>{action.title}</strong>{action.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
