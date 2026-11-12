import http from "node:http";

const host = "127.0.0.1";
const port = 18923;
const responseText = "MOCK-LLM-OK";

// Test controls, toggled from the e2e suite over /__control.
const state = {
  // Return 429 for the first request to each LLM path, to exercise retries.
  firstHitFlaky: true,
  // Return 429 for every free Google request until cleared.
  googleThrottle: false,
  // Return 429 only for these `client` quota pools, to exercise pool rotation.
  googleThrottleClients: [],
  // Return a 302 to Google's "sorry" captcha until cleared.
  googleCaptcha: false,
  google429Style: "plain",
  // Throttle only the default gateway, leaving /mirrorN/* healthy. Used to
  // prove that an extra gateway really is an independent quota pool.
  googleThrottlePrimary: false,
  myMemoryFail: false,
  libreFail: false,
  customFail: false,
};

const hitCounts = new Map();
const stats = {
  llmRequests: 0,
  llmRetried: 0,
  googleRequests: 0,
  googleSegments: 0,
  googleThrottled: 0,
  googleCaptchas: 0,
  googleByClient: {},
  myMemoryRequests: 0,
  libreRequests: 0,
  customRequests: 0,
  mirrorRequests: 0,
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

    if (/\/translate_a\/(?:single|t)(?:\?|$)/u.test(url)) {
      const params = new URLSearchParams(body);
      const client = params.get("client") || "gtx";
      const isMirror = /^\/mirror\d+\//u.test(url);
      stats.googleRequests += 1;
      if (isMirror) stats.mirrorRequests += 1;
      stats.googleByClient[client] = (stats.googleByClient[client] || 0) + 1;

      if (state.googleCaptcha) {
        stats.googleCaptchas += 1;
        response.statusCode = 302;
        response.setHeader("Location", "https://www.google.com/sorry/index?continue=x");
        response.end("");
        return;
      }
      const blocked =
        state.googleThrottle ||
        (state.googleThrottlePrimary && !isMirror) ||
        (Array.isArray(state.googleThrottleClients) &&
          state.googleThrottleClients.includes(client));
      if (blocked) {
        stats.googleThrottled += 1;
        response.statusCode = 429;
        if (state.google429Style === "llm") {
          response.setHeader("Retry-After", "1");
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: { message: "simulated 429" } }));
        } else if (state.google429Style === "no-body") {
          response.end("");
        } else {
          response.setHeader("Content-Type", "text/html");
          response.end("<html>Our systems have detected unusual traffic</html>");
        }
        return;
      }

      const segments = params.getAll("q");
      stats.googleSegments += segments.length;
      const isBatched = /\/translate_a\/t(?:\?|$)/u.test(url);
      // `translate_a/t` answers with a plain string array; the legacy
      // `/single` endpoint wraps each result in the nested dt=t shape.
      const payload = isBatched
        ? segments.map((text) => `ZH:${text}`)
        : segments.length === 1
          ? [[[`ZH:${segments[0]}`, segments[0], null, null, 1]]]
          : segments.map((text) => [[[`ZH:${text}`, text, null, null, 1]]]);
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(payload));
      return;
    }

    // MyMemory free API.
    if (url.startsWith("/get?")) {
      stats.myMemoryRequests += 1;
      const q = new URLSearchParams(url.slice(url.indexOf("?") + 1)).get("q") || "";
      response.setHeader("Content-Type", "application/json");
      if (state.myMemoryFail) {
        response.end(JSON.stringify({ quotaFinished: true, responseStatus: 429 }));
        return;
      }
      response.end(
        JSON.stringify({
          responseData: { translatedText: `MM:${q}`, match: 0 },
          quotaFinished: false,
          responseStatus: 200,
        }),
      );
      return;
    }

    // User-defined free endpoint (GET + dotted JSON result path).
    if (url.startsWith("/custom?")) {
      stats.customRequests += 1;
      const q = new URLSearchParams(url.slice(url.indexOf("?") + 1)).get("q") || "";
      response.setHeader("Content-Type", "application/json");
      if (state.customFail) {
        response.statusCode = 429;
        response.end(JSON.stringify({ error: "simulated custom endpoint quota" }));
        return;
      }
      response.end(
        JSON.stringify({ responseData: { translatedText: `CE:${q}` }, responseStatus: 200 }),
      );
      return;
    }

    // LibreTranslate self-hosted API.
    if (url === "/translate" && request.method === "POST") {
      stats.libreRequests += 1;
      let parsed = {};
      try {
        parsed = JSON.parse(body || "{}");
      } catch {
        parsed = {};
      }
      const segments = Array.isArray(parsed.q) ? parsed.q : [parsed.q];
      response.setHeader("Content-Type", "application/json");
      if (state.libreFail) {
        response.statusCode = 429;
        response.end(JSON.stringify({ error: "simulated LibreTranslate failure" }));
        return;
      }
      response.end(
        JSON.stringify({ translatedText: segments.map((text) => `LT:${String(text)}`) }),
      );
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

server.listen(port, "0.0.0.0", () => console.log(`mock-llm listening on ${host}:${port}`));
