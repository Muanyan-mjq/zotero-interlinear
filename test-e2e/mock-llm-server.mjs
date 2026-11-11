import http from "node:http";

const host = "127.0.0.1";
const port = 18923;
const responseText = "MOCK-LLM-OK";

const server = http.createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    const url = request.url || "";
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

server.listen(port, "0.0.0.0", () => console.log(`mock-llm listening on 0.0.0.0:${port}`));
