export const dom = {
  modeSelect: document.getElementById("mode"),
  cluesInput: document.getElementById("clues"),

  guessWordInput: document.getElementById("guessWord"),
  guessScoreInput: document.getElementById("guessScore"),
  guessHistoryInput: document.getElementById("guessHistory"),
  customWordsInput: document.getElementById("customWords"),

  candidateWordInput: document.getElementById("candidateWord"),
  candidateKeywordsInput: document.getElementById("candidateKeywords"),
  candidateReasonInput: document.getElementById("candidateReason"),

  addGuessBtn: document.getElementById("addGuessBtn"),
  addCandidateBtn: document.getElementById("addCandidateBtn"),
  exampleBtn: document.getElementById("exampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  copyBtn: document.getElementById("copyBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),

  resultList: document.getElementById("resultList"),
  saveStatus: document.getElementById("saveStatus"),

  aiPromptInput: document.getElementById("aiPrompt"),
  aiResponseInput: document.getElementById("aiResponse"),
  saveAiResponseBtn: document.getElementById("saveAiResponseBtn"),
  copyAiResponseBtn: document.getElementById("copyAiResponseBtn"),
  savedAiResponseBox: document.getElementById("savedAiResponse"),
  aiCandidateCardsBox: document.getElementById("aiCandidateCards"),
  followupHistoryBox: document.getElementById("followupHistory"),
  aiCardLimitSelect: document.getElementById("aiCardLimit"),
  aiCardSearchInput: document.getElementById("aiCardSearch"),

  promptBtn: document.getElementById("promptBtn"),
  backendAnalyzeBtn: document.getElementById("backendAnalyzeBtn"),

  importJsonInput: document.getElementById("importJson"),

  ocrImageInput: document.getElementById("ocrImageInput"),
  ocrImagePreview: document.getElementById("ocrImagePreview"),
  ocrImageWrapper: document.getElementById("ocrImageWrapper"),
  ocrSelectionBox: document.getElementById("ocrSelectionBox"),

  ocrCropXInput: document.getElementById("ocrCropX"),
  ocrCropYInput: document.getElementById("ocrCropY"),
  ocrCropWidthInput: document.getElementById("ocrCropWidth"),
  ocrCropHeightInput: document.getElementById("ocrCropHeight"),
  clearOcrCropBtn: document.getElementById("clearOcrCropBtn"),
  ocrCropInfo: document.getElementById("ocrCropInfo"),

  ocrUsePreprocessInput: document.getElementById("ocrUsePreprocess"),
  ocrScaleSelect: document.getElementById("ocrScale"),
  previewPreprocessBtn: document.getElementById("previewPreprocessBtn"),
  preprocessImagePreview: document.getElementById("preprocessImagePreview"),

  cropFullBtn: document.getElementById("cropFullBtn"),
  cropTopBtn: document.getElementById("cropTopBtn"),
  cropBottomBtn: document.getElementById("cropBottomBtn"),
  cropLeftBtn: document.getElementById("cropLeftBtn"),
  cropRightBtn: document.getElementById("cropRightBtn"),
  cropCenterBtn: document.getElementById("cropCenterBtn"),

  saveHintPresetBtn: document.getElementById("saveHintPresetBtn"),
  applyHintPresetBtn: document.getElementById("applyHintPresetBtn"),
  saveGuessPresetBtn: document.getElementById("saveGuessPresetBtn"),
  applyGuessPresetBtn: document.getElementById("applyGuessPresetBtn"),
  ocrRegionPresetInfo: document.getElementById("ocrRegionPresetInfo"),

  ocrBtn: document.getElementById("ocrBtn"),
  ocrHintRegionBtn: document.getElementById("ocrHintRegionBtn"),
  ocrGuessRegionBtn: document.getElementById("ocrGuessRegionBtn"),
  ocrStatus: document.getElementById("ocrStatus"),
  ocrResultInput: document.getElementById("ocrResult"),
  ocrHintTextInput: document.getElementById("ocrHintText"),
  ocrGuessTextInput: document.getElementById("ocrGuessText"),
  mergeOcrRegionsBtn: document.getElementById("mergeOcrRegionsBtn"),

  useOcrTextBtn: document.getElementById("useOcrTextBtn"),
  cleanOcrBtn: document.getElementById("cleanOcrBtn"),
  ocrCluePreview: document.getElementById("ocrCluePreview"),
  ocrGuessPreview: document.getElementById("ocrGuessPreview"),
  ocrNoisePreview: document.getElementById("ocrNoisePreview"),
  ocrModePreview: document.getElementById("ocrModePreview"),
  applyOcrParsedBtn: document.getElementById("applyOcrParsedBtn"),
  ocrPromptBtn: document.getElementById("ocrPromptBtn"),
  ocrBackendAnalyzeBtn: document.getElementById("ocrBackendAnalyzeBtn"),
  autoOcrAnalyzeBtn: document.getElementById("autoOcrAnalyzeBtn"),
  ocrFlowLog: document.getElementById("ocrFlowLog"),

  generateOcrReportBtn: document.getElementById("generateOcrReportBtn"),
  copyOcrReportBtn: document.getElementById("copyOcrReportBtn"),
  downloadOcrReportBtn: document.getElementById("downloadOcrReportBtn"),
  ocrDebugReportInput: document.getElementById("ocrDebugReport"),

  visionAnalyzeBtn: document.getElementById("visionAnalyzeBtn"),
  visionStatus: document.getElementById("visionStatus")
};