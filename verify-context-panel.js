const fs = require("fs");
const path = require("path");

const root = __dirname;
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const contextBusinessLeaf = index.match(/<button[^>]*id="contextBusinessNav"[^>]*>([\s\S]*?)<\/button>/)?.[1] || "";
const treeSearch = index.match(/<div class="tree-search">([\s\S]*?)<\/div>/)?.[1] || "";
const directListenerIds = [...app.matchAll(/\$\("#([^"]+)"\)\.addEventListener/g)].map(match => match[1]);
const missingDirectListenerIds = directListenerIds.filter(id => !new RegExp(`id="${id}"`).test(index));

const checks = {
  "direct event bindings target existing elements": missingDirectListenerIds.length === 0,
  "business page is available as the contextual surface": /id="contextBusinessPage"/.test(index),
  "drawer has a close action": /id="closeContextualAi"/.test(index),
  "drawer has a contextual question input": /id="contextQuestionInput"/.test(index),
  "drawer can submit a contextual question": /id="contextQuestionForm"/.test(index),
  "drawer links to full assistant": /id="openAssistantPage"/.test(index),
  "drawer links to intelligent diagnosis": /id="openDiagnosisPage"/.test(index),
  "full assistant page can be opened": /id="fullAssistantPage"/.test(index),
  "intelligent diagnosis page can be opened": /id="diagnosisPage"/.test(index),
  "AI pages hide the platform sidebar": /body\.classList\.toggle\("ai-mode", isAiPage\)/.test(app) && /\.ai-mode \.sidebar \{[^}]*display: none;/.test(css) && /\.ai-mode \.main-content/.test(css),
  "business page remains the only page with the platform sidebar": /body\.business-mode:not\(\.ai-mode\) \.sidebar/.test(css) || /\.ai-mode \.sidebar \{[^}]*display: none;/.test(css),
  "assistant uses one searchable history list": /class="history-heading"/.test(index) && /placeholder="搜索历史对话"/.test(index) && !/id="newSession"/.test(index) && !/session-heading">今天/.test(index) && !/session-heading">7 天内/.test(index),
  "assistant removes session management language": !/当前会话/.test(index) && !/清空会话/.test(index) && !/会话设置/.test(index),
  "history records open in the current question area": /data-history-question=/.test(index) && /data-history-answer=/.test(index) && /function showHistoryConversation\(/.test(app) && !/session-item active/.test(index),
  "diagnosis uses a three-column task workspace": /class="diagnosis-workbench"/.test(index) && /class="diagnosis-task-list"/.test(index) && /class="diagnosis-config-panel"/.test(index) && /class="diagnosis-report-panel"/.test(index),
  "diagnosis scope filters are interactive controls": /id="diagnosisBusiness"/.test(index) && /id="diagnosisTime"/.test(index) && /id="diagnosisOrganization"/.test(index) && /id="resetDiagnosis"/.test(index),
  "diagnosis task selection and execution update the report": /function setupDiagnosisWorkspace\(/.test(app) && /function renderDiagnosisReport\(/.test(app) && /function runDiagnosis\(/.test(app),
  "diagnosis report follows the unified v2 structure": /data-diagnosis-section="basic"/.test(index) && /data-diagnosis-section="statistics"/.test(index) && /data-diagnosis-section="issues"/.test(index) && /data-diagnosis-section="summary"/.test(index) && /data-diagnosis-section="recheck"/.test(index),
  "diagnosis issues render as separate readable rows": /class="diagnosis-issue-card"/.test(app) && /diagnosis-issue-row/.test(css),
  "diagnosis issue records use one vertical column": /\.diagnosis-issue-card \{[^}]*display: block;/.test(css) && /\.diagnosis-issue-list/.test(css),
  "diagnosis report area supports independent scrolling": /\.diagnosis-report-panel \{[^}]*min-height: 0;/.test(css) && /\.diagnosis-report-scroll \{[^}]*overflow-y: auto;/.test(css),
  "diagnosis issue status follows the title": /diagnosis-issue-title/.test(app) && /diagnosis-issue-tag/.test(app) && /diagnosis-issue-action/.test(app),
  "notification button matches common action sizing": /\.diagnosis-issue-action svg[^}]*width: 16px;[^}]*height: 16px;/.test(css) && /\.diagnosis-issue-action[^}]*font-size: 14px;/.test(css),
  "diagnosis report has a fixed bottom action bar": /class="diagnosis-report-footer"/.test(index) && /id="downloadDiagnosisReport"/.test(index) && /id="startRecheck"/.test(index) && /\.diagnosis-report-footer \{[^}]*flex: 0 0 auto;/.test(css),
  "diagnosis report footer actions are wired": /#downloadDiagnosisReport/.test(app) && /#startRecheck/.test(app),
  "整改 issues expose notification action": /data-diagnosis-action="notify"/.test(app) && /function openRectificationDialog\(/.test(app),
  "rectification dialog captures owner deadline and note": /id="rectificationDialog"/.test(index) && /id="rectifierSelect"/.test(index) && /id="rectificationDays"/.test(index) && /id="rectificationNote"/.test(index),
  "notification creates a recheck task marker": /function submitRectificationNotice\(/.test(app) && /recheck-generated-\$\{issue\.ruleId\}/.test(app) && /generated-recheck-task/.test(app) && /待回检/.test(app),
  "diagnosis summary emphasizes key data": /diagnosis-summary strong/.test(css) && /<strong>12<\/strong>/.test(app) && /<strong>\$\{handled\} 项需整改<\/strong>/.test(app),
  "diagnosis workspace uses a stable three-column grid": /\.diagnosis-workbench \{[^}]*grid-template-columns: 228px minmax\(300px, 0\.9fr\) minmax\(420px, 1\.35fr\);/.test(css),
  "composer explains that answers are for reference": /回答将基于已授权资料和业务数据，内容仅供参考，请以实际业务规则和系统数据为准/.test(index),
  "query results render as assistant messages": /<div class="message assistant-message generated-message query-result-message">\s*<div class="message-meta assistant-meta">[\s\S]*?党建小助手 · 刚刚[\s\S]*?<div class="result-card">/.test(app),
  "query result cards align with assistant bubbles": /\.result-card \{[^}]*width: min\(100%, 630px\);[^}]*margin: 0;/.test(css),
  "query results expose hover feedback actions": /class="result-feedback"[\s\S]*data-feedback-action="up"[\s\S]*data-feedback-action="down"/.test(app),
  "negative feedback captures badcase reasons and details": /data-feedback-reason="结果不准确"/.test(app) && /data-feedback-reason="信息不完整"/.test(app) && /class="feedback-note"/.test(app) && /class="feedback-submit"/.test(app),
  "assistant feedback persists the query context": /function saveAssistantFeedback\(/.test(app) && /localStorage\.setItem\("partyAssistantFeedback"/.test(app) && /resultSummary/.test(app),
  "query feedback controls appear on result hover": /\.query-result-message:hover \.result-feedback/.test(css) && /\.query-result-message\.feedback-open \.result-feedback/.test(css),
  "negative feedback detail overlays without expanding the conversation": /\.feedback-detail \{[^}]*position: absolute;[^}]*z-index: 3;/.test(css) && !/\.query-result-message\.feedback-open \{[^}]*padding-bottom: 178px;/.test(css),
  "drawer has open styling": /\.contextual-ai-panel\.open/.test(css),
  "business page makes room for the drawer": /\.business-page\.context-panel-open/.test(css),
  "launcher opens contextual panel": /function openContextualPanel\(/.test(app),
  "launcher restores when panel closes": /function closeContextualPanel\(/.test(app),
  "context question receives an answer": /function renderContextAnswer\(/.test(app),
  "page routing supports the two destination pages": /function showMainPage\(/.test(app),
  "launcher outer width is compact 80px": /\.assistant-widget[^}]*width: 80px;[^}]*padding: 8px 3px;/.test(css),
  "launcher reserves a shoulder-height assistant portrait area": /\.floating-avatar[^}]*height: 116px;/.test(css),
  "portrait region fits the compact launcher": /\.floating-launcher[^}]*width: 72px;[^}]*height: 116px;/.test(css) && /\.floating-avatar[^}]*width: 72px;/.test(css),
  "launcher labels use 14px text": /\.floating-tool[^}]*font-size: 14px;/.test(css),
  "launcher tool icons use 24px dimensions": /\.floating-tool svg[^}]*width: 24px;[^}]*height: 24px;/.test(css),
  "launcher portrait clips hair and shoulders inside its frame": /\.floating-avatar[^}]*overflow: hidden;[^}]*border-radius:/.test(css),
  "launcher portrait has an elliptical bottom silhouette": /\.floating-avatar[^}]*clip-path: ellipse\(/.test(css) && !/\.floating-avatar::after/.test(css),
  "assistant portrait is centered with a smaller image scale": /\.floating-avatar img[^}]*left: 51%;[^}]*width: 64px;/.test(css),
  "all conversational assistant avatars use the same 24px portrait frame": /\.welcome-avatar, \.small-avatar, \.context-avatar, \.context-message-avatar \{[^}]*width: 24px;[^}]*height: 24px;[^}]*overflow: hidden;[^}]*border-radius: 50%;/.test(css),
  "all conversational assistant avatars use the same centered head-to-shoulders crop": /\.welcome-avatar img, \.small-avatar img, \.context-avatar img, \.context-message-avatar img \{[^}]*top: 0;[^}]*left: 50%;[^}]*width: 24px;[^}]*transform: translateX\(-50%\);/.test(css),
  "launcher popover points to the assistant portrait": /\.launcher-popover \{[^}]*top: 66px;[^}]*right: 89px;/.test(css),
  "launcher popover only follows the assistant portrait and its bridge": /\.floating-launcher:hover ~ \.launcher-popover/.test(css) && /\.launcher-popover:hover/.test(css) && /\.launcher-popover::before/.test(css) && !/\.assistant-widget:hover \.launcher-popover/.test(css),
  "launcher arrow provides both directional states": /data-lucide="chevrons-right"/.test(index) && /data-lucide="chevrons-left"/.test(index),
  "launcher arrow collapses the complete widget": /function toggleAssistantWidget\(/.test(app) && /\.assistant-widget\.is-collapsed/.test(css),
  "collapsed launcher is 48px, flush right, and square on the screen edge": /\.assistant-widget\.is-collapsed \{[^}]*width: 48px;[^}]*right: 0;[^}]*border-radius: 24px 0 0 24px;/.test(css),
  "collapsed launcher arrow fills the 48px compact state": /\.assistant-widget\.is-collapsed \.floating-arrow \{[^}]*width: 48px;/.test(css),
  "launcher dividers use a lighter 32px rule": /\.floating-divider \{[^}]*width: 32px;[^}]*background: #eef0f3;/.test(css),
  "business page has system tabs like the reference": /class="system-tabs"/.test(index),
  "business page has the organization transfer layout": /class="transfer-layout"/.test(index),
  "business page has the organization tree": /class="transfer-tree"/.test(index),
  "organization tree has a dedicated hierarchy container": /id="transferOrgTree"/.test(index),
  "organization tree models all four hierarchy levels": ["1", "2", "3", "4"].every(level => index.includes(`data-tree-level="${level}"`)),
  "organization tree begins at the root committee": /招商银行根党委/.test(index),
  "organization tree supports selection and branch expansion": /function setupTransferOrganizationTree\(/.test(app) && /tree-children\.is-collapsed/.test(css),
  "organization search combines the field and search action": /<input placeholder="请输入党组织名称"\s*\/><button title="搜索" aria-label="搜索"><i data-lucide="search"><\/i><\/button>/.test(treeSearch),
  "organization search removes the extra view action": !/title="组织视图"/.test(treeSearch) && !/data-lucide="list-tree"/.test(treeSearch),
  "organization search has no detached secondary control styling": !/\.tree-search button:last-child/.test(css),
  "organization tree content aligns with the search field": /\.tree-scroll \{[^}]*padding-right: 0;/.test(css),
  "organization tree selection uses pale red with red text": /\.tree-item\.is-selected > \.tree-row \{[^}]*color: #d83a2d;[^}]*background: #fff0ee;/.test(css),
  "organization tree hover and press states use grey surfaces": /\.tree-row:hover \{[^}]*background: #f3f5f7;/.test(css) && /\.tree-row:active \{[^}]*background: #e1e5e9;/.test(css),
  "business page has the status segments": /class="transfer-stage-tabs"/.test(index),
  "business page has the transfer filter form": /id="transferQueryForm"/.test(index),
  "employee number filter is 320px and generation time filter is 400px": /\.transfer-filter-form > label:first-child > div \{[^}]*width: 320px;[^}]*flex: 0 0 320px;/.test(css) && /\.transfer-filter-form > label:nth-child\(2\) > div \{[^}]*width: 400px;[^}]*flex: 0 0 400px;/.test(css),
  "business page has the transfer record table": /class="transfer-table"/.test(index),
  "transfer table checkboxes preserve the original selected red": /\.transfer-table input\[type="checkbox"\] \{[^}]*border: 1px solid #d9dde3;[^}]*background-color: #fff;/.test(css) && /\.transfer-table input\[type="checkbox"\]:checked \{[^}]*background-color: #e83221;/.test(css),
  "transfer table unchecked checkbox borders use light grey": /\.transfer-table input\[type="checkbox"\] \{[^}]*border: 1px solid #d9dde3;/.test(css),
  "context drawer uses the transfer-page scope": /正在协助：组织关系转入/.test(index),
  "business page has a breadcrumb trail": /class="business-breadcrumb"/.test(index),
  "system tab strip has a bottom rule": /\.system-tabs \{[^}]*border-bottom: 1px solid #e2e5e9;/.test(css),
  "business content uses 8px page padding": /body\.business-mode \.content-inner \{[^}]*padding: 8px;/.test(css),
  "breadcrumb items use 4px spacing": /\.business-breadcrumb \{[^}]*gap: 4px;/.test(css),
  "breadcrumb leaves 8px before the business panel": /\.business-breadcrumb \{[^}]*margin-bottom: 8px;/.test(css),
  "first four statuses stay connected while settled is separated": /\.transfer-stage-tabs \{[^}]*gap: 0;[^}]*border: 0;/.test(css) && /\.transfer-stage-tabs button\.settled \{[^}]*margin-left: 18px;/.test(css),
  "selected status has a red corner marker": /\.transfer-stage-tabs button\.active::after/.test(css),
  "selected status corner uses a check icon": /接收介绍信<\/span><b>24<\/b><i data-lucide="check"/.test(index),
  "sidebar retains the full business menu": (index.match(/class="nav-level-1/g) || []).length >= 6,
  "sidebar has second-level dropdowns": /class="nav-level-2-menu"/.test(index),
  "sidebar has third-level flyout menus": /class="nav-level-3-menu"/.test(index),
  "sidebar first-level defaults have no fill": /\.nav-level-1 \{[^}]*background: transparent;/.test(css),
  "sidebar second-level menus have no left connector line": !/\.nav-level-2-menu \{[^}]*border-left:/.test(css),
  "sidebar leaf selection uses red fill": /\.nav-level-1\.active:not\(\.has-children\)/.test(css),
  "sidebar supports menu interaction": /function setupSidebarNavigation\(/.test(app),
  "sidebar leaf menus do not show a right chevron": !/side-chevron/.test(contextBusinessLeaf),
  "party management uses the same first-level menu markup": /<button class="nav-level-1" id="sidebarPartyManagementNav"/.test(index),
  "sidebar party management entry is named party affairs home": /id="sidebarPartyManagementNav"[^>]*><i data-lucide="network"><\/i><span>党务首页<\/span>/.test(index),
  "party management is not a separate collapsible module header": !/sidebar-module/.test(index) && !/setupSidebarModuleToggle/.test(app),
  "party management first-level menu retains its icon": /id="sidebarPartyManagementNav"[^>]*><i data-lucide="network"/.test(index),
  "sidebar includes the group feature framework": ["党组织架构", "党费支出", "系统配置", "资讯管理"].every(label => index.includes(label)),
};

const failures = Object.entries(checks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

if (failures.length) {
  console.error(`Contextual panel verification failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`Contextual panel verification passed: ${Object.keys(checks).length} checks.`);
