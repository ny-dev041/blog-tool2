"use strict";

/* ============================================================
   [ 설정 구역 ] 나중에 바뀔 값은 전부 여기에 모아둡니다.
   비개발자도 이 구역만 보고 고칠 수 있도록 한글 주석을 달아둡니다.
   ============================================================ */

// localStorage 저장 이름표. 원고외주 요청서 사이트와 같은 주소(github.io)에 올라가도
// 데이터가 섞이지 않도록 일부러 다른 이름을 씀. (바꾸면 기존 데이터를 못 읽어오니 함부로 바꾸지 말 것)
const 저장소_키 = "directPublishTool_companies_v1";
const 묶음_저장소_키 = "directPublishTool_batch_v1";

// 묶어서 요청서에 한 번에 담을 수 있는 최대 업체 수
const 묶음_최대개수 = 10;

// 묶음 요청서에서 업체와 업체 사이를 나누는 구분선 (위아래로 빈 줄이 하나씩 들어감)
const 묶음_구분선 = "-------------------";

// 설문 일괄 입력(붙여넣기)에서 탭으로 구분된 칸 중 업체명·설문이 몇 번째 칸인지 (1부터 셈)
const 칸_업체명_위치 = 1;
const 칸_설문_위치 = 2;

// 검색창 자동완성에 최대 몇 개까지 보여줄지
const 검색_최대표시개수 = 8;

// 요청서 양식 (항목 순서/문구). {중괄호} 부분이 실제 값으로 바뀝니다.
// 항목 사이 빈 줄은 각 항목을 한 줄씩 띄워서 보여주기 위한 것.
const 요청서_양식 = `키워드 : {키워드}

업체명 : {업체명}

업체정보 : {업체설문}`;

// "추가 업체정보" 줄 양식 — 업체에 추가 업체정보가 있을 때만 업체정보 바로 아래에 덧붙습니다.
const 추가업체정보_줄양식 = `추가 업체정보 : {추가업체정보}`;

// "추가 요청" 줄 양식 — 추가 입력이 있을 때만 맨 아래에 덧붙습니다.
const 추가요청_줄양식 = `추가 요청 : {추가요청}`;

// 결과창에 아직 요청서가 없을 때 보여주는 안내 문구
const 안내문구_1개씩 = "[요청서 생성]을 누르면 여기에 완성된 요청서가 표시됩니다.";
const 안내문구_묶음 = "[묶음 요청서 생성]을 누르면 여기에 묶음 요청서가 표시됩니다.";

/* ============================================================
   여기부터는 기능 구현 (평소엔 안 건드려도 됨)
   ============================================================ */

// ---------- DOM 참조 ----------
const $ = (id) => document.getElementById(id);

const el = {
  btnExport: $("btnExport"),
  btnImport: $("btnImport"),
  importFileInput: $("importFileInput"),

  searchInput: $("searchInput"),
  suggestBox: $("suggestBox"),
  emptyState: $("emptyState"),
  companyForm: $("companyForm"),
  coName: $("coName"),
  coAliasTag: $("coAliasTag"),
  btnBlogLink: $("btnBlogLink"),
  btnPlaceLink: $("btnPlaceLink"),
  kwInput: $("kwInput"),
  kwWarning: $("kwWarning"),
  extraInput: $("extraInput"),
  surveyView: $("surveyView"),
  extraInfoView: $("extraInfoView"),
  btnGenerate: $("btnGenerate"),

  batchCount: $("batchCount"),
  batchList: $("batchList"),
  batchWarning: $("batchWarning"),
  btnBatchClear: $("btnBatchClear"),
  btnBatchGenerate: $("btnBatchGenerate"),

  resultOutput: $("resultOutput"),
  btnCopy: $("btnCopy"),

  pasteInput: $("pasteInput"),
  btnPreview: $("btnPreview"),
  importMsg: $("importMsg"),
  previewCard: $("previewCard"),
  pvSummary: $("pvSummary"),
  pvList: $("pvList"),
  btnSaveImport: $("btnSaveImport"),

  coCount: $("coCount"),
  btnOpenAdd: $("btnOpenAdd"),
  coSearch: $("coSearch"),
  coList: $("coList"),

  modalOverlay: $("modalOverlay"),
  modalTitle: $("modalTitle"),
  modalName: $("modalName"),
  modalAlias: $("modalAlias"),
  modalSurvey: $("modalSurvey"),
  modalExtraInfo: $("modalExtraInfo"),
  modalBlogUrl: $("modalBlogUrl"),
  modalPlaceUrl: $("modalPlaceUrl"),
  modalCancel: $("modalCancel"),
  modalSave: $("modalSave"),

  confirmOverlay: $("confirmOverlay"),
  confirmMessage: $("confirmMessage"),
  confirmOkBtn: $("confirmOkBtn"),
  confirmCancelBtn: $("confirmCancelBtn"),
};

// 요소를 간단히 만드는 도우미 (텍스트는 항상 textContent로 넣어서 안전하게)
function h(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------- 저장/불러오기 (localStorage) ----------
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCompany(c) {
  if (!c || typeof c !== "object") return null;
  const name = String(c.name || "").trim();
  if (!name) return null;
  return {
    name,
    alias: String(c.alias || "").trim(),
    survey: String(c.survey || ""),
    extraInfo: String(c.extraInfo || ""), // 추가 업체정보 (요청서에 함께 들어감)
    blogUrl: String(c.blogUrl || "").trim(),
    placeUrl: String(c.placeUrl || "").trim(),
    surveyEdited: Boolean(c.surveyEdited), // 이 사이트에서 설문을 직접 고친 업체인지
  };
}

function loadCompanies() {
  try {
    const raw = localStorage.getItem(저장소_키);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.companies)) return [];
    return data.companies.map(normalizeCompany).filter(Boolean);
  } catch (e) {
    console.error("업체 데이터를 불러오는 중 오류:", e);
    return [];
  }
}

function saveCompanies() {
  try {
    const data = { version: 1, backupDate: todayISO(), companies };
    localStorage.setItem(저장소_키, JSON.stringify(data));
  } catch (e) {
    console.error("업체 데이터를 저장하는 중 오류:", e);
    showAlert("브라우저 저장 공간에 저장하지 못했어요. JSON 내보내기로 먼저 백업해주세요.");
  }
}

function loadBatch() {
  try {
    const raw = localStorage.getItem(묶음_저장소_키);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.name === "string" && companies.some((c) => c.name === e.name))
      .map((e) => ({ name: e.name, keyword: String(e.keyword || ""), extra: String(e.extra || "") }))
      .slice(0, 묶음_최대개수);
  } catch (e) {
    console.error("묶음 목록을 불러오는 중 오류:", e);
    return [];
  }
}

function saveBatch() {
  try {
    localStorage.setItem(묶음_저장소_키, JSON.stringify(batchQueue));
  } catch (e) {
    console.error("묶음 목록을 저장하는 중 오류:", e);
  }
}

// ---------- 상태 ----------
let companies = loadCompanies();    // 전체 업체 목록
let batchQueue = loadBatch();       // 묶어서 모드에서 담아둔 업체들 [{name, keyword, extra}]
let currentCompany = null;          // 현재 선택된 업체
let currentMode = "single";         // "single"(1개씩) | "batch"(묶어서)
let hasGeneratedRequest = false;    // 결과창에 실제 요청서가 떠 있는지 (안내 문구는 복사 대상 아님)
let hasUnexportedChanges = false;   // 업체 정보를 바꿨는데 아직 [JSON 내보내기]로 백업 안 한 상태인지
let suggestMatches = [];            // 검색창 아래 추천 업체 목록 (방향키 이동용)
let suggestIndex = -1;              // 방향키로 하이라이트된 추천 위치 (-1이면 없음)
let editingCompany = null;          // 수정 중인 업체 (null이면 새 업체 추가 중)
let importRows = [];                // 설문 일괄 입력 미리보기 목록

// ---------- 확인/알림 모달 (브라우저 기본 confirm·alert 대체) ----------
function showConfirm(message, { showCancel = true, okText = "확인", cancelText = "취소" } = {}) {
  return new Promise((resolve) => {
    el.confirmMessage.textContent = message;
    el.confirmOkBtn.textContent = okText;
    el.confirmCancelBtn.textContent = cancelText;
    el.confirmCancelBtn.hidden = !showCancel;
    el.confirmOverlay.hidden = false;

    function cleanup(result) {
      el.confirmOverlay.hidden = true;
      el.confirmOkBtn.removeEventListener("click", onOk);
      el.confirmCancelBtn.removeEventListener("click", onCancel);
      el.confirmOverlay.removeEventListener("click", onOverlayClick);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlayClick(e) {
      if (e.target === el.confirmOverlay) cleanup(false);
    }

    el.confirmOkBtn.addEventListener("click", onOk);
    el.confirmCancelBtn.addEventListener("click", onCancel);
    el.confirmOverlay.addEventListener("click", onOverlayClick);
  });
}

function showAlert(message) {
  return showConfirm(message, { showCancel: false });
}

// ---------- 링크 도우미 ----------
// http(s)가 안 붙어 있으면 자동으로 붙여줌 (안 그러면 현재 페이지 기준 상대 주소로 열려버림)
function normalizeUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;
}

function setLinkButton(button, url) {
  const normalized = normalizeUrl(url);
  if (normalized) {
    button.href = normalized;
    button.hidden = false;
  } else {
    button.removeAttribute("href");
    button.hidden = true;
  }
}

// ============================================================
//  메뉴 전환
// ============================================================
function showView(name) {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === name);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === "view-" + name);
  });
}

// ============================================================
//  요청서 만들기 — 업체 검색 (자동완성)
// ============================================================
function renderSuggestions(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    hideSuggestions();
    return;
  }
  const matches = companies
    .filter((c) => c.name.toLowerCase().includes(q) || (c.alias && c.alias.toLowerCase().includes(q)))
    .slice(0, 검색_최대표시개수);

  suggestMatches = matches;
  suggestIndex = -1;

  el.suggestBox.innerHTML = "";
  if (matches.length === 0) {
    el.suggestBox.appendChild(h("div", "suggest-empty", "일치하는 업체가 없어요. [업체 정보 관리]에서 등록할 수 있어요."));
  } else {
    matches.forEach((c, idx) => {
      const item = h("div", "suggest-item");
      item.appendChild(h("span", "", c.name));
      if (c.alias) item.appendChild(h("span", "alias", "별칭 · " + c.alias));
      item.addEventListener("click", () => pickSuggestion(c));
      item.addEventListener("mouseenter", () => {
        suggestIndex = idx;
        updateSuggestHighlight();
      });
      el.suggestBox.appendChild(item);
    });
  }
  el.suggestBox.hidden = false;
}

function updateSuggestHighlight() {
  const items = el.suggestBox.querySelectorAll(".suggest-item");
  items.forEach((item, idx) => item.classList.toggle("active", idx === suggestIndex));
  if (suggestIndex >= 0 && items[suggestIndex]) {
    items[suggestIndex].scrollIntoView({ block: "nearest" });
  }
}

function moveSuggestHighlight(delta) {
  if (suggestMatches.length === 0) return;
  suggestIndex = (suggestIndex + delta + suggestMatches.length) % suggestMatches.length;
  updateSuggestHighlight();
}

function pickSuggestion(company) {
  el.searchInput.value = company.name;
  hideSuggestions();
  selectCompany(company.name);
}

function hideSuggestions() {
  el.suggestBox.hidden = true;
  el.suggestBox.innerHTML = "";
  suggestMatches = [];
  suggestIndex = -1;
}

// ============================================================
//  요청서 만들기 — 업체 선택 / 입력 / 결과창
// ============================================================
function findEntry(name) {
  return batchQueue.find((e) => e.name === name);
}

function renderCurrentHeader() {
  if (!currentCompany) return;
  el.coName.textContent = currentCompany.name;
  if (currentCompany.alias) {
    el.coAliasTag.textContent = "별칭 · " + currentCompany.alias;
    el.coAliasTag.hidden = false;
  } else {
    el.coAliasTag.hidden = true;
  }
  setLinkButton(el.btnBlogLink, currentCompany.blogUrl);
  setLinkButton(el.btnPlaceLink, currentCompany.placeUrl);
  el.surveyView.value = currentCompany.survey || "";
  el.extraInfoView.value = currentCompany.extraInfo || "";
}

function showCompanyForm(show) {
  el.emptyState.hidden = show;
  el.companyForm.hidden = !show;
}

function clearKeywordWarning() {
  el.kwInput.classList.remove("invalid");
  el.kwWarning.hidden = true;
}

function showKeywordWarning(message) {
  el.kwInput.classList.add("invalid");
  el.kwWarning.textContent = message;
  el.kwWarning.hidden = false;
}

function showBatchWarning(message) {
  el.batchWarning.textContent = message;
  el.batchWarning.hidden = !message;
}

function resetResultPanel() {
  hasGeneratedRequest = false;
  el.resultOutput.textContent = currentMode === "batch" ? 안내문구_묶음 : 안내문구_1개씩;
}

function selectCompany(name) {
  const company = companies.find((c) => c.name === name);
  if (!company) return;
  currentCompany = company;
  showCompanyForm(true);
  renderCurrentHeader();

  // 묶어서 모드에서는 이미 담아둔 입력이 있으면 그대로 다시 보여줌
  const entry = currentMode === "batch" ? findEntry(company.name) : null;
  el.kwInput.value = entry ? entry.keyword : "";
  el.extraInput.value = entry ? entry.extra : "";

  clearKeywordWarning();
  showBatchWarning("");
  renderBatchList();
  resetResultPanel();
}

function clearCurrentCompany() {
  currentCompany = null;
  el.searchInput.value = "";
  el.kwInput.value = "";
  el.extraInput.value = "";
  clearKeywordWarning();
  showCompanyForm(false);
}

function setMode(mode) {
  currentMode = mode;
  document.body.dataset.mode = mode;
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  if (mode === "batch" && currentCompany) {
    const entry = findEntry(currentCompany.name);
    if (entry) {
      el.kwInput.value = entry.keyword;
      el.extraInput.value = entry.extra;
    } else {
      syncBatchEntry(); // 1개씩 모드에서 써둔 입력이 있으면 목록으로 이어서 담음
    }
  }

  clearKeywordWarning();
  showBatchWarning("");
  renderBatchList();
  resetResultPanel();
}

// ============================================================
//  요청서 만들기 — 묶음 목록 (묶어서 모드)
// ============================================================
function renderBatchList() {
  el.batchCount.textContent = `${batchQueue.length} / ${묶음_최대개수}`;
  el.batchList.innerHTML = "";

  if (batchQueue.length === 0) {
    el.batchList.appendChild(
      h("li", "check-empty", "아직 담긴 업체가 없어요. 업체를 고르고 키워드를 입력하면 자동으로 담겨요.")
    );
    return;
  }

  batchQueue.forEach((entry) => {
    const done = entry.keyword.trim() !== "";
    const isCurrent = currentCompany && currentCompany.name === entry.name;
    const li = h("li", "check-item" + (done ? " done" : "") + (isCurrent ? " current" : ""));
    li.appendChild(h("span", "mark", done ? "✓" : ""));
    li.appendChild(h("span", "nm", entry.name));
    if (!done) li.appendChild(h("span", "state", "키워드 필요"));

    const x = h("span", "x", "✕");
    x.title = "목록에서 빼기";
    x.addEventListener("click", (ev) => {
      ev.stopPropagation();
      removeBatchEntry(entry.name);
    });
    li.appendChild(x);

    li.addEventListener("click", () => {
      el.searchInput.value = entry.name;
      selectCompany(entry.name);
    });
    el.batchList.appendChild(li);
  });
}

// 지금 입력칸의 내용을 묶음 목록에 자동 저장 (입력할 때마다 호출됨)
function syncBatchEntry() {
  if (!currentCompany) return;
  const keyword = el.kwInput.value.trim();
  const extra = el.extraInput.value;
  const idx = batchQueue.findIndex((e) => e.name === currentCompany.name);
  const hasContent = keyword !== "" || extra.trim() !== "";

  if (!hasContent) {
    if (idx >= 0) batchQueue.splice(idx, 1);
  } else if (idx >= 0) {
    batchQueue[idx].keyword = keyword;
    batchQueue[idx].extra = extra;
  } else {
    if (batchQueue.length >= 묶음_최대개수) {
      showBatchWarning(`묶음 목록은 최대 ${묶음_최대개수}개까지만 담을 수 있어요. 목록에서 업체를 빼고 다시 입력해주세요.`);
      return;
    }
    batchQueue.push({ name: currentCompany.name, keyword, extra });
  }

  showBatchWarning("");
  saveBatch();
  renderBatchList();
  resetResultPanel();
}

function removeBatchEntry(name) {
  const idx = batchQueue.findIndex((e) => e.name === name);
  if (idx < 0) return;
  batchQueue.splice(idx, 1);
  if (currentCompany && currentCompany.name === name) {
    el.kwInput.value = "";
    el.extraInput.value = "";
    clearKeywordWarning();
  }
  showBatchWarning("");
  saveBatch();
  renderBatchList();
  resetResultPanel();
}

async function clearBatch() {
  if (batchQueue.length === 0) return;
  const ok = await showConfirm(`묶음 목록에 담긴 ${batchQueue.length}개 업체의 입력을 모두 비울까요?`);
  if (!ok) return;
  batchQueue = [];
  if (currentCompany) {
    el.kwInput.value = "";
    el.extraInput.value = "";
  }
  clearKeywordWarning();
  showBatchWarning("");
  saveBatch();
  renderBatchList();
  resetResultPanel();
}

// ============================================================
//  요청서 만들기 — 요청서 생성 / 복사
// ============================================================
// 업체 1개 분량의 요청서 텍스트 (값에 $ 같은 특수문자가 있어도 그대로 들어가도록 함수로 치환)
function buildBlock({ keyword, companyName, survey, companyExtra, extra }) {
  let text = 요청서_양식
    .replace("{키워드}", () => keyword || "")
    .replace("{업체명}", () => companyName || "")
    .replace("{업체설문}", () => survey || "");

  if (companyExtra && companyExtra.trim()) {
    text += "\n\n" + 추가업체정보_줄양식.replace("{추가업체정보}", () => companyExtra.trim());
  }
  if (extra && extra.trim()) {
    text += "\n\n" + 추가요청_줄양식.replace("{추가요청}", () => extra.trim());
  }
  return text;
}

function showResult(text) {
  el.resultOutput.textContent = text;
  hasGeneratedRequest = true;
}

function generateSingle() {
  if (!currentCompany) return;
  const keyword = el.kwInput.value.trim();
  if (!keyword) {
    showKeywordWarning("새 키워드를 입력해주세요.");
    el.kwInput.focus();
    return;
  }
  showResult(
    buildBlock({
      keyword,
      companyName: currentCompany.name,
      survey: currentCompany.survey.trim(),
      companyExtra: currentCompany.extraInfo,
      extra: el.extraInput.value,
    })
  );
}

async function generateBatch() {
  if (batchQueue.length === 0) {
    await showAlert("묶음 목록이 비어 있어요. 업체를 고르고 키워드를 입력하면 자동으로 담겨요.");
    return;
  }
  const missing = batchQueue.filter((e) => e.keyword.trim() === "").map((e) => e.name);
  if (missing.length > 0) {
    await showAlert(`새 키워드가 비어 있는 업체가 있어요.\n\n${missing.join("\n")}`);
    return;
  }

  const blocks = batchQueue.map((entry) => {
    const company = companies.find((c) => c.name === entry.name);
    return buildBlock({
      keyword: entry.keyword.trim(),
      companyName: entry.name,
      survey: company ? company.survey.trim() : "",
      companyExtra: company ? company.extraInfo : "",
      extra: entry.extra,
    });
  });
  showResult(blocks.join(`\n\n${묶음_구분선}\n\n`));
}

function copyResult() {
  // 요청서를 생성하기 전(안내 문구만 떠 있는 상태)에는 복사하지 않음
  if (!hasGeneratedRequest) return;
  const text = el.resultOutput.textContent;
  if (!text || !text.trim()) return;

  // navigator.clipboard는 file:// 로 연 페이지에서 부작용이 있어서 안 씀.
  // execCommand 방식은 file://·http(s) 어디서든 잘 동작함.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

// ============================================================
//  업체 정보 관리 — 업체 목록 / 추가 / 수정 / 삭제
// ============================================================
function snippet(text, max) {
  const flat = (text || "").replace(/\s+/g, " ").trim();
  if (!flat) return "(설문 없음)";
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

function renderCompanyList() {
  const q = el.coSearch.value.trim().toLowerCase();
  const list = companies
    .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.alias && c.alias.toLowerCase().includes(q)))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  el.coCount.textContent = `전체 ${companies.length}개`;
  el.coList.innerHTML = "";

  if (list.length === 0) {
    el.coList.appendChild(
      h("div", "co-empty", companies.length === 0
        ? "아직 등록된 업체가 없어요. 설문을 붙여넣거나 [+ 업체 추가]로 등록해보세요."
        : "일치하는 업체가 없어요.")
    );
    return;
  }

  list.forEach((company) => {
    const row = h("div", "co-row");
    const info = h("div", "info");

    const nm = h("div", "nm");
    nm.appendChild(h("span", "", company.name));
    if (company.alias) nm.appendChild(h("span", "alias-tag", company.alias));
    if (company.surveyEdited) nm.appendChild(h("span", "badge-status st-edited", "설문 직접 수정"));
    info.appendChild(nm);
    info.appendChild(h("div", "snip", snippet(company.survey, 80)));
    row.appendChild(info);

    const btns = h("div", "btns");
    const editBtn = h("button", "btn btn-sm", "수정");
    editBtn.type = "button";
    editBtn.addEventListener("click", () => openCompanyModal(company));
    const delBtn = h("button", "btn btn-sm btn-danger-text", "삭제");
    delBtn.type = "button";
    delBtn.addEventListener("click", () => deleteCompany(company));
    btns.appendChild(editBtn);
    btns.appendChild(delBtn);
    row.appendChild(btns);

    el.coList.appendChild(row);
  });
}

function openCompanyModal(company) {
  editingCompany = company || null;
  el.modalTitle.textContent = company ? "업체 정보 수정" : "업체 추가";
  el.modalName.value = company ? company.name : "";
  el.modalAlias.value = company ? company.alias : "";
  el.modalSurvey.value = company ? company.survey : "";
  el.modalExtraInfo.value = company ? company.extraInfo : "";
  el.modalBlogUrl.value = company ? company.blogUrl : "";
  el.modalPlaceUrl.value = company ? company.placeUrl : "";
  el.modalOverlay.hidden = false;
  el.modalName.focus();
}

function closeCompanyModal() {
  el.modalOverlay.hidden = true;
  editingCompany = null;
}

function saveCompanyModal() {
  const name = el.modalName.value.trim();
  if (!name) {
    showAlert("업체명을 입력해주세요.");
    return;
  }
  if (companies.some((c) => c.name === name && c !== editingCompany)) {
    showAlert("이미 등록된 업체명이에요.");
    return;
  }
  const alias = el.modalAlias.value.trim();
  const survey = el.modalSurvey.value.trim();
  const extraInfo = el.modalExtraInfo.value.trim();
  const blogUrl = el.modalBlogUrl.value.trim();
  const placeUrl = el.modalPlaceUrl.value.trim();

  if (editingCompany) {
    const oldName = editingCompany.name;
    // 설문 내용을 바꿨으면 "직접 수정" 표시를 남김 (나중에 시트 붙여넣기 때 덮어쓸지 물어보기 위해)
    if (survey !== (editingCompany.survey || "").trim()) editingCompany.surveyEdited = true;
    editingCompany.name = name;
    editingCompany.alias = alias;
    editingCompany.survey = survey;
    editingCompany.extraInfo = extraInfo;
    editingCompany.blogUrl = blogUrl;
    editingCompany.placeUrl = placeUrl;

    if (oldName !== name) {
      batchQueue.forEach((e) => {
        if (e.name === oldName) e.name = name;
      });
      saveBatch();
    }
    if (currentCompany === editingCompany) {
      el.searchInput.value = name;
      renderCurrentHeader();
    }
  } else {
    companies.push({ name, alias, survey, extraInfo, blogUrl, placeUrl, surveyEdited: false });
  }

  saveCompanies();
  hasUnexportedChanges = true;
  closeCompanyModal();
  renderCompanyList();
  renderBatchList();
}

async function deleteCompany(company) {
  const ok = await showConfirm(`"${company.name}" 업체를 삭제할까요?\n삭제하면 되돌릴 수 없어요.`);
  if (!ok) return;

  companies = companies.filter((c) => c !== company);
  batchQueue = batchQueue.filter((e) => e.name !== company.name);
  if (currentCompany === company) clearCurrentCompany();

  saveCompanies();
  saveBatch();
  hasUnexportedChanges = true;
  renderCompanyList();
  renderBatchList();
  resetResultPanel();
}

// ============================================================
//  업체 정보 관리 — 설문 일괄 입력 (붙여넣기 → 미리보기 → 저장)
// ============================================================

// 탭으로 구분된 붙여넣기 텍스트를 표(행 x 칸)로 변환.
// 구글시트에서 복사하면 긴 셀(설문)이 큰따옴표로 감싸이고 그 안에 줄바꿈이 들어있을 수 있어서,
// 단순히 줄바꿈으로만 나누면 데이터가 깨짐 → 큰따옴표를 인식하는 파서를 직접 구현.
function parseTSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === "\t") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    if (field.endsWith("\r")) field = field.slice(0, -1);
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// 붙여넣은 내용을 업체별로 묶음. 같은 업체가 여러 줄이면 설문이 다른 것만 선택지로 남기고,
// 기본은 가장 아래쪽 줄(= 최신)을 고름.
function buildImportRows(text) {
  const parsed = parseTSV(text);
  const groups = new Map();

  parsed.forEach((row, i) => {
    if (!row.some((c) => c.trim() !== "")) return;
    const name = (row[칸_업체명_위치 - 1] || "").trim();
    const survey = (row[칸_설문_위치 - 1] || "").trim();
    if (!name) return;
    if (i === 0 && name === "업체명") return; // 제목행은 건너뜀
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ lineNo: i + 1, survey });
  });

  const rows = [];
  groups.forEach((entries, name) => {
    let options = [];
    entries.forEach((en) => {
      const same = options.find((o) => o.survey === en.survey);
      if (same) same.lineNo = en.lineNo; // 똑같은 내용이면 하나로 합치고, 위치는 가장 아래 줄로
      else options.push({ lineNo: en.lineNo, survey: en.survey });
    });
    // 설문이 비어 있는 줄은 내용이 있는 줄이 하나라도 있으면 제외 (빈 줄이 최신으로 뽑히는 걸 막음)
    const withContent = options.filter((o) => o.survey !== "");
    if (withContent.length > 0) options = withContent;
    options.sort((a, b) => a.lineNo - b.lineNo);

    const row = { name, options, rowCount: entries.length, chosenIdx: options.length - 1, status: "new", checked: false };
    applyRowDefaults(row);
    rows.push(row);
  });
  return rows;
}

// 기존 업체와 비교한 상태: new(새 업체) / update(갱신) / edited(직접 수정한 업체) / same(변경 없음)
function classifyRow(row) {
  const existing = companies.find((c) => c.name === row.name);
  if (!existing) return "new";
  const chosen = row.options[row.chosenIdx].survey;
  if ((existing.survey || "").trim() === chosen) return "same";
  return existing.surveyEdited ? "edited" : "update";
}

function applyRowDefaults(row) {
  row.status = classifyRow(row);
  row.checked = row.status === "new" || row.status === "update"; // 직접 수정한 업체는 기본 체크 해제
}

function statusBadge(status) {
  const map = {
    new: ["st-new", "새 업체"],
    update: ["st-update", "갱신"],
    edited: ["st-edited", "직접 수정함"],
    same: ["st-same", "변경 없음"],
  };
  const [cls, label] = map[status];
  return h("span", "badge-status " + cls, label);
}

function renderPreview() {
  el.previewCard.hidden = false;

  const counts = { new: 0, update: 0, edited: 0, same: 0, dup: 0 };
  importRows.forEach((r) => {
    counts[r.status]++;
    if (r.options.length > 1) counts.dup++;
  });
  el.pvSummary.textContent =
    `새 업체 ${counts.new} · 갱신 ${counts.update} · 직접 수정함 ${counts.edited} · 변경 없음 ${counts.same} · 중복 ${counts.dup}`;

  el.pvList.innerHTML = "";
  importRows.forEach((row, i) => {
    const wrap = h("div", "pv-row" + (row.status === "same" ? " dim" : ""));

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = row.checked;
    cb.disabled = row.status === "same";
    cb.dataset.i = String(i);
    cb.setAttribute("aria-label", "저장 대상");
    wrap.appendChild(cb);

    const body = h("div");
    body.appendChild(h("div", "nm", row.name));
    body.appendChild(h("div", "sub", snippet(row.options[row.chosenIdx].survey, 90)));
    if (row.status === "edited") {
      body.appendChild(h("div", "note-line", "이 사이트에서 설문을 직접 수정한 업체예요. 체크하면 시트 내용으로 덮어써요."));
    }
    if (row.options.length > 1) {
      const select = document.createElement("select");
      select.dataset.i = String(i);
      select.setAttribute("aria-label", "사용할 줄 선택");
      row.options.forEach((o, optIdx) => {
        const isLast = optIdx === row.options.length - 1;
        const label = `${o.lineNo}번째 줄${isLast ? " (가장 아래·기본)" : ""} · ${snippet(o.survey, 24)}`;
        const opt = h("option", "", label);
        opt.value = String(optIdx);
        opt.selected = optIdx === row.chosenIdx;
        select.appendChild(opt);
      });
      body.appendChild(select);
    }
    wrap.appendChild(body);

    const badges = h("div", "pv-badges");
    badges.appendChild(statusBadge(row.status));
    if (row.options.length > 1) badges.appendChild(h("span", "badge-status st-dup", `중복 ${row.rowCount}줄`));
    wrap.appendChild(badges);

    el.pvList.appendChild(wrap);
  });
}

function showImportMsg(text, kind) {
  el.importMsg.textContent = text;
  el.importMsg.className = "result-msg " + (kind || "");
  el.importMsg.hidden = false;
}

function handlePreview() {
  const text = el.pasteInput.value;
  if (!text.trim()) {
    showImportMsg("붙여넣은 내용이 없어요.", "warn");
    return;
  }
  const rows = buildImportRows(text);
  if (rows.length === 0) {
    el.previewCard.hidden = true;
    showImportMsg("업체명 | 업체설문 형태의 내용을 읽지 못했어요. 시트에서 2칸을 그대로 복사했는지 확인해주세요.", "warn");
    return;
  }
  importRows = rows;
  el.importMsg.hidden = true;
  renderPreview();
}

function handleSaveImport() {
  let added = 0;
  let updated = 0;

  importRows.forEach((row) => {
    if (!row.checked || row.status === "same") return;
    const chosen = row.options[row.chosenIdx].survey;
    const existing = companies.find((c) => c.name === row.name);
    if (!existing) {
      companies.push({ name: row.name, alias: "", survey: chosen, extraInfo: "", blogUrl: "", placeUrl: "", surveyEdited: false });
      added++;
    } else {
      existing.survey = chosen;
      existing.surveyEdited = false; // 시트 내용으로 맞췄으니 "직접 수정" 표시 해제
      updated++;
    }
  });

  if (added + updated === 0) {
    showImportMsg("저장할 업체를 선택해주세요.", "warn");
    return;
  }

  saveCompanies();
  hasUnexportedChanges = true;
  if (currentCompany) renderCurrentHeader();
  renderCompanyList();

  importRows = [];
  el.previewCard.hidden = true;
  el.pasteInput.value = "";
  showImportMsg(`${added}개 추가 / ${updated}개 갱신했어요.`, "ok");
}

// ============================================================
//  JSON 내보내기 / 불러오기
// ============================================================
function exportJSON() {
  const data = { version: 1, backupDate: todayISO(), companies };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `직접발행_업체데이터_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  hasUnexportedChanges = false; // 방금 백업했으니 표시 해제
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.companies)) {
        throw new Error("companies 목록이 없는 파일이에요.");
      }

      // 이름이 같은 업체가 여러 개면 앞의 것만 남김 (검색에서 뒤의 것이 묻히는 걸 막기 위해)
      const seen = new Set();
      const imported = [];
      let skipped = 0;
      data.companies.map(normalizeCompany).filter(Boolean).forEach((c) => {
        if (seen.has(c.name)) {
          skipped++;
          return;
        }
        seen.add(c.name);
        imported.push(c);
      });

      let message = `현재 데이터를 이 파일 내용으로 덮어쓸까요?\n(불러올 업체 수: ${imported.length}개)`;
      if (skipped > 0) message += `\n※ 업체명이 겹치는 ${skipped}개는 제외돼요.`;
      const ok = await showConfirm(message);
      if (!ok) return;

      companies = imported;
      saveCompanies();
      batchQueue = batchQueue.filter((e) => companies.some((c) => c.name === e.name));
      saveBatch();

      clearCurrentCompany();
      importRows = [];
      el.previewCard.hidden = true;
      el.importMsg.hidden = true;
      hasUnexportedChanges = false;
      renderCompanyList();
      renderBatchList();
      resetResultPanel();
    } catch (err) {
      showAlert("JSON 파일을 읽는 중 문제가 발생했어요: " + err.message);
    } finally {
      el.importFileInput.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

// ============================================================
//  이벤트 연결
// ============================================================

// 업체 정보를 바꿨는데 JSON 백업(내보내기)을 안 한 채로 창을 닫으려 하면 브라우저가 한 번 물어봄.
// (브라우저 정책상 문구는 바꿀 수 없고 기본 문구가 뜸)
window.addEventListener("beforeunload", (e) => {
  if (hasUnexportedChanges) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// 메뉴·모드 전환
document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});
document.querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

// 업체 검색
el.searchInput.addEventListener("input", (e) => renderSuggestions(e.target.value));
el.searchInput.addEventListener("focus", (e) => {
  if (e.target.value.trim()) renderSuggestions(e.target.value);
});
el.searchInput.addEventListener("keydown", (e) => {
  const isOpen = !el.suggestBox.hidden && suggestMatches.length > 0;
  if (!isOpen) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveSuggestHighlight(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveSuggestHighlight(-1);
  } else if (e.key === "Enter") {
    // 방향키로 고른 게 있으면 그것, 없어도 후보가 딱 1개면 그것을 선택
    const picked =
      (suggestIndex >= 0 && suggestMatches[suggestIndex]) ||
      (suggestMatches.length === 1 ? suggestMatches[0] : null);
    if (picked) {
      e.preventDefault();
      // 한글 입력 중(조합 미확정) 엔터를 누르면 브라우저가 조합을 확정하면서 마지막 글자를
      // 검색창 끝에 다시 덧붙이는 경우가 있어서, 그 뒤에 업체명으로 덮어쓰도록 한 박자 늦춰서 처리.
      setTimeout(() => pickSuggestion(picked), 0);
    }
  } else if (e.key === "Escape") {
    hideSuggestions();
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) hideSuggestions();
});

// 키워드·추가 입력 (묶어서 모드에서는 입력할 때마다 자동으로 묶음 목록에 저장)
el.kwInput.addEventListener("input", () => {
  clearKeywordWarning();
  if (currentMode === "batch") syncBatchEntry();
});
el.extraInput.addEventListener("input", () => {
  if (currentMode === "batch") syncBatchEntry();
});

// 요청서 생성 / 복사 / 묶음 목록
el.btnGenerate.addEventListener("click", generateSingle);
el.btnBatchGenerate.addEventListener("click", generateBatch);
el.btnBatchClear.addEventListener("click", clearBatch);
el.btnCopy.addEventListener("click", copyResult);

// 업체 정보 관리
el.btnPreview.addEventListener("click", handlePreview);
el.btnSaveImport.addEventListener("click", handleSaveImport);
el.pvList.addEventListener("change", (e) => {
  const target = e.target;
  const i = Number(target.dataset.i);
  const row = importRows[i];
  if (!row) return;
  if (target.tagName === "SELECT") {
    row.chosenIdx = Number(target.value);
    applyRowDefaults(row); // 고른 줄에 따라 상태(새 업체/갱신/변경 없음…)가 달라질 수 있어서 다시 계산
    renderPreview();
  } else if (target.type === "checkbox") {
    row.checked = target.checked;
  }
});
el.coSearch.addEventListener("input", renderCompanyList);
el.btnOpenAdd.addEventListener("click", () => openCompanyModal(null));
el.modalCancel.addEventListener("click", closeCompanyModal);
el.modalSave.addEventListener("click", saveCompanyModal);
el.modalOverlay.addEventListener("click", (e) => {
  if (e.target === el.modalOverlay) closeCompanyModal();
});

// JSON 백업
el.btnExport.addEventListener("click", exportJSON);
el.btnImport.addEventListener("click", () => el.importFileInput.click());
el.importFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importJSONFile(file);
});

// ---------- 시작 상태 ----------
showCompanyForm(false);
renderCompanyList();
setMode("single");
