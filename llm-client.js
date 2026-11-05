/**
 * 智慧党建助手 · 大模型客户端
 * ------------------------------------------------------------------
 * 纯前端直连，兼容 OpenAI Chat Completions 协议（默认 DeepSeek）。
 * 提供：配置读写 / 配置检测 / 流式对话 / 非流式对话 / 连接测试 / 会话历史。
 *
 * 对外接口：window.PartyLLM
 *   isConfigured()                       是否已具备可用配置
 *   getSettings() / saveSettings(patch)  读取与保存配置（Key 存 localStorage）
 *   createSession(systemPrompt)          创建一个带历史的会话
 *   streamChat({...})                    流式对话，逐字回调 onDelta
 *   chat({...})                          非流式对话（用于连接测试）
 *   testConnection()                     发送一次极短请求验证 Key 与网络
 */
(function () {
  const config = window.PARTY_LLM_CONFIG || {};
  const storageKeys = config.storage || {};

  function readStored(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function writeStored(key, value) {
    try {
      const text = String(value == null ? "" : value).trim();
      if (text) localStorage.setItem(key, text);
      else localStorage.removeItem(key);
    } catch {
      // 浏览器隐私模式下无法持久化，本次会话仍然可用
    }
  }

  function getSettings() {
    return {
      apiKey: readStored(storageKeys.apiKey) || config.apiKey || "",
      baseUrl: String(readStored(storageKeys.baseUrl) || config.baseUrl || "").replace(/\/+$/, ""),
      model: readStored(storageKeys.model) || config.model || "deepseek-chat"
    };
  }

  function saveSettings(patch) {
    const next = patch || {};
    if ("apiKey" in next) writeStored(storageKeys.apiKey, next.apiKey);
    if ("baseUrl" in next) writeStored(storageKeys.baseUrl, next.baseUrl);
    if ("model" in next) writeStored(storageKeys.model, next.model);
  }

  function isConfigured() {
    if (config.enabled === false) return false;
    const settings = getSettings();
    return Boolean(settings.apiKey && settings.baseUrl && settings.model);
  }

  class LlmError extends Error {
    constructor(message, code) {
      super(message);
      this.name = "LlmError";
      this.code = code || "LLM_ERROR";
    }
  }

  function shorten(text, limit = 160) {
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function httpError(status, body) {
    const detail = shorten(body);
    if (status === 401 || status === 403) {
      return new LlmError("API Key 无效或没有访问权限，请点击「模型设置」重新填写。", "AUTH");
    }
    if (status === 402) {
      return new LlmError("模型账户余额不足，请充值后重试。", "QUOTA");
    }
    if (status === 429) {
      return new LlmError("请求过于频繁或已达调用限额，请稍后再试。", "RATE_LIMIT");
    }
    if (status === 400) {
      return new LlmError(`模型服务拒绝了本次请求（400）${detail ? "：" + detail : ""}`, "BAD_REQUEST");
    }
    if (status >= 500) {
      return new LlmError(`模型服务暂时不可用（${status}），请稍后重试。`, "SERVER");
    }
    return new LlmError(`请求失败（${status}）${detail ? "：" + detail : ""}`, "HTTP");
  }

  function networkError() {
    return new LlmError(
      "无法连接模型服务：可能是网络不通，或浏览器跨域（CORS）限制。可尝试用本地 http 服务打开原型，或启用随附的 local-proxy.js 代理。",
      "NETWORK"
    );
  }

  function isNetworkError(error) {
    // 不用 instanceof：跨执行域（iframe / vm / 不同 realm）时判断会失效
    return Boolean(error) && (error instanceof TypeError || error.name === "TypeError");
  }

  function describeError(error) {
    if (error instanceof LlmError) return error.message;
    if (error && error.name === "AbortError") return "请求已中止。";
    if (isNetworkError(error)) return networkError().message;
    return `调用大模型时发生未知错误：${shorten(error && error.message ? error.message : error)}`;
  }

  function buildRequest(options) {
    const settings = getSettings();
    if (!settings.apiKey) {
      throw new LlmError("尚未配置 API Key，请先在「模型设置」中填写。", "NO_KEY");
    }
    return {
      settings,
      url: `${settings.baseUrl}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: {
        model: settings.model,
        messages: options.messages || [],
        stream: Boolean(options.stream),
        temperature: options.temperature == null ? config.temperature : options.temperature,
        max_tokens: options.maxTokens == null ? config.maxTokens : options.maxTokens
      }
    };
  }

  function linkSignal(external) {
    const controller = new AbortController();
    if (external) {
      if (external.aborted) controller.abort();
      else external.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return controller;
  }

  /**
   * 流式对话：逐字回调 onDelta。
   * 用户主动中止 -> 正常返回 { text, aborted: true }；超时或出错 -> 抛出 LlmError。
   */
  async function streamChat(options) {
    const opts = options || {};
    const { url, headers, body } = buildRequest({ ...opts, stream: true });
    const controller = linkSignal(opts.signal);
    const timeoutMs = Number(opts.timeoutMs || config.timeoutMs) || 60000;
    let timedOut = false;
    let watchdog = null;

    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    };
    const disarmWatchdog = () => clearTimeout(watchdog);

    let response;
    armWatchdog();
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      disarmWatchdog();
      if (timedOut) throw new LlmError("连接模型服务超时，请检查网络后重试。", "TIMEOUT");
      if (opts.signal && opts.signal.aborted) return { text: "", aborted: true };
      throw isNetworkError(error) ? networkError() : error;
    }

    if (!response.ok) {
      disarmWatchdog();
      let text = "";
      try {
        text = await response.text();
      } catch {
        // 响应体读取失败时仅依据状态码提示
      }
      throw httpError(response.status, text);
    }

    if (!response.body) {
      disarmWatchdog();
      throw new LlmError("模型服务返回了无法解析的响应（缺少流式内容）。", "NO_BODY");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let full = "";
    let firstDelta = true;

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        armWatchdog();
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let parsed = null;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }

          const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
          const piece = delta && typeof delta.content === "string" ? delta.content : "";
          if (!piece) continue;

          if (firstDelta) {
            firstDelta = false;
            if (typeof opts.onFirstDelta === "function") opts.onFirstDelta();
          }
          full += piece;
          if (typeof opts.onDelta === "function") opts.onDelta(piece, full);
        }
      }
    } catch (error) {
      disarmWatchdog();
      if (timedOut) throw new LlmError("模型响应中断：长时间未收到新内容，已停止等待。", "TIMEOUT");
      if (opts.signal && opts.signal.aborted) return { text: full, aborted: true };
      throw isNetworkError(error) ? networkError() : error;
    } finally {
      disarmWatchdog();
      try {
        reader.releaseLock();
      } catch {
        // 释放失败不影响结果
      }
    }

    if (timedOut) throw new LlmError("模型响应中断：长时间未收到新内容，已停止等待。", "TIMEOUT");
    if (opts.signal && opts.signal.aborted) return { text: full, aborted: true };
    if (!full.trim()) throw new LlmError("模型没有返回内容，请调整问题后重试。", "EMPTY");
    return { text: full, aborted: false };
  }

  /** 非流式对话，用于连接测试等短请求 */
  async function chat(options) {
    const opts = options || {};
    const { url, headers, body } = buildRequest({ ...opts, stream: false });
    const timeoutMs = Number(opts.timeoutMs || config.timeoutMs) || 60000;
    const controller = new AbortController();
    const watchdog = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        let detail = "";
        try {
          detail = await response.text();
        } catch {
          // 忽略响应体读取失败
        }
        throw httpError(response.status, detail);
      }
      const data = await response.json();
      const message = data.choices && data.choices[0] && data.choices[0].message;
      return message && message.content ? message.content : "";
    } catch (error) {
      if (error && error.name === "AbortError") throw new LlmError("连接模型服务超时，请检查网络后重试。", "TIMEOUT");
      throw isNetworkError(error) ? networkError() : error;
    } finally {
      clearTimeout(watchdog);
    }
  }

  async function testConnection() {
    const settings = getSettings();
    const reply = await chat({
      messages: [{ role: "user", content: "请只回复两个字：正常" }],
      temperature: 0,
      maxTokens: 16,
      timeoutMs: 20000
    });
    return { model: settings.model, baseUrl: settings.baseUrl, reply: reply.trim() };
  }

  /**
   * 会话历史：按轮数裁剪，避免 token 无限增长。
   * messages(question) 给出完整请求体；commit(user, assistant) 落库。
   */
  function createSession(systemPrompt) {
    const history = [];

    const trim = () => {
      const turns = Math.max(1, Number(config.historyTurns) || 8);
      const limit = turns * 2;
      if (history.length > limit) history.splice(0, history.length - limit);
    };

    return {
      reset() {
        history.length = 0;
      },
      get length() {
        return history.length;
      },
      messages(question) {
        return [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...history.slice(),
          { role: "user", content: question }
        ];
      },
      commit(userText, assistantText) {
        history.push({ role: "user", content: userText });
        if (assistantText) history.push({ role: "assistant", content: assistantText });
        trim();
      },
      dropLast() {
        history.pop();
      }
    };
  }

  window.PartyLLM = {
    config,
    LlmError,
    isConfigured,
    getSettings,
    saveSettings,
    createSession,
    streamChat,
    chat,
    testConnection,
    describeError
  };
})();
