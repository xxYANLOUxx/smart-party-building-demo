function loadAssistantFeedback() {
  try {
    const records = JSON.parse(localStorage.getItem("partyAssistantFeedback") || "[]");
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

const state = {
  selected: {
    org: "招商银行党委",
    business: "主题党日",
    time: "近 30 天"
  },
  feedback: loadAssistantFeedback(),
  diagnosis: {
    activeTask: "monthly",
    business: "主题党日",
    time: "2026 年 7 月",
    organization: "招商银行党委及下属组织",
    status: "待执行",
    currentIssue: null,
    rectificationSent: false
  },
  toastTimer: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function saveAssistantFeedback(record) {
  const entry = { ...record, recordedAt: new Date().toISOString() };
  state.feedback.push(entry);
  try {
    localStorage.setItem("partyAssistantFeedback", JSON.stringify(state.feedback));
  } catch {
    // The prototype still records feedback in memory when storage is unavailable.
  }
}

function getQueryResultContext() {
  return {
    question: "帮我查询主题党日开展情况",
    organization: state.selected.org,
    business: state.selected.business,
    timeRange: state.selected.time,
    resultSummary: "活动总数 12；已完成归档 9；待补材料 3"
  };
}

function closeMenus() {
  $$(".select-menu.open").forEach(menu => menu.classList.remove("open"));
  $$(".select-field.open").forEach(field => field.classList.remove("open"));
}

function toggleAssistantWidget() {
  const widget = $("#assistantWidget");
  const arrow = $("#floatingExpand");
  if (!widget || !arrow) return;

  const isCollapsed = !widget.classList.contains("is-collapsed");
  widget.classList.toggle("is-collapsed", isCollapsed);
  arrow.setAttribute("aria-expanded", String(!isCollapsed));
  arrow.setAttribute("aria-label", isCollapsed ? "展开 AI 党建助手" : "收起 AI 党建助手");
  arrow.setAttribute("title", isCollapsed ? "展开 AI 党建助手" : "收起 AI 党建助手");
}

function setupTransferOrganizationTree() {
  const tree = $("#transferOrgTree");
  if (!tree) return;

  const setExpanded = (treeItem, isExpanded) => {
    const expander = $(".tree-expander", treeItem);
    const children = $(".tree-children", treeItem);
    treeItem.classList.toggle("is-open", isExpanded);
    children?.classList.toggle("is-collapsed", !isExpanded);
    expander?.setAttribute("aria-expanded", String(isExpanded));
    if (expander) {
      const label = $(".tree-node", treeItem).textContent.trim();
      expander.setAttribute("aria-label", `${isExpanded ? "收起" : "展开"}${label}`);
    }
  };

  $$(".tree-item", tree).forEach(treeItem => {
    if ($(".tree-expander", treeItem)) setExpanded(treeItem, treeItem.classList.contains("is-open"));
  });

  $$(".tree-expander", tree).forEach(expander => {
    expander.addEventListener("click", event => {
      event.stopPropagation();
      const treeItem = expander.closest(".tree-item");
      setExpanded(treeItem, !treeItem.classList.contains("is-open"));
    });
  });

  $$(".tree-node", tree).forEach(node => {
    node.addEventListener("click", () => {
      $$(".tree-item.is-selected", tree).forEach(treeItem => treeItem.classList.remove("is-selected"));
      const treeItem = node.closest(".tree-item");
      treeItem.classList.add("is-selected");
      showToast(`已切换至：${node.textContent.trim()}`);
    });
  });
}

function setupSidebarNavigation() {
  const sidebarMenu = $("#sidebarMenu");
  if (!sidebarMenu) return;

  const getTargetMenu = trigger => document.getElementById(trigger.dataset.navToggle);
  const setExpanded = (trigger, isOpen) => {
    const targetMenu = getTargetMenu(trigger);
    trigger.classList.toggle("is-open", isOpen);
    trigger.setAttribute("aria-expanded", String(isOpen));
    targetMenu?.classList.toggle("open", isOpen);
  };
  const closeThirdLevelMenus = exceptTrigger => {
    $$(".nav-level-2[data-nav-toggle]", sidebarMenu).forEach(trigger => {
      if (trigger !== exceptTrigger) setExpanded(trigger, false);
    });
  };
  const closeFirstLevelMenus = exceptTrigger => {
    $$(".nav-level-1[data-nav-toggle]", sidebarMenu).forEach(trigger => {
      if (trigger !== exceptTrigger) setExpanded(trigger, false);
    });
    closeThirdLevelMenus();
  };
  const activateLeaf = leaf => {
    $$(".nav-level-1, .nav-level-2, .nav-level-3", sidebarMenu).forEach(item => item.classList.remove("active"));
    $$(".has-active-child", sidebarMenu).forEach(item => item.classList.remove("has-active-child"));
    leaf.classList.add("active");

    const levelTwoRow = leaf.closest(".nav-level-2-row");
    const parentLevelTwo = levelTwoRow && $(".nav-level-2", levelTwoRow);
    const parentEntry = leaf.closest(".nav-entry");
    const parentLevelOne = parentEntry && $(".nav-level-1", parentEntry);

    if (parentLevelTwo && parentLevelTwo !== leaf) {
      parentLevelTwo.classList.add("has-active-child");
      setExpanded(parentLevelTwo, true);
    } else {
      closeThirdLevelMenus();
    }
    if (parentLevelOne && parentLevelOne !== leaf) {
      parentLevelOne.classList.add("has-active-child");
      setExpanded(parentLevelOne, true);
    } else if (leaf.classList.contains("nav-level-1")) {
      closeFirstLevelMenus();
    }

    if (leaf.id === "contextBusinessNav") {
      closeContextualPanel();
      showMainPage("contextBusinessPage");
    }
  };

  $$(".nav-level-1[data-nav-toggle]", sidebarMenu).forEach(trigger => {
    trigger.addEventListener("click", event => {
      event.stopPropagation();
      const shouldOpen = !trigger.classList.contains("is-open");
      closeFirstLevelMenus(trigger);
      setExpanded(trigger, shouldOpen);
    });
  });

  $$(".nav-level-2[data-nav-toggle]", sidebarMenu).forEach(trigger => {
    trigger.addEventListener("click", event => {
      event.stopPropagation();
      const shouldOpen = !trigger.classList.contains("is-open");
      closeThirdLevelMenus(trigger);
      setExpanded(trigger, shouldOpen);
    });
  });

  $$(".nav-level-1:not([data-nav-toggle]), .nav-level-2:not([data-nav-toggle]), .nav-level-3", sidebarMenu).forEach(leaf => {
    leaf.addEventListener("click", event => {
      event.stopPropagation();
      activateLeaf(leaf);
    });
  });

  document.addEventListener("click", event => {
    if (!sidebarMenu.contains(event.target)) closeThirdLevelMenus();
  });
}

function showMainPage(pageId) {
  const isBusinessPage = pageId === "contextBusinessPage";
  const isAiPage = pageId === "fullAssistantPage" || pageId === "diagnosisPage";
  const panel = $("#contextualAiPanel");
  const widget = $("#assistantWidget");
  document.body.classList.toggle("business-mode", isBusinessPage);
  document.body.classList.toggle("ai-mode", isAiPage);
  $$(".business-page, .diagnosis-page, .full-assistant-page").forEach(page => {
    page.classList.toggle("active", page.id === pageId);
  });
  $("#partyManagementNav").classList.toggle("active", isBusinessPage);
  $("#assistantNav").classList.toggle("active", !isBusinessPage);
  $("#contextBusinessNav").classList.toggle("active", isBusinessPage);
  if (!isBusinessPage) {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    $("#contextBusinessPage").classList.remove("context-panel-open");
    $("#launcherPopover").classList.remove("open");
    widget.classList.add("is-hidden");
  } else if (!panel.classList.contains("open")) {
    widget.classList.remove("is-hidden");
  }
  window.location.hash = pageId;
}

const diagnosisTasks = {
  monthly: { title: "7 月主题党日诊断", business: "主题党日", time: "2026 年 7 月", organization: "招商银行党委及下属组织", status: "待执行", mode: "initial" },
  development: { title: "党员发展材料核验", business: "党员发展", time: "近 30 天", organization: "总行营业部党委", status: "待执行", mode: "initial" },
  recheck: { title: "组织生活会整改回检", business: "组织生活会", time: "2026 年第 2 季度", organization: "上海分行党委及下属组织", status: "已完成", mode: "recheck" },
  meeting: { title: "二季度三会一课诊断", business: "三会一课", time: "2026 年第 2 季度", organization: "南京分行党委及下属组织", status: "已完成", mode: "initial" }
};

const diagnosisIssueTemplates = {
  "主题党日": [
    { ruleId: "TD-001", category: "活动记录", risk: "中", description: "活动记录中的主题与审批单主题不一致", evidence: "活动记录：'金融为民'；审批单：'深入贯彻中央八项规定精神学习教育'", impact: "影响主题党日台账的真实性和后续检查追溯", handling: "需整改", advice: "核实实际活动主题后补充更正说明，并重新归档活动记录", rectifier: "党支部组织委员" },
    { ruleId: "TD-007", category: "材料规范", risk: "低", description: "学习签到表缺少主持人签字", evidence: "已获取签到表，主持人确认栏为空", impact: "材料留存要素不完整", handling: "无需整改", advice: "后续活动使用已配置的签到模板，归档前完成要素校验", rectifier: "党支部宣传委员" }
  ],
  "党员发展": [
    { ruleId: "DY-014", category: "流程衔接", risk: "高", description: "发展对象备案日期早于支委会讨论日期", evidence: "备案表日期：2026-06-08；支委会记录日期：2026-06-12", impact: "流程节点时间关系异常，需要人工核实", handling: "需整改", advice: "核验原始会议记录和备案材料，确认后修正台账说明", rectifier: "党支部组织委员" },
    { ruleId: "DY-021", category: "材料规范", risk: "中", description: "政审材料引用的证明编号未在归档目录中登记", evidence: "政审综合材料含证明编号 GHB-2026-071，但目录未录入", impact: "影响材料目录和原件的一致性", handling: "需整改", advice: "补录归档目录并复核附件编号", rectifier: "党支部档案管理员" }
  ],
  "三会一课": [
    { ruleId: "SH-003", category: "会议记录", risk: "中", description: "支部党员大会的议题与纪要决议项关联不完整", evidence: "会议议题 3 项，纪要仅记录 2 项对应决议", impact: "会议决策过程追溯不足", handling: "需整改", advice: "补充缺失议题的讨论和决议记录，经确认后归档", rectifier: "党支部书记" }
  ],
  "组织生活会": [
    { ruleId: "ZZ-012", category: "整改闭环", risk: "中", description: "整改台账中的一项措施未关联复核依据", evidence: "整改事项 ZZ-2026-18 状态为已完成，未上传复核记录", impact: "整改完成状态缺少可核验依据", handling: "需整改", advice: "补充复核纪要或相关业务凭证后提交回检", rectifier: "党支部组织委员" }
  ]
};

function renderDiagnosisReport({ isExecuted = false } = {}) {
  const diagnosis = state.diagnosis;
  const task = diagnosisTasks[diagnosis.activeTask];
  const isRecheck = task?.mode === "recheck";
  const issues = isExecuted ? (diagnosisIssueTemplates[diagnosis.business] || []) : [];
  const handled = issues.filter(issue => issue.handling === "需整改").length;
  const reportTitle = `${diagnosis.title || `${diagnosis.time}${diagnosis.business}`}诊断报告`;

  $("#diagnosisTitle").textContent = diagnosis.title || `${diagnosis.time}${diagnosis.business}诊断`;
  $("#diagnosisReportTitle").textContent = reportTitle;
  $("#diagnosisReportMeta").textContent = isExecuted ? `报告更新时间：${new Date().toLocaleString("zh-CN", { hour12: false }).replace(/\//g, "-")}` : "报告更新时间：等待执行诊断";
  $("#reportBusiness").textContent = diagnosis.business;
  $("#reportTime").textContent = diagnosis.time;
  $("#reportOrganization").textContent = diagnosis.organization;
  $("#reportStatus").textContent = isExecuted ? "已完成" : diagnosis.status;
  $("#diagnosisStatus").classList.toggle("is-complete", isExecuted || diagnosis.status === "已完成");
  $("#diagnosisStatus").innerHTML = `<i data-lucide="${isExecuted || diagnosis.status === "已完成" ? "circle-check" : "clock-3"}"></i>${isExecuted || diagnosis.status === "已完成" ? "已完成" : "待执行"}`;

  $("#diagnosisReportMetrics").innerHTML = [
    [isExecuted ? "12" : "--", "检查对象"],
    [isExecuted ? String(issues.length) : "--", "发现问题"],
    [isExecuted ? String(handled) : "--", "需整改"],
    [isExecuted ? String(issues.length - handled) : "--", "无需整改"]
  ].map(([value, label]) => `<div><b>${value}</b><span>${label}</span></div>`).join("");

  $("#diagnosisIssueList").innerHTML = isExecuted ? issues.map((issue, index) => `
    <article class="diagnosis-issue-card" data-issue-id="${issue.ruleId}">
      <div class="diagnosis-issue-row"><div class="diagnosis-issue-heading"><span class="diagnosis-issue-title"><strong>${index + 1}. ${escapeHtml(issue.description)}</strong><span class="diagnosis-issue-tag${issue.handling === "无需整改" ? " complete" : ""}">${issue.handling}</span></span>${issue.handling === "需整改" ? `<button class="diagnosis-issue-action" type="button" data-diagnosis-action="notify" data-issue-id="${issue.ruleId}"><i data-lucide="bell-ring"></i>通知整改</button>` : ""}</div><p class="diagnosis-issue-meta"><span>${diagnosis.business} · ${issue.ruleId} · ${issue.category} · ${issue.risk}风险</span></p></div>
      <p class="diagnosis-issue-evidence">证据：${escapeHtml(issue.evidence)}</p>
      <p class="diagnosis-issue-advice"><b>影响：</b>${escapeHtml(issue.impact)}<br /><b>处理要求：</b>${issue.handling}；<b>涉及业务/台账：</b>${diagnosis.business}台账；<b>整改人：</b>${issue.rectifier}<br /><b>建议：</b>${issue.advice}</p>
    </article>`).join("") : `<div class="diagnosis-empty-report"><i data-lucide="file-search"></i><span>设置诊断范围后点击“开始诊断”，报告将在此展示问题、证据和处理要求。</span></div>`;

  $("#diagnosisSummary").innerHTML = isExecuted
    ? `本次对<strong>${escapeHtml(diagnosis.organization)}</strong>在<strong>${escapeHtml(diagnosis.time)}</strong>的<strong>${escapeHtml(diagnosis.business)}</strong>业务进行诊断，共检查 <strong>12</strong> 个对象，发现 <strong>${issues.length}</strong> 项问题。其中 <strong>${handled} 项需整改</strong>，<strong>${issues.length - handled} 项无需整改</strong>。请依据问题证据和处理建议开展后续核验。`
    : "当前尚未生成诊断结论。";
  $("#diagnosisRecheckSection").classList.toggle("is-hidden", !isRecheck || !isExecuted);
  $("#diagnosisRecheckContent").innerHTML = isRecheck && isExecuted ? `<div class="diagnosis-recheck-note">本次回检与上次报告中的整改事项进行稳定 ID 对比：已完成 3 项，仍需跟进 1 项。差异结果仅反映已获得的整改证据和流程状态。</div>` : "";
  refreshIcons();
  $$("[data-diagnosis-action='notify']").forEach(button => button.addEventListener("click", () => openRectificationDialog(button.dataset.issueId)));
}

function openRectificationDialog(issueId) {
  const issue = (diagnosisIssueTemplates[state.diagnosis.business] || []).find(item => item.ruleId === issueId);
  if (!issue) return;
  state.diagnosis.currentIssue = issue;
  $("#rectificationIssueSummary").textContent = `${issue.ruleId}：${issue.description}`;
  $("#rectifierSelect").value = issue.rectifier;
  $("#rectificationDays").value = "7";
  $("#rectificationNote").value = issue.advice;
  $("#rectificationDialog").classList.add("open");
  $("#rectificationDialog").setAttribute("aria-hidden", "false");
  $("#rectifierSelect").focus();
}

function closeRectificationDialog() {
  $("#rectificationDialog").classList.remove("open");
  $("#rectificationDialog").setAttribute("aria-hidden", "true");
}

function submitRectificationNotice() {
  const issue = state.diagnosis.currentIssue;
  if (!issue) return;
  const taskId = `recheck-generated-${issue.ruleId}`;
  if (!diagnosisTasks[taskId]) {
    diagnosisTasks[taskId] = { title: `${state.diagnosis.business}整改回检`, business: state.diagnosis.business, time: state.diagnosis.time, organization: state.diagnosis.organization, status: "待回检", mode: "recheck", generated: true, issueId: issue.ruleId };
    const taskButton = document.createElement("button");
    taskButton.className = "diagnosis-task generated-recheck-task";
    taskButton.dataset.diagnosisTask = taskId;
    taskButton.type = "button";
    taskButton.innerHTML = `<span class="diagnosis-task-icon"><i data-lucide="clock-3"></i></span><span><strong>${state.diagnosis.business}整改回检</strong><small>关联 ${issue.ruleId} · 待回检</small></span><i data-lucide="chevron-right"></i>`;
    $(".diagnosis-task-group").lastElementChild?.appendChild(taskButton);
    taskButton.addEventListener("click", () => {
      state.diagnosis = { ...state.diagnosis, activeTask: taskId, ...diagnosisTasks[taskId] };
      $("#diagnosisBusiness").value = state.diagnosis.business;
      $("#diagnosisTime").value = state.diagnosis.time;
      $("#diagnosisOrganization").value = state.diagnosis.organization;
      $$(".diagnosis-task").forEach(button => button.classList.toggle("active", button === taskButton));
      renderDiagnosisReport({ isExecuted: true });
    });
  }
  state.diagnosis.rectificationSent = true;
  closeRectificationDialog();
  showToast(`已发送整改通知，已生成${issue.ruleId}回检任务`);
  renderDiagnosisReport({ isExecuted: true });
}

function runDiagnosis() {
  const diagnosis = state.diagnosis;
  diagnosis.business = $("#diagnosisBusiness").value;
  diagnosis.time = $("#diagnosisTime").value;
  diagnosis.organization = $("#diagnosisOrganization").value;
  diagnosis.title = `${diagnosis.time}${diagnosis.business}诊断`;
  diagnosis.status = "已完成";
  renderDiagnosisReport({ isExecuted: true });
  showToast("诊断已完成，报告已按当前范围更新");
}

function setupDiagnosisWorkspace() {
  const applyTask = taskId => {
    const task = diagnosisTasks[taskId];
    if (!task) return;
    state.diagnosis = { ...state.diagnosis, activeTask: taskId, ...task };
    $("#diagnosisBusiness").value = task.business;
    $("#diagnosisTime").value = task.time;
    $("#diagnosisOrganization").value = task.organization;
    $$(".diagnosis-task").forEach(button => button.classList.toggle("active", button.dataset.diagnosisTask === taskId));
    renderDiagnosisReport({ isExecuted: task.status === "已完成" });
  };

  $$(".diagnosis-task").forEach(button => button.addEventListener("click", () => applyTask(button.dataset.diagnosisTask)));
  $("#diagnosisScopeForm").addEventListener("submit", event => { event.preventDefault(); runDiagnosis(); });
  $("#resetDiagnosis").addEventListener("click", () => applyTask(state.diagnosis.activeTask));
  $("#newDiagnosisTask").addEventListener("click", () => {
    state.diagnosis = { ...state.diagnosis, activeTask: "", title: "新建诊断", business: "主题党日", time: "2026 年 7 月", organization: "招商银行党委及下属组织", status: "待执行" };
    $("#diagnosisBusiness").value = state.diagnosis.business;
    $("#diagnosisTime").value = state.diagnosis.time;
    $("#diagnosisOrganization").value = state.diagnosis.organization;
    $$(".diagnosis-task").forEach(button => button.classList.remove("active"));
    renderDiagnosisReport();
    showToast("已创建新诊断，请设置范围后开始诊断");
  });
  $("#refreshDiagnosisTasks").addEventListener("click", () => showToast("诊断任务列表已刷新"));
  $("#previewDiagnosisReport").addEventListener("click", () => showToast("报告预览将在后续版本开放"));
  $("#downloadDiagnosisReport").addEventListener("click", () => showToast("报告下载已准备"));
  $("#startRecheck").addEventListener("click", () => showToast("已根据当前报告准备回检任务"));
  $("#rectificationForm").addEventListener("submit", event => { event.preventDefault(); submitRectificationNotice(); });
  $("#closeRectificationDialog").addEventListener("click", closeRectificationDialog);
  $("#cancelRectification").addEventListener("click", closeRectificationDialog);
  $("#rectificationDialog").addEventListener("click", event => { if (event.target === event.currentTarget) closeRectificationDialog(); });
  renderDiagnosisReport();
}

function openContextualPanel() {
  const panel = $("#contextualAiPanel");
  $("#assistantWidget").classList.add("is-hidden");
  $("#contextBusinessPage").classList.add("context-panel-open");
  $("#launcherPopover").classList.remove("open");
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  $("#floatingLauncher").setAttribute("aria-expanded", "true");
  setTimeout(() => $("#contextQuestionInput").focus(), 180);
}

function closeContextualPanel() {
  const panel = $("#contextualAiPanel");
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  $("#assistantWidget").classList.remove("is-hidden");
  $("#contextBusinessPage").classList.remove("context-panel-open");
  $("#floatingLauncher").setAttribute("aria-expanded", "false");
}

function renderContextAnswer(question) {
  const feed = $("#contextChatFeed");
  const user = document.createElement("div");
  user.className = "context-message user";
  user.innerHTML = `<div><span class="context-message-name">我</span><p></p></div>`;
  $("p", user).textContent = question;

  const answer = document.createElement("div");
  answer.className = "context-message assistant";
  answer.innerHTML = `<span class="context-message-avatar"><img src="./assets/assistant.png" alt="" /></span><div><span class="context-message-name">党建小助手</span><p></p></div>`;
  const content = question.includes("未办结")
    ? "未办结记录需要先确认介绍信信息、转入党组织和人员身份是否一致；信息无误后可执行催转，待对方完成确认后再检查档案。"
    : question.includes("流程")
      ? "组织关系转入通常依次完成：接收介绍信、向原党组织返还回执、检查党员档案、确认办结并归档。"
      : "接收介绍信时建议核对党员姓名、身份证明、原党组织、转入党组织、有效期限和介绍信编号；信息一致后再执行转入新增。";
  $("p", answer).textContent = content;
  feed.append(user, answer);
  feed.scrollTop = feed.scrollHeight;
}

function selectValue(type, value, menu) {
  state.selected[type] = value;
  $(`#${type}Value`).textContent = value;
  menu.classList.remove("open");
  const trigger = $(`[data-select="${type}"]`);
  if (trigger) trigger.classList.remove("open");
}

function addUserMessage(text) {
  const container = $("#chatScroll");
  const message = document.createElement("div");
  message.className = "message user-message generated-message";
  message.innerHTML = `<div class="message-meta">我 · 刚刚</div><div class="user-bubble"></div>`;
  $(".user-bubble", message).textContent = text;
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

function addAssistantReply(text) {
  const container = $("#chatScroll");
  const message = document.createElement("div");
  message.className = "message assistant-message generated-message";
  message.innerHTML = `<div class="message-meta assistant-meta"><span class="small-avatar"><img src="./assets/assistant.png" alt="" /></span>党建小助手 · 刚刚</div><div class="assistant-bubble"><p></p></div>`;
  $(".assistant-bubble p", message).textContent = text;
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;
}

function renderMaterialDraft(values) {
  const container = $("#chatScroll");
  const message = document.createElement("div");
  message.className = "draft-card generated-message";
  message.innerHTML = `
    <div class="result-header">
      <strong>${escapeHtml(values.theme)}活动总结（初稿）</strong>
      <span class="draft-label"><i data-lucide="file-check-2"></i>AI 初稿</span>
    </div>
    <div class="draft-facts">
      <span>组织：${escapeHtml(values.org)}</span>
      <span>日期：${escapeHtml(values.date)}</span>
      <span>地点：${escapeHtml(values.location)}</span>
      <span>参与人数：${escapeHtml(values.participants)} 人</span>
    </div>
    <p class="draft-preview">${escapeHtml(values.date)}，${escapeHtml(values.org)}在${escapeHtml(values.location)}开展“${escapeHtml(values.theme)}”主题党日活动，共 ${escapeHtml(values.participants)} 人参加。活动围绕${escapeHtml(values.content)}有序开展，进一步强化了党员的责任意识和组织观念。后续将结合活动记录、签到和影像资料完善归档内容。</p>
    <div class="draft-note"><i data-lucide="circle-alert"></i>内容仅基于已填写信息生成，提交或归档前请人工核对。</div>`;
  container.appendChild(message);
  refreshIcons();
  container.scrollTop = container.scrollHeight;
  showToast("活动总结初稿已生成");
}

function renderGenerationForm() {
  const container = $("#chatScroll");
  const message = document.createElement("div");
  message.className = "message assistant-message generated-message";
  message.innerHTML = `
    <div class="message-meta assistant-meta"><span class="small-avatar"><img src="./assets/assistant.png" alt="" /></span>党建小助手 · 刚刚</div>
    <div class="assistant-bubble">
      <p>可以生成活动总结初稿。请先补充以下事实信息，未确认的内容不会自动编造。</p>
      <form class="constraint-form generation-form">
        <div class="form-title"><span>补充材料要素</span><span class="required-note">* 为必填项</span></div>
        <div class="two-fields">
          <div>
            <label class="field-label" for="draftOrg">所属党组织 <span>*</span></label>
            <input class="text-field" id="draftOrg" name="org" value="${escapeHtml(state.selected.org)}" required />
          </div>
          <div>
            <label class="field-label" for="draftTheme">活动主题 <span>*</span></label>
            <input class="text-field" id="draftTheme" name="theme" placeholder="如：七月主题党日学习研讨" required />
          </div>
          <div>
            <label class="field-label" for="draftDate">活动日期 <span>*</span></label>
            <input class="text-field" id="draftDate" name="date" type="date" required />
          </div>
          <div>
            <label class="field-label" for="draftLocation">活动地点 <span>*</span></label>
            <input class="text-field" id="draftLocation" name="location" placeholder="如：党员活动室" required />
          </div>
          <div>
            <label class="field-label" for="draftParticipants">参与人数 <span>*</span></label>
            <input class="text-field" id="draftParticipants" name="participants" type="number" min="1" placeholder="如：18" required />
          </div>
        </div>
        <label class="field-label" for="draftContent">主要内容 <span>*</span></label>
        <textarea class="text-field" id="draftContent" name="content" placeholder="填写学习主题、讨论内容和主要活动安排" required></textarea>
        <div class="form-actions">
          <button type="button" class="ghost-button cancel-generation">取消</button>
          <button type="submit" class="primary-button"><i data-lucide="wand-sparkles"></i>生成初稿</button>
        </div>
      </form>
    </div>`;
  container.appendChild(message);

  const form = $(".generation-form", message);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    renderMaterialDraft(values);
    $("button[type=submit]", form).disabled = true;
  });
  $(".cancel-generation", form).addEventListener("click", () => {
    message.remove();
    showToast("已取消生成材料初稿");
  });

  refreshIcons();
  container.scrollTop = container.scrollHeight;
}

function setupQueryResultFeedback(message) {
  if (!message) return;

  const detail = $(".feedback-detail", message);
  const actionButtons = $$(".feedback-action", message);
  const reasonButtons = $$(".feedback-reason", detail);
  const setActionState = action => {
    actionButtons.forEach(button => {
      const isSelected = button.dataset.feedbackAction === action;
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
  };
  const closeDetail = () => {
    detail.hidden = true;
    message.classList.remove("feedback-open");
    $(".feedback-action[data-feedback-action=down]", message)?.setAttribute("aria-expanded", "false");
  };

  actionButtons.forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.feedbackAction === "up") {
        saveAssistantFeedback({ type: "positive", ...getQueryResultContext() });
        setActionState("up");
        closeDetail();
        showToast("感谢反馈，将用于优化回答");
        return;
      }

      detail.hidden = false;
      message.classList.add("feedback-open");
      button.setAttribute("aria-expanded", "true");
    });
  });

  reasonButtons.forEach(button => {
    button.addEventListener("click", () => {
      reasonButtons.forEach(reason => {
        const isSelected = reason === button;
        reason.classList.toggle("selected", isSelected);
        reason.setAttribute("aria-pressed", String(isSelected));
      });
    });
  });

  $(".feedback-close", detail)?.addEventListener("click", closeDetail);
  $(".feedback-form", detail)?.addEventListener("submit", event => {
    event.preventDefault();
    const selectedReason = $(".feedback-reason.selected", detail);
    if (!selectedReason) {
      showToast("请选择反馈原因");
      return;
    }

    saveAssistantFeedback({
      type: "badcase",
      reason: selectedReason.dataset.feedbackReason,
      note: $(".feedback-note", detail).value.trim(),
      ...getQueryResultContext()
    });
    setActionState("down");
    closeDetail();
    showToast("反馈已记录，将沉淀为 badcase");
  });
}

function renderQueryResult() {
  const target = $("#dynamicResult");
  target.innerHTML = `
    <div class="message assistant-message generated-message query-result-message">
      <div class="message-meta assistant-meta"><span class="small-avatar"><img src="./assets/assistant.png" alt="" /></span>党建小助手 · 刚刚</div>
      <div class="result-card">
        <div class="result-header">
          <strong>${state.selected.business}开展情况查询结果</strong>
          <span class="done-label"><i data-lucide="check"></i>已完成</span>
        </div>
        <p>${state.selected.org} · ${state.selected.business} · ${state.selected.time}</p>
        <div class="result-grid">
          <div class="result-metric"><b>12</b><span>活动总数</span></div>
          <div class="result-metric"><b>9</b><span>已完成归档</span></div>
          <div class="result-metric"><b>3</b><span>待补材料</span></div>
        </div>
        <div class="source-line"><i data-lucide="clock-3"></i>数据更新时间：2026-07-25 10:32 · 来源：智慧党建业务系统</div>
      </div>
      <div class="feedback-detail" hidden>
        <form class="feedback-form">
          <div class="feedback-detail-header"><strong>告诉我们哪里需要改进</strong><button type="button" class="feedback-close" title="关闭反馈" aria-label="关闭反馈"><i data-lucide="x"></i></button></div>
          <div class="feedback-reasons">
            <button type="button" class="feedback-reason" data-feedback-reason="结果不准确" aria-pressed="false">结果不准确</button>
            <button type="button" class="feedback-reason" data-feedback-reason="信息不完整" aria-pressed="false">信息不完整</button>
            <button type="button" class="feedback-reason" data-feedback-reason="未解决问题" aria-pressed="false">未解决问题</button>
            <button type="button" class="feedback-reason" data-feedback-reason="其他" aria-pressed="false">其他</button>
          </div>
          <textarea class="feedback-note" rows="2" placeholder="补充说明（可选）"></textarea>
          <button type="submit" class="feedback-submit">提交反馈</button>
        </form>
      </div>
      <div class="result-feedback" aria-label="问答结果反馈">
        <span>这条结果对您有帮助吗？</span>
        <button type="button" class="feedback-action" data-feedback-action="up" title="有帮助" aria-label="有帮助" aria-pressed="false"><i data-lucide="thumbs-up"></i></button>
        <button type="button" class="feedback-action" data-feedback-action="down" title="没帮助" aria-label="没帮助" aria-pressed="false" aria-expanded="false"><i data-lucide="thumbs-down"></i></button>
      </div>
    </div>`;
  setupQueryResultFeedback($(".query-result-message", target));
  refreshIcons();
  showToast("查询完成，结果已返回");
}

function handlePrompt(prompt) {
  const input = $("#messageInput");
  input.value = prompt;
  input.focus();
  if (prompt.includes("查询主题党日开展情况")) {
    $("#chatScroll").scrollTo({ top: $("#queryForm").offsetTop - 30, behavior: "smooth" });
  }
}

function clearChat() {
  $$(".generated-message").forEach(node => node.remove());
  $("#dynamicResult").innerHTML = "";
  $("#messageInput").value = "";
  showToast("当前对话已清空");
}

function showHistoryConversation(item) {
  const question = item.dataset.historyQuestion;
  const answer = item.dataset.historyAnswer;
  $$(".generated-message").forEach(node => node.remove());
  $("#dynamicResult").innerHTML = "";
  addUserMessage(question);
  addAssistantReply(answer);
  showToast("已打开历史对话");
}

function submitMessage() {
  const input = $("#messageInput");
  const text = input.value.trim();
  if (!text) {
    showToast("请输入问题后再发送");
    input.focus();
    return;
  }
  addUserMessage(text);
  input.value = "";
  if (text.includes("查询") || text.includes("开展情况")) {
    addAssistantReply("这个问题需要组织、业务和时间范围。请在上方查询条件卡中补充信息后确认查询。");
    showToast("已识别为动态查询，请补充条件");
  } else if (text.includes("生成") || text.includes("总结")) {
    renderGenerationForm();
  } else {
    addAssistantReply("我会基于已授权的党建制度与业务资料回答。涉及动态业务数据时，我会先请你补充必要范围。");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  refreshIcons();
  setupTransferOrganizationTree();
  setupSidebarNavigation();
  setupDiagnosisWorkspace();
  showMainPage("contextBusinessPage");

  $("#partyManagementNav").addEventListener("click", event => {
    event.preventDefault();
    closeContextualPanel();
    showMainPage("contextBusinessPage");
  });
  $("#assistantNav").addEventListener("click", event => {
    event.preventDefault();
    showMainPage("fullAssistantPage");
    $("#messageInput").focus();
  });
  $("#transferQueryForm").addEventListener("submit", event => {
    event.preventDefault();
    showToast("已按当前条件查询组织关系转入记录");
  });
  $("#transferAdd").addEventListener("click", () => showToast("已打开组织关系转入新增流程"));

  $$("[data-select]").forEach(trigger => {
    trigger.addEventListener("click", event => {
      event.stopPropagation();
      const type = trigger.dataset.select;
      const menu = $(`[data-menu="${type}"]`);
      const shouldOpen = !menu.classList.contains("open");
      closeMenus();
      if (shouldOpen) {
        menu.classList.add("open");
        trigger.classList.add("open");
      }
    });
  });

  $$(".select-menu button").forEach(option => {
    option.addEventListener("click", event => {
      const menu = event.currentTarget.closest(".select-menu");
      const type = menu.dataset.menu;
      selectValue(type, event.currentTarget.dataset.value, menu);
    });
  });

  document.addEventListener("click", closeMenus);

  $("#queryForm").addEventListener("submit", event => {
    event.preventDefault();
    const submit = $("button[type=submit]", event.currentTarget);
    submit.disabled = true;
    submit.innerHTML = `<i data-lucide="loader-circle"></i>查询中`;
    refreshIcons();
    setTimeout(() => {
      submit.disabled = false;
      submit.innerHTML = `<i data-lucide="search"></i>确认查询`;
      refreshIcons();
      renderQueryResult();
    }, 650);
  });

  $("#cancelQuery").addEventListener("click", () => showToast("已保留当前条件，未执行查询"));
  $("#clearChat").addEventListener("click", clearChat);
  $("#sendMessage").addEventListener("click", submitMessage);
  $("#messageInput").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  });

  $$('[data-prompt]').forEach(button => button.addEventListener("click", () => handlePrompt(button.dataset.prompt)));

  $$(".history-item").forEach(item => item.addEventListener("click", () => showHistoryConversation(item)));

  $("#historySearch").addEventListener("input", event => {
    const keyword = event.target.value.trim().toLowerCase();
    $$(".history-item").forEach(item => {
      item.hidden = keyword && !item.textContent.toLowerCase().includes(keyword);
    });
  });

  $("#refreshTasks").addEventListener("click", event => {
    const icon = $("svg", event.currentTarget);
    icon?.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 450 });
    showToast("任务列表已刷新");
  });

  $("#viewAllTasks").addEventListener("click", () => showToast("智能诊断任务列表将在后续版本开放"));
  $("#diagnosisEntry").addEventListener("click", () => showMainPage("diagnosisPage"));

  const widget = $("#assistantWidget");
  const launcher = $("#floatingLauncher");
  const arrow = $("#floatingExpand");
  const openFromLauncher = event => {
    event.stopPropagation();
    showMainPage("contextBusinessPage");
    openContextualPanel();
  };
  launcher.addEventListener("click", openFromLauncher);
  arrow.addEventListener("click", event => {
    event.stopPropagation();
    toggleAssistantWidget();
  });
  $("#feedbackEntry").addEventListener("click", event => {
    event.stopPropagation();
    showToast("意见信箱将在后续版本开放");
  });
  $("#historyEntry").addEventListener("click", event => {
    event.stopPropagation();
    showToast("历史版本记录将在后续版本开放");
  });
  $("#focusChat").addEventListener("click", () => {
    showMainPage("contextBusinessPage");
    openContextualPanel();
  });
  $("#closeContextualAi").addEventListener("click", closeContextualPanel);
  $("#contextQuestionForm").addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#contextQuestionInput");
    const question = input.value.trim();
    if (!question) return;
    renderContextAnswer(question);
    input.value = "";
  });
  $$("[data-context-prompt]").forEach(button => button.addEventListener("click", () => {
    const input = $("#contextQuestionInput");
    input.value = button.dataset.contextPrompt;
    input.focus();
  }));
  $("#openAssistantPage").addEventListener("click", () => {
    showMainPage("fullAssistantPage");
    $("#messageInput").focus();
  });
  $("#openDiagnosisPage").addEventListener("click", () => showMainPage("diagnosisPage"));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && $("#contextualAiPanel").classList.contains("open")) closeContextualPanel();
  });
});
