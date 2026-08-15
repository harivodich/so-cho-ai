"use client";

import { useEffect, useMemo, useState } from "react";

import { UiIcon } from "@/components/ui-icon";
import { formatEvaluationPercent, parseLatestEvaluationReport, type EvaluationSample, type LatestEvaluationReport } from "@/lib/evaluation/latest-report";

type LoadState = "loading" | "ready" | "unavailable";

const fieldLabels = { type: "Loại giao dịch", amount: "Tổng tiền", quantity: "Số lượng", unitPrice: "Đơn giá" } as const;
const errorLabels: Record<string, string> = { "field:type": "Loại giao dịch", "field:amount": "Tổng tiền", "field:quantity": "Số lượng", "field:unitPrice": "Đơn giá", "invalid-json": "JSON không hợp lệ", "http-error": "Lỗi HTTP" };

function completedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không rõ thời điểm chạy" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function sampleValue(sample: EvaluationSample, key: "expected" | "actual"): string {
  const value = sample[key];
  if (!value) return "Không tạo giao dịch";
  return (Object.keys(fieldLabels) as Array<keyof typeof fieldLabels>)
    .map((field) => `${fieldLabels[field]}: ${value[field] ?? "null"}`)
    .join(" · ");
}

function EvaluationExample({ title, sample, state }: { title: string; sample: EvaluationSample; state: "correct" | "incorrect" | "guard" }) {
  return (
    <article className={`evaluation-example is-${state}`}>
      <h4>{title}</h4>
      <p className="evaluation-example-input">“{sample.input}”</p>
      <dl><div><dt>Nhãn đã khóa</dt><dd>{sampleValue(sample, "expected")}</dd></div><div><dt>Model trả</dt><dd>{sampleValue(sample, "actual")}</dd></div></dl>
      <p className="evaluation-example-note">{sample.note}</p>
    </article>
  );
}

export function EvaluationLab() {
  const [state, setState] = useState<LoadState>("loading");
  const [report, setReport] = useState<LatestEvaluationReport | null>(null);
  const errorGroups = useMemo(() => report ? Object.entries(report.errorGroups).sort(([, left], [, right]) => right - left) : [], [report]);
  const maxErrorCount = Math.max(...errorGroups.map(([, count]) => count), 1);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/evaluation/text-latest.json", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => response.ok ? parseLatestEvaluationReport(await response.json()) : null)
      .then((nextReport) => { if (nextReport) setReport(nextReport); setState(nextReport ? "ready" : "unavailable"); })
      .catch(() => setState("unavailable"));
    return () => controller.abort();
  }, []);

  return (
    <section className="evaluation-lab" aria-labelledby="evaluation-lab-title">
      <header className="evaluation-lab-header"><div><h2 id="evaluation-lab-title">AI Quality Lab</h2><p>Đo khả năng trích xuất trên bộ dữ liệu tổng hợp đã gắn nhãn trước khi gọi model.</p></div>{state === "ready" ? <span className="evaluation-status"><UiIcon name="check" size={16} /> Có run thật</span> : null}</header>
      {state === "loading" ? <p className="evaluation-loading">Đang tải kết quả evaluation…</p> : null}
      {state === "unavailable" ? <div className="evaluation-unavailable" role="status"><UiIcon name="info" size={19} /><div><strong>Chưa có báo cáo model để hiển thị</strong><span>Chạy <code>npm run eval:text:publish</code> sau evaluation; fixture không được phép xuất hiện ở đây.</span></div></div> : null}
      {report ? <>
        <div className="evaluation-summary"><div><span>Đúng toàn giao dịch</span><strong>{formatEvaluationPercent(report.wholeTransaction.accuracy)}</strong><small>{report.wholeTransaction.correct}/{report.wholeTransaction.total} mẫu giao dịch</small></div><div><span>Từ chối ngoài phạm vi</span><strong>{formatEvaluationPercent(report.nonTransactionRejection.accuracy)}</strong><small>{report.nonTransactionRejection.correct}/{report.nonTransactionRejection.total} câu không phải giao dịch</small></div><div><span>JSON không hợp lệ</span><strong>{formatEvaluationPercent(report.invalidJson.rate)}</strong><small>{report.invalidJson.count}/{report.invalidJson.total} phản hồi</small></div></div>
        <div className="evaluation-fields" aria-label="Độ chính xác theo trường dữ liệu">{(Object.keys(fieldLabels) as Array<keyof typeof fieldLabels>).map((field) => { const result = report.fields[field]; return <div key={field}><span>{fieldLabels[field]}</span><strong>{formatEvaluationPercent(result.accuracy)}</strong><small>{result.correct}/{result.total}</small></div>; })}</div>
        <section className="evaluation-errors" aria-labelledby="evaluation-errors-title"><div><h3 id="evaluation-errors-title">Nhóm lỗi cần ưu tiên</h3><p>Đếm theo trường lệch nhãn; không che các mẫu model làm sai.</p></div>{errorGroups.length ? <ol>{errorGroups.map(([group, count]) => <li key={group}><span>{errorLabels[group] ?? group}</span><div aria-hidden="true"><i style={{ width: `${(count / maxErrorCount) * 100}%` }} /></div><b>{count}</b></li>)}</ol> : <p className="evaluation-no-errors">Không có lỗi được phân nhóm trong run này.</p>}</section>
        {report.examples ? <section className="evaluation-examples" aria-labelledby="evaluation-examples-title"><div><h3 id="evaluation-examples-title">Mẫu kiểm tra có thể đối chiếu</h3><p>Câu tự soạn, nhãn đã khóa trước khi gọi Gemini. Không có dữ liệu người dùng.</p></div><div className="evaluation-example-grid"><EvaluationExample title="Model làm đúng" sample={report.examples.correct} state="correct" /><EvaluationExample title="Model làm sai" sample={report.examples.incorrect} state="incorrect" /><EvaluationExample title="Code phát hiện bất nhất" sample={report.examples.validationDetected} state="guard" /></div></section> : null}
        <details className="evaluation-details"><summary>Xem phạm vi và giới hạn của benchmark</summary><dl><div><dt>Model</dt><dd>{report.model}</dd></div><div><dt>Prompt</dt><dd>{report.promptVersion}</dd></div><div><dt>Thời điểm chạy</dt><dd>{completedDate(report.completedAt)}</dd></div><div><dt>Cần người kiểm tra/sửa</dt><dd>{formatEvaluationPercent(report.requiresHumanReview.rate)} · {report.requiresHumanReview.count}/{report.requiresHumanReview.total} giao dịch</dd></div></dl><p>Bộ này gồm {report.cases} câu do dự án tự soạn ({report.transactionCases} giao dịch, {report.negativeCases} câu ngoài phạm vi), không phải dữ liệu người dùng hay giọng nói thực tế. Mọi kết quả AI trong ứng dụng vẫn phải được xác nhận trước khi lưu.</p></details>
      </> : null}
    </section>
  );
}
