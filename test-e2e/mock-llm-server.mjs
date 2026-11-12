import http from "node:http";

const host = "127.0.0.1";
const port = 18923;
const responseText = "MOCK-LLM-OK";

// Test controls, toggled from the e2e suite over /__control.
const state = {
  // Return 429 for the first request to each LLM path, to exercise retries.
  firstHitFlaky: true,
  // Return 429 for every /translate_a/single request until cleared.
  googleThrottle: false,
  // Return a 302 to Google's "sorry" captcha until cleared.
  googleCaptcha: false,
};

const hitCounts = new Map();
const stats = {
  llmRequests: 0,
  llmRetried: 0,
  googleRequests: 0,
  googleSegments: 0,
  googleThrottled: 0,
  googleCaptchas: 0,
};

function bump(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const url = request.url || "";

    if (url === "/__control") {
      try {
        Object.assign(state, JSON.parse(body || "{}"));
        response.statusCode = 200;
        response.end(JSON.stringify(state));
      } catch {
        response.statusCode = 400;
        response.end("{}");
      }
      return;
    }

    if (url === "/__stats") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(stats));
      return;
    }

    if (/\/translate_a\/single(?:\?|$)/u.test(url)) {
      stats.googleRequests += 1;
      if (state.googleCaptcha) {
        stats.googleCaptchas += 1;
        response.statusCode = 302;
        response.setHeader("Location", "https://www.google.com/sorry/index?continue=x");
        response.end("");
        return;
      }
      if (state.googleThrottle) {
        stats.googleThrottled += 1;
        response.statusCode = 429;
        response.setHeader("Content-Type", "text/html");
        response.end("<html>Our systems have detected unusual traffic</html>");
        return;
      }

      const params = new URLSearchParams(body);
      const segments = params.getAll("q");
      stats.googleSegments += segments.length;
      // One result per q, in order: each entry is the regular single-q
      // payload `[[[translated, original, ...], ...], ...]`.
      const results = segments.map((text) => [[["ZH:" + text, text, null, null, 1]]]);
      const payload = segments.length === 1 ? results[0] : results;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(payload));
      return;
    }

    let payload;
    if (/\/chat\/completions(?:\?|$)/u.test(url)) {
      payload = { choices: [{ message: { role: "assistant", content: responseText } }] };
    } else if (/\/messages(?:\?|$)/u.test(url)) {
      payload = { content: [{ type: "text", text: responseText }] };
    } else if (/:generateContent/u.test(url)) {
      payload = { candidates: [{ content: { parts: [{ text: responseText }] } }] };
    } else if (/\/api\/chat(?:\?|$)/u.test(url)) {
      payload = { message: { role: "assistant", content: responseText } };
    }

    stats.llmRequests += 1;
    if (payload && state.firstHitFlaky) {
      const hits = bump(hitCounts, request.url) || hitCounts.get(request.url);
      if (hits === 1) {
        stats.llmRetried += 1;
        response.statusCode = 429;
        response.setHeader("Retry-After", "1");
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: { message: "simulated first-hit 429" } }));
        return;
      }
    }

    console.log(
      `${request.method} ${url} auth=${request.headers.authorization ? "bearer" : "-"} ` +
        `key=${request.headers["x-api-key"] || request.headers["x-goog-api-key"] || "-"} ` +
        `bytes=${body.length}`,
    );
    response.setHeader("Content-Type", "application/json");
    if (!payload) {
      response.statusCode = 404;
      payload = { error: { message: `unexpected path ${url}` } };
    }
    response.end(JSON.stringify(payload));
  });
});

server.listen(port, "0.0.0.0", () => console.log(`mock-llm listening on 0.0.0.1:${port}`));
