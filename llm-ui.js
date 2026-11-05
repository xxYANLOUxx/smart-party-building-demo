/**
 * 智慧党建助手 · 大模型交互层
 * ------------------------------------------------------------------
 * 负责把流式回答渲染进对话气泡，并提供「模型设置」面板。
 * 设计原则：这一层是"叠加"的——移除本文件与相关脚本标签后，原型
 * 即回到原先的内置演示回答，不影响任何既有交互。
 *
 * 对外接口：window.PartyLLMUI
 *   isReady()               是否可以走真实大模型
 *   streamAnswer(options)   把回答流式写入指定容器
 *   abortAll()              中止所有进行中的生成
 *   openSettings(options)   打开模型设置面板
 *   isStreaming()           是否有生成进行中
 */
(function () {
  const activeStreams = new Set();
  let settingsDialog = null;
  let hintShown = false;

  const query = (selector, root = document) => root.querySelector(selector);

  function isReady() {
    return Boolean(window.PartyLLM && window.PartyLLM.isConfigured());
  }

  function isStreaming() {
    return activeStreams.size > 0;
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
  }

  function notify(message) {
    if (typeof window.showToast === "function") window.showToast(message);
  }

  function hintOnce() {
    if (hintShown) return;
    hintShown = true;
    notify("当前为内置演示回答，点击「模型设置」可接入真实大模型");
  }

  function buildStatusRow() {
    const row = document.createElement("div");
    row.className = "llm-status";
    row.dataset.state = "waiting";
    row.innerHTML = [
      '<span class="llm-dots" aria-hidden="true"><i></i><i></i><i></i></span>',
      '<span class="llm-status-text">正在思考</span>',
      '<button type="button" class="llm-stop">停止</button>'
    ].join("");
    return row;
  }

  function buildErrorRow(reason, onRetry) {
    const row = document.createElement("div");
    row.className = "llm-status";
    row.dataset.state = "error";
    row.innerHTML = [
      '<i data-lucide="circle-alert" class="llm-error-icon"></i>',
      '<span class="llm-status-text"></span>',
      '<button type="button" class="llm-retry">重试</button>'
    ].join("");
    query(".llm-status-text", row).textContent = reason;
    query(".llm-retry", row).addEventListener("click", () => {
      row.remove();
      onRetry();
    });
    return row;
  }

  function clearStatusRows(message) {
    if (!message) return;
    message.querySelectorAll(".llm-status").forEach(row => row.remove());
  }

  /**
   * 流式写入回答。
   * options: { mount, session, question, fallback, message, onScroll, onDone }
   */
  async function streamAnswer(options) {
    const opts = options || {};
    const mount = opts.mount;
    if (!mount) return;

    const message = opts.message || mount.closest(".message, .draft-card, .context-message") || mount.parentElement || mount;
    const scroll = typeof opts.onScroll === "function" ? opts.onScroll : () => {};
    const fallback = opts.fallback || "";

    if (!isReady()) {
      hintOnce();
      mount.textContent = fallback;
      scroll();
      return;
    }

    clearStatusRows(message);
    mount.textContent = "";
    mount.classList.add("stream-text", "is-streaming");

    const status = buildStatusRow();
    mount.insertAdjacentElement("afterend", status);
    scroll();

    const controller = new AbortController();
    const task = { controller, message };
    activeStreams.add(task);

    const stopButton = query(".llm-stop", status);
    const statusText = query(".llm-status-text", status);
    const handleStop = () => controller.abort();
    stopButton.addEventListener("click", handleStop);

    const settle = () => {
      activeStreams.delete(task);
      stopButton.removeEventListener("click", handleStop);
    };

    const rerun = () => streamAnswer({ ...opts, message });

    try {
      const result = await window.PartyLLM.streamChat({
        messages: opts.session ? opts.session.messages(opts.question) : [{ role: "user", content: String(opts.question || "") }],
        onFirstDelta: () => {
          status.dataset.state = "writing";
          if (statusText) statusText.textContent = "生成中";
          refreshIcons();
        },
        onDelta: (piece, full) => {
          mount.textContent = full;
          scroll();
        },
        signal: controller.signal
      });

      mount.classList.remove("is-streaming");
      status.remove();
      settle();

      if (result.aborted) {
        const partial = mount.textContent.trim();
        if (partial) {
          if (opts.session) opts.session.commit(opts.question, partial);
          notify("已停止生成");
        } else {
          mount.textContent = fallback;
          notify("已停止生成");
        }
        scroll();
        return;
      }

      if (opts.session) opts.session.commit(opts.question, result.text);
      if (typeof opts.onDone === "function") opts.onDone(result.text);
      scroll();
    } catch (error) {
      mount.classList.remove("is-streaming");
      settle();
      const reason = window.PartyLLM ? window.PartyLLM.describeError(error) : "调用大模型失败。";
      const partial = mount.textContent.trim();

      if (partial && opts.session) opts.session.commit(opts.question, partial);
      if (!partial) mount.textContent = fallback;

      mount.insertAdjacentElement("afterend", buildErrorRow(reason, rerun));
      refreshIcons();
      scroll();
    }
  }

  function abortAll() {
    [...activeStreams].forEach(task => {
      try {
        task.controller.abort();
      } catch {
        // 忽略中止异常
      }
    });
    activeStreams.clear();
  }

  /* ------------------------------ 模型设置面板 ------------------------------ */

  function buildSettingsDialog() {
    const backdrop = document.createElement("div");
    backdrop.className = "llm-settings-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML = [
      '<section class="llm-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="llmSettingsTitle">',
      '  <div class="llm-settings-head">',
      '    <div><span class="page-eyebrow">大模型接入</span><h2 id="llmSettingsTitle">模型设置</h2></div>',
      '    <button type="button" class="icon-button light llm-settings-close" title="关闭" aria-label="关闭"><i data-lucide="x"></i></button>',
      "  </div>",
      '  <p class="llm-settings-intro">原型采用浏览器直连 DeepSeek（OpenAI 兼容协议）。Key 只保存在本机浏览器，不会写入代码文件。</p>',
      '  <label class="llm-field"><span>API Key</span><input type="password" id="llmApiKeyInput" placeholder="sk-..." autocomplete="off" spellcheck="false" /></label>',
      '  <label class="llm-field"><span>接口地址</span><input type="text" id="llmBaseUrlInput" placeholder="https://api.deepseek.com" spellcheck="false" /></label>',
      '  <label class="llm-field"><span>模型名称</span><input type="text" id="llmModelInput" placeholder="deepseek-chat" spellcheck="false" /></label>',
      '  <div class="llm-warning"><i data-lucide="shield-alert"></i><span>前端直连会把 Key 暴露给任何打开页面的人，仅建议本地演示；对客户或同事演示时请改用随附的 local-proxy.js 代理。</span></div>',
      '  <div class="llm-settings-status" id="llmSettingsStatus" hidden></div>',
      '  <div class="llm-settings-actions">',
      '    <button type="button" class="ghost-button llm-test">保存并测试连接</button>',
      '    <button type="button" class="ghost-button llm-clear">清除配置</button>',
      '    <span class="llm-spacer"></span>',
      '    <button type="button" class="ghost-button llm-later">稍后配置</button>',
      '    <button type="button" class="primary-button llm-save">保存</button>',
      "  </div>",
      "</section>"
    ].join("\n");
    document.body.appendChild(backdrop);

    const fields = {
      apiKey: query("#llmApiKeyInput", backdrop),
      baseUrl: query("#llmBaseUrlInput", backdrop),
      model: query("#llmModelInput", backdrop)
    };
    const statusBox = query("#llmSettingsStatus", backdrop);

    const setStatus = (kind, text) => {
      statusBox.hidden = !text;
      statusBox.dataset.kind = kind || "info";
      statusBox.textContent = text || "";
    };

    const fillFromSettings = () => {
      const settings = window.PartyLLM.getSettings();
      fields.apiKey.value = settings.apiKey;
      fields.baseUrl.value = settings.baseUrl;
      fields.model.value = settings.model;
    };

    const collect = () => ({
      apiKey: fields.apiKey.value.trim(),
      baseUrl: fields.baseUrl.value.trim(),
      model: fields.model.value.trim()
    });

    const close = () => {
      backdrop.classList.remove("open");
      backdrop.setAttribute("aria-hidden", "true");
      setStatus("info", "");
    };

    const save = () => {
      const values = collect();
      if (!values.apiKey) {
        setStatus("error", "请先填写 API Key。");
        fields.apiKey.focus();
        return false;
      }
      window.PartyLLM.saveSettings(values);
      return true;
    };

    query(".llm-settings-close", backdrop).addEventListener("click", close);
    query(".llm-later", backdrop).addEventListener("click", close);
    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && backdrop.classList.contains("open")) close();
    });

    query(".llm-save", backdrop).addEventListener("click", () => {
      if (!save()) return;
      close();
      notify("模型配置已保存");
    });

    query(".llm-clear", backdrop).addEventListener("click", () => {
      window.PartyLLM.saveSettings({ apiKey: "", baseUrl: "", model: "" });
      fillFromSettings();
      setStatus("info", "已清除本机保存的模型配置。");
      notify("已清除模型配置");
    });

    query(".llm-test", backdrop).addEventListener("click", async event => {
      const button = event.currentTarget;
      if (!save()) return;
      button.disabled = true;
      setStatus("info", "正在连接模型服务…");
      try {
        const result = await window.PartyLLM.testConnection();
        setStatus("ok", `连接成功：${result.model} 返回「${result.reply || "正常"}」。现在可以直接在对话中提问了。`);
        notify("模型连接成功");
      } catch (error) {
        setStatus("error", window.PartyLLM.describeError(error));
      } finally {
        button.disabled = false;
      }
    });

    backdrop.open = () => {
      fillFromSettings();
      backdrop.classList.add("open");
      backdrop.setAttribute("aria-hidden", "false");
      refreshIcons();
      setTimeout(() => fields.apiKey.focus({ preventScroll: true }), 120);
    };
    backdrop.close = close;
    return backdrop;
  }

  function openSettings(options) {
    if (!window.PartyLLM) return;
    if (!settingsDialog) settingsDialog = buildSettingsDialog();
    settingsDialog.open();
    const hint = options && options.hint;
    if (hint) {
      const statusBox = query("#llmSettingsStatus", settingsDialog);
      statusBox.hidden = false;
      statusBox.dataset.kind = "info";
      statusBox.textContent = hint;
    }
  }

  function mountSettingsEntry() {
    const makeButton = () => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-button light llm-settings-entry";
      button.title = "模型设置";
      button.setAttribute("aria-label", "模型设置");
      button.innerHTML = '<i data-lucide="settings-2"></i>';
      button.addEventListener("click", () => openSettings());
      return button;
    };

    const chatActions = query(".chat-header-actions");
    if (chatActions && !query(".llm-settings-entry", chatActions)) chatActions.appendChild(makeButton());

    const contextHeader = query(".context-panel-header");
    if (contextHeader && !query(".llm-settings-entry", contextHeader)) {
      const closeButton = query("#closeContextualAi", contextHeader);
      const button = makeButton();
      if (closeButton) contextHeader.insertBefore(button, closeButton);
      else contextHeader.appendChild(button);
    }
  }

  function boot() {
    mountSettingsEntry();
    refreshIcons();
    if (!isReady()) {
      setTimeout(() => {
        openSettings({ hint: "填写 DeepSeek API Key 后即可让本原型使用真实大模型；不填写则继续使用内置演示回答。" });
      }, 600);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.PartyLLMUI = {
    isReady,
    isStreaming,
    streamAnswer,
    abortAll,
    openSettings,
    hintOnce
  };
})();
