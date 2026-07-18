const I18N_STORAGE_KEY = "floatingGuessLanguage";

const translations = {
  zh: {
    appTitle: "AI 猜词助手 Demo",
    appSubtitle: "上传直播截图，视觉 AI 自动读取线索并给出候选答案。",

    navResults: "AI 结果",
    navOcr: "OCR",
    navManual: "手动输入",
    navAiActions: "AI 操作",
    navImport: "导入",

    heroEyebrow: "Floating Guess Assistant",
    heroTitle: "截图上传，一键猜答案",
    visionAnalyzing: "视觉 AI 分析中...",
    heroDesc: "适合直播猜词场景：上传当前截图，视觉 AI 会自动读取题目线索、历史猜测和相似度，并给出候选答案。",
    chooseScreenshot: "选择直播截图",
    chooseScreenshotDesc: "支持手机截图 / 直播画面截图",
    analyzeScreenshot: "一键读图猜答案",
    nextRound: "清空，准备下一题",
    visionWaiting: "视觉 AI：待分析",
    previewTitle: "当前截图预览",

    refineTitle: "补充新信息后重新分析",
    supplementCluePlaceholder: "新线索，例如：和声音有关 / 现场提示是休闲活动",
    supplementGuessPlaceholder: "高分词，例如：听雨",
    supplementScorePlaceholder: "相似度%，例如 44.9",
    refineButton: "补充信息再分析",
    refineWaiting: "补充分析：待输入",

    aiResultsSummary: "AI 分析结果",
    rawAiSummary: "完整 AI 原文分析（可选）",
    savedAiTitle: "已保存的 AI 分析",
    candidateTitle: "AI 候选答案卡片",
    searchCandidatePlaceholder: "搜索 AI 候选词，例如：光阴",
    followupTitle: "追问历史",

    ocrSummary: "截图 OCR 识别",
    manualSummary: "手动输入 / 本地分析",
    aiActionsSummary: "AI 操作 / Prompt",
    importSummary: "导入导出 / Prompt",

    languageButton: "English"
  },

  en: {
    appTitle: "AI Guess Assistant Demo",
    appSubtitle: "Upload a livestream screenshot. Vision AI will extract clues and suggest candidate answers.",

    navResults: "AI Results",
    navOcr: "OCR Backup",
    navManual: "Manual Input",
    navAiActions: "AI Tools",
    navImport: "Import",

    heroEyebrow: "Floating Guess Assistant",
    heroTitle: "Upload screenshot, get AI guesses",
    visionAnalyzing: "Vision AI analyzing...",
    heroDesc: "Built for livestream guessing games. Upload the current screenshot, and Vision AI will read clues, previous guesses, similarity scores, and return answer candidates.",
    chooseScreenshot: "Choose screenshot",
    chooseScreenshotDesc: "Mobile screenshots and livestream screenshots supported",
    analyzeScreenshot: "Analyze screenshot",
    nextRound: "Clear for next round",
    visionWaiting: "Vision AI: waiting",
    previewTitle: "Current screenshot preview",

    refineTitle: "Refine with new information",
    supplementCluePlaceholder: "New clue, e.g. related to sound",
    supplementGuessPlaceholder: "High-score guess, e.g. 听雨",
    supplementScorePlaceholder: "Similarity %, e.g. 44.9",
    refineButton: "Refine analysis",
    refineWaiting: "Refinement: waiting",

    aiResultsSummary: "AI Results",
    rawAiSummary: "Full AI response optional",
    savedAiTitle: "Saved AI Analysis",
    candidateTitle: "Candidate Answers",
    searchCandidatePlaceholder: "Search candidates, e.g. 光阴",
    followupTitle: "Follow-up History",

    ocrSummary: "Screenshot OCR",
    manualSummary: "Manual Input / Local Analysis",
    aiActionsSummary: "AI Tools / Prompt",
    importSummary: "Import / Export",

    languageButton: "中文"
  }
};

let currentLanguage = localStorage.getItem(I18N_STORAGE_KEY) || "zh";

export function getCurrentLanguage() {
  return currentLanguage;
}

export function t(key) {
  return translations[currentLanguage]?.[key] || translations.zh[key] || key;
}

export function applyLanguage() {
  const dict = translations[currentLanguage] || translations.zh;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (dict[key]) {
      element.textContent = dict[key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (dict[key]) {
      element.placeholder = dict[key];
    }
  });

  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";

  const languageToggleBtn = document.getElementById("languageToggleBtn");
  if (languageToggleBtn) {
    languageToggleBtn.textContent = dict.languageButton;
  }
}

export function toggleLanguage() {
  currentLanguage = currentLanguage === "zh" ? "en" : "zh";
  localStorage.setItem(I18N_STORAGE_KEY, currentLanguage);
  applyLanguage();
}

export function setupLanguageToggle() {
  const languageToggleBtn = document.getElementById("languageToggleBtn");

  if (!languageToggleBtn) {
    return;
  }

  languageToggleBtn.addEventListener("click", toggleLanguage);
  applyLanguage();
}