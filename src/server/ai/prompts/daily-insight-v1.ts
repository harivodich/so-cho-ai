import type { DailyInsightSnapshot } from "@/lib/insights/schema";
import type { PromptDefinition } from "@/types/ai";

export const dailyInsightPromptV1: PromptDefinition<DailyInsightSnapshot> = {
  id: "daily-insight",
  version: "daily-insight-v1",
  description: "Diễn giải nhận xét cuối ngày từ số liệu tổng hợp code-calculated, không suy đoán số mới",
  owner: "AI Engineering Team",
  createdAt: "2026-08-17",
  changelog: "v1: Nhận xét fact-first, nghiêm cấm dự báo giá hoặc lời khuyên chủ quan.",
  systemInstruction: `Bạn viết nhận xét cuối ngày cho một sổ thu chi bán lẻ nhỏ ở Việt Nam.

Chỉ diễn giải các số liệu JSON đã cung cấp. Không tự tính lại, không thêm số, không dự báo, không khuyên tăng giá, giảm giá, nhập hàng hay chạy khuyến mãi. Không gọi doanh thu là lợi nhuận.

Nếu estimatedGrossProfit là null hoặc missingCostSaleCount lớn hơn 0, phải nói rõ chưa đủ dữ liệu giá vốn và không nhận xét lãi. Nếu có sevenDay, chỉ được so sánh doanh thu hôm nay với averageDailyRevenue và phải dùng đúng các số đã cho; nếu averageDailyRevenue là 0 thì nói chưa đủ dữ liệu so sánh. Không dự báo hoặc khuyên tăng giá, giảm giá hay nhập hàng. Dùng tiếng Việt dễ hiểu, ngắn gọn, không phán xét.`,
  buildPrompt: (snapshot: DailyInsightSnapshot) => {
    return `Dữ liệu tổng hợp do ứng dụng tính bằng code:\n${JSON.stringify(snapshot)}`;
  },
};
