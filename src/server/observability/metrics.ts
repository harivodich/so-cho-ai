type RouteMetric = {
  totalRequests: number;
  totalErrors: number;
  latenciesMs: number[];
};

type AiMetric = {
  totalCalls: number;
  successfulCalls: number;
  latenciesMs: number[];
  tokenUsage: { prompt: number; completion: number };
};

const routeMetrics = new Map<string, RouteMetric>();
const aiMetrics = new Map<string, AiMetric>();

export const metrics = {
  recordApiRequest(route: string, status: number, latencyMs: number) {
    let metric = routeMetrics.get(route);
    if (!metric) {
      metric = { totalRequests: 0, totalErrors: 0, latenciesMs: [] };
      routeMetrics.set(route, metric);
    }
    metric.totalRequests += 1;
    if (status >= 400) {
      metric.totalErrors += 1;
    }
    metric.latenciesMs.push(latencyMs);
    if (metric.latenciesMs.length > 500) {
      metric.latenciesMs.shift();
    }
  },

  recordAiCall(
    model: string,
    latencyMs: number,
    success: boolean,
    tokens?: { prompt?: number; completion?: number; promptTokens?: number; completionTokens?: number },
  ) {
    let metric = aiMetrics.get(model);
    if (!metric) {
      metric = {
        totalCalls: 0,
        successfulCalls: 0,
        latenciesMs: [],
        tokenUsage: { prompt: 0, completion: 0 },
      };
      aiMetrics.set(model, metric);
    }
    metric.totalCalls += 1;
    if (success) metric.successfulCalls += 1;
    metric.latenciesMs.push(latencyMs);
    if (metric.latenciesMs.length > 500) {
      metric.latenciesMs.shift();
    }
    if (tokens) {
      metric.tokenUsage.prompt += tokens.promptTokens ?? tokens.prompt ?? 0;
      metric.tokenUsage.completion += tokens.completionTokens ?? tokens.completion ?? 0;
    }
  },

  getSummary() {
    const routes: Record<string, { total: number; errorRate: number; p95LatencyMs: number }> = {};
    for (const [route, m] of routeMetrics.entries()) {
      const sorted = [...m.latenciesMs].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
      routes[route] = {
        total: m.totalRequests,
        errorRate: m.totalRequests > 0 ? Number((m.totalErrors / m.totalRequests).toFixed(4)) : 0,
        p95LatencyMs: p95,
      };
    }

    const ai: Record<string, { totalCalls: number; successRate: number; avgLatencyMs: number; tokens: { prompt: number; completion: number } }> = {};
    for (const [model, m] of aiMetrics.entries()) {
      const avgLatency = m.latenciesMs.length > 0
        ? Math.round(m.latenciesMs.reduce((a, b) => a + b, 0) / m.latenciesMs.length)
        : 0;
      ai[model] = {
        totalCalls: m.totalCalls,
        successRate: m.totalCalls > 0 ? Number((m.successfulCalls / m.totalCalls).toFixed(4)) : 0,
        avgLatencyMs: avgLatency,
        tokens: m.tokenUsage,
      };
    }

    return { routes, ai };
  },

  clear() {
    routeMetrics.clear();
    aiMetrics.clear();
  },
};
