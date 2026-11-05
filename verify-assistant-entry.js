const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const llmUi = fs.readFileSync(path.join(__dirname, "llm-ui.js"), "utf8");

const checks = {
  "default route opens the assistant workbench": /const initialPageId = getInitialPageId\(\);[\s\S]*showMainPage\(initialPageId\)/.test(app),
  "explicit deep links are preserved": /function getInitialPageId\(\)[\s\S]*contextBusinessPage[\s\S]*diagnosisPage/.test(app),
  "unknown hashes fall back to the assistant": /function getInitialPageId\(\)[\s\S]*fullAssistantPage/.test(app),
  "startup resets the document scroll position": /window\.scrollTo\(0, 0\)/.test(app),
  "model settings focus does not scroll the workbench away": /fields\.apiKey\.focus\(\{ preventScroll: true \}\)/.test(llmUi)
};

const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
if (failures.length) {
  console.error("Assistant entry verification failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Assistant entry verification passed: " + Object.keys(checks).length + " checks.");
