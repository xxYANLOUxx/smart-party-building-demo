/**
 * 智慧党建助手 · 本地模型代理（可选组件，默认不需要）
 * ------------------------------------------------------------------
 * 什么时候需要它？
 *   1. 浏览器直连 DeepSeek 被跨域（CORS）拦截时；
 *   2. 不想把 API Key 放在前端（对同事或客户演示时）。
 *
 * 使用方法（Windows PowerShell，在 prototype-demo 目录下执行）：
 *   $env:DEEPSEEK_API_KEY="sk-你的key"
 *   node local-proxy.js
 *
 * 然后在原型右上角「模型设置」中填写：
 *   接口地址：http://127.0.0.1:8787/v1
 *   API Key ：proxy            （占位即可，真实 Key 由代理注入）
 *   模型名称：deepseek-chat
 *
 * 说明：仅使用 Node 内置模块，无需 npm install。
 */
const http = require("node:http");
const { Readable } = require("node:stream");

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const ENV_KEY = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method !== "POST" || !url.pathname.endsWith("/chat/completions")) {
    res.writeHead(404, { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: "仅支持 POST /v1/chat/completions" } }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const payload = Buffer.concat(chunks);

  const authHeader = String(req.headers.authorization || "");
  const apiKey = ENV_KEY || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "");
  if (!apiKey) {
    res.writeHead(401, { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: "缺少 API Key：请设置环境变量 DEEPSEEK_API_KEY，或在前端填写。" } }));
    return;
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: payload
    });

    res.writeHead(upstream.status, {
      ...CORS_HEADERS,
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-cache"
    });

    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end(await upstream.text());
  } catch (error) {
    res.writeHead(502, { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: `代理转发失败：${error.message}` } }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`模型代理已启动：http://127.0.0.1:${PORT}/v1`);
  console.log(`上游服务：${UPSTREAM}`);
  console.log(ENV_KEY ? "已从环境变量读取 API Key。" : "未检测到 DEEPSEEK_API_KEY，将使用前端传入的 Key。");
});
