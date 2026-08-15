#!/usr/bin/env node

const baseUrl = (process.argv[2] ?? process.env.PUBLIC_BASE_URL ?? "https://so-cho-ai-tau.vercel.app").replace(/\/$/, "");

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.text() };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const home = await request("/");
  assert(home.response.status === 200, `GET / expected 200, got ${home.response.status}`);
  assert(/Sổ Chợ AI|Sổ Chợ/.test(home.body), "GET / did not contain the product title");

  const config = await request("/api/firebase-config");
  assert(config.response.status === 200, `GET /api/firebase-config expected 200, got ${config.response.status}`);
  const configBody = JSON.parse(config.body);
  const firebase = configBody.firebase ?? {};
  assert(configBody.configured === true, "Firebase config is not marked configured");
  for (const field of ["apiKey", "authDomain", "projectId", "appId"]) {
    assert(typeof firebase[field] === "string" && firebase[field].length > 0, `Firebase field ${field} is missing`);
  }

  const extract = await request("/api/extract", { method: "POST" });
  assert(extract.response.status === 401, `POST /api/extract without auth expected 401, got ${extract.response.status}`);

  const insights = await request("/api/insights", { method: "POST" });
  assert(insights.response.status === 401, `POST /api/insights without auth expected 401, got ${insights.response.status}`);

  console.log(JSON.stringify({
    status: "passed",
    baseUrl,
    home: home.response.status,
    firebaseConfig: "configured",
    protectedRoutes: { extract: extract.response.status, insights: insights.response.status },
  }));
} catch (error) {
  console.error(`Public smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
