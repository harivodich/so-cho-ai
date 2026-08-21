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
    tokens?: { prompt?: number; completion?: number },
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
      metric.tokenUsage.prompt += tokens.prompt || 0;
      metric.tokenUsage.completion += tokens.completion || 0;
    }
  },

  getSummary() {
    const routes: Record<string, { total: number; errors: number; avgLatencyMs: number; p95Ms: number }> = {};
    for (const [route, m] of routeMetrics.entries()) {
      const sorted = [...m.latenciesMs].sort((a, b) => a - b);
      const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
      const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1] : 0;
      routes[route] = {
        total: m.totalRequests,
        errors: m.totalErrors,
        avgLatencyMs: avg,
        p95Ms: p95,
      };
    }

    const ai: Record<string, { total: number; successRate: number; avgLatencyMs: number }> = {};
    for (const [model, m] of aiMetrics.entries()) {
      const avg = m.latenciesMs.length ? Math.round(m.latenciesMs.reduce((a, b) => a + b, 0) / m.latenciesMs.length) : 0;
      ai[model] = {
        total: m.totalCalls,
        successRate: m.totalCalls ? Math.round((m.successfulCalls / m.totalCalls) * 100) : 0,
        avgLatencyMs: avg,
      };
    }

    return { routes, ai };
  },
};
