/**
 * Kiểm thử logic thuần của extension/lib/crawl-state.js trong Node.
 * Giả lập chrome.storage.local + URL/location để chạy được ngoài trình duyệt.
 * Chạy: node scripts/test-crawl-state.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = fs.readFileSync(path.join(ROOT, "extension", "lib", "crawl-state.js"), "utf8");

// --- giả lập môi trường trình duyệt ---
const store = {};
const chrome = {
  storage: {
    local: {
      get: (keys, cb) => cb(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((k) => [k, store[k]]))),
      set: (obj, cb) => {
        Object.assign(store, obj);
        cb && cb();
      },
    },
    onChanged: { addListener: () => {} },
  },
  runtime: { lastError: null, sendMessage: (_m, cb) => cb && cb({ success: true }) },
};

const ctx = vm.createContext({
  chrome,
  URL,
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  Promise,
  setTimeout,
  clearTimeout,
  location: { href: "https://www.linkedin.com/jobs/search/?keywords=Business%20Analyst&location=Vietnam" },
});
vm.runInContext(SRC, ctx);

let pass = 0,
  fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? "[OK] " : "[LOI]"} ${label.padEnd(58)} ${ok ? "" : `got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
  ok ? pass++ : fail++;
}
function checkTrue(label, actual) {
  check(label, !!actual, true);
}

const run = (expr) => vm.runInContext(expr, ctx);

console.log("=== KIEM THU crawl-state.js ===\n");

console.log("1) Khoa nhan dang phien tim kiem");
const base = "https://www.linkedin.com/jobs/search/?keywords=Business%20Analyst&location=Vietnam";
ctx.__a = base;
ctx.__b = base + "&currentJobId=4123456789&start=75";
check(
  "bo currentJobId va start -> cung mot phien",
  run("jhSearchKey(__a) === jhSearchKey(__b)"),
  true
);
ctx.__c = "https://www.linkedin.com/jobs/search/?keywords=Data%20Analyst&location=Vietnam";
check("tu khoa khac -> phien khac", run("jhSearchKey(__a) === jhSearchKey(__c)"), false);

console.log("\n2) Doc va dung URL phan trang");
check("start mac dinh = 0", run(`jhGetStartOffset("${base}")`), 0);
check("doc start=75", run(`jhGetStartOffset("${base}&start=75")`), 75);
ctx.__u = run(`jhBuildPageUrl("${base}&currentJobId=999888777&start=25", 50)`);
checkTrue("URL trang moi co start=50", run(`__u.includes("start=50")`));
checkTrue("URL trang moi da BO currentJobId", run(`!__u.includes("currentJobId")`));
checkTrue("URL trang moi giu nguyen keywords", run(`__u.includes("keywords=Business")`));

console.log("\n3) Checkpoint moi");
ctx.__st = run(`jhCkptNew("${base}&start=50")`);
check("pageIndex suy tu start (50/25)", run("__st.pageIndex"), 2);
check("startOffset = 50", run("__st.startOffset"), 50);
check("cardIndex khoi tao = 0", run("__st.cardIndex"), 0);
check("status ban dau", run("__st.status"), "RUNNING");

console.log("\n4) Ve dieu huong (expect)");
run("jhCkptIssueExpect(__st, 75)");
check("expect.start = 75", run("__st.expect.start"), 75);
checkTrue("nhan dien dung dieu huong cua chinh minh", run(`jhCkptIsOurNavigation(__st, "${base}&start=75")`));
checkTrue(
  "start LECH van chap nhan (khong chan cung)",
  run(`jhCkptIsOurNavigation(__st, "${base}&start=100")`)
);
checkTrue(
  "tim kiem KHAC thi TU CHOI resume",
  run(`!jhCkptIsOurNavigation(__st, "https://www.linkedin.com/jobs/search/?keywords=Data%20Analyst&location=Vietnam")`)
);
run("__st.expect.issuedAt = Date.now() - 200000");
checkTrue("ve qua han 2 phut -> tu choi", run(`!jhCkptIsOurNavigation(__st, "${base}&start=75")`));

console.log("\n5) Phat hien phien treo (stale) va kha nang tiep tuc");
run("__st.status='RUNNING'; __st.heartbeatAt = Date.now();");
checkTrue("vua co nhip tim -> khong stale", run("!jhCkptIsStale(__st)"));
run("__st.heartbeatAt = Date.now() - 200000;");
checkTrue("qua 90s khong nhip tim -> stale", run("jhCkptIsStale(__st)"));
checkTrue("stale -> VAN tiep tuc duoc (dong tab giua chung)", run("jhCkptIsResumable(__st)"));
run("__st.status='PAUSED_USER'; __st.heartbeatAt=Date.now();");
checkTrue("PAUSED_* -> tiep tuc duoc", run("jhCkptIsResumable(__st)"));
run("__st.status='FINISHED'; __st.savedCount=0;");
checkTrue("FINISHED va chua luu gi -> khong tiep tuc", run("!jhCkptIsResumable(__st)"));

console.log("\n6) Khong hoi sinh phien da dung (chong last-writer-wins)");
await run(`(async()=>{
  const st = jhCkptNew("${base}");
  st.status='RUNNING';
  await jhCkptSave(st);
  await jhCkptPause(st, 'PAUSED_USER', 'nguoi dung bam Dung');
  const revive = { ...st, status: 'RUNNING' };
  globalThis.__saveResult = await jhCkptSave(revive);
  globalThis.__afterStatus = (await jhCkptLoad()).status;
})()`);
check("jhCkptSave tu choi ghi de RUNNING", ctx.__saveResult, false);
check("trang thai tren dia van la PAUSED_USER", ctx.__afterStatus, "PAUSED_USER");
checkTrue("co dung duoc bat sau khi bi tu choi", run("jhIsStopRequested()"));

console.log("\n7) Lay job id tu the danh sach");
const fakeCard = {
  getAttribute: (k) => (k === "data-occludable-job-id" ? "4453522944" : null),
  querySelector: () => null,
};
ctx.__card = fakeCard;
check("doc tu data-occludable-job-id", run("jhCardJobId(__card)"), "4453522944");
ctx.__card2 = {
  getAttribute: () => null,
  querySelector: () => ({ href: "https://www.linkedin.com/jobs/view/senior-ba-at-fpt-4440185511?x=1" }),
};
check("doc tu href co slug", run("jhCardJobId(__card2)"), "4440185511");

console.log(`\n=== KET QUA: ${pass} dat / ${fail} loi ===`);
process.exit(fail === 0 ? 0 : 1);
