export function setupEventListeners({
  dom,
  handlers,
  getLatestAiJson
}) {
  const {
    addGuess,
    addCandidate,
    fillExample,
    clearInputs,
    analyzeClues,
    copyResults,
    exportCurrentData,
    generateAiPrompt,
    analyzeWithBackend,
    saveAiResponse,
    importCurrentData,
    previewOcrImage,
    recognizeImageText,
    useOcrTextAsClues,
    cleanOcrText,
    applyOcrParsedResult,
    generateOcrLivePrompt,
    analyzeOcrWithBackend,
    saveToLocalStorage,
    renderAiCards,
    clearOcrCropSettings,
    startOcrAreaSelection,
    updateOcrAreaSelection,
    finishOcrAreaSelection,
    previewPreprocessedOcrImage,
    applyOcrCropPreset,
    recognizeOcrRegion,
    mergeOcrRegions,
    saveOcrRegionPreset,
    applyOcrRegionPreset,
    runAutoOcrAnalyze,
    generateOcrDebugReport,
    copyOcrDebugReport,
    downloadOcrDebugReport,
    updateOcrCropInfo,
    updateOcrSelectionBoxFromInputs,
    copyAiResponse
  } = handlers;

  dom.addGuessBtn?.addEventListener("click", addGuess);
  dom.addCandidateBtn?.addEventListener("click", addCandidate);
  dom.exampleBtn?.addEventListener("click", fillExample);
  dom.clearBtn?.addEventListener("click", clearInputs);
  dom.analyzeBtn?.addEventListener("click", analyzeClues);
  dom.copyBtn?.addEventListener("click", copyResults);
  dom.exportBtn?.addEventListener("click", exportCurrentData);
  dom.promptBtn?.addEventListener("click", generateAiPrompt);
  dom.backendAnalyzeBtn?.addEventListener("click", analyzeWithBackend);
  dom.saveAiResponseBtn?.addEventListener("click", saveAiResponse);
  dom.copyAiResponseBtn?.addEventListener("click", copyAiResponse);
  dom.importBtn?.addEventListener("click", importCurrentData);

  dom.ocrImageInput?.addEventListener("change", previewOcrImage);
  dom.ocrBtn?.addEventListener("click", recognizeImageText);
  dom.useOcrTextBtn?.addEventListener("click", useOcrTextAsClues);
  dom.cleanOcrBtn?.addEventListener("click", cleanOcrText);
  dom.applyOcrParsedBtn?.addEventListener("click", applyOcrParsedResult);
  dom.ocrPromptBtn?.addEventListener("click", generateOcrLivePrompt);
  dom.ocrBackendAnalyzeBtn?.addEventListener("click", analyzeOcrWithBackend);

  dom.ocrUsePreprocessInput?.addEventListener("change", saveToLocalStorage);
  dom.ocrScaleSelect?.addEventListener("change", saveToLocalStorage);

  dom.aiCardLimitSelect?.addEventListener("change", () => {
    renderAiCards(getLatestAiJson());
    saveToLocalStorage();
  });

  dom.aiCardSearchInput?.addEventListener("input", () => {
    renderAiCards(getLatestAiJson());
    saveToLocalStorage();
  });

  dom.clearOcrCropBtn?.addEventListener("click", clearOcrCropSettings);

  if (dom.ocrImageWrapper) {
    dom.ocrImageWrapper.addEventListener("mousedown", startOcrAreaSelection);
    dom.ocrImageWrapper.addEventListener("mousemove", updateOcrAreaSelection);
    window.addEventListener("mouseup", finishOcrAreaSelection);

    dom.ocrImageWrapper.addEventListener("touchstart", (event) => {
      startOcrAreaSelection(event.touches[0]);
    });

    dom.ocrImageWrapper.addEventListener("touchmove", (event) => {
      event.preventDefault();
      updateOcrAreaSelection(event.touches[0]);
    });

    dom.ocrImageWrapper.addEventListener("touchend", (event) => {
      if (event.changedTouches.length > 0) {
        finishOcrAreaSelection(event.changedTouches[0]);
      }
    });
  }

  dom.previewPreprocessBtn?.addEventListener("click", previewPreprocessedOcrImage);

  dom.cropFullBtn?.addEventListener("click", () => applyOcrCropPreset("full"));
  dom.cropTopBtn?.addEventListener("click", () => applyOcrCropPreset("top"));
  dom.cropBottomBtn?.addEventListener("click", () => applyOcrCropPreset("bottom"));
  dom.cropLeftBtn?.addEventListener("click", () => applyOcrCropPreset("left"));
  dom.cropRightBtn?.addEventListener("click", () => applyOcrCropPreset("right"));
  dom.cropCenterBtn?.addEventListener("click", () => applyOcrCropPreset("center"));

  dom.ocrHintRegionBtn?.addEventListener("click", () => recognizeOcrRegion("hint"));
  dom.ocrGuessRegionBtn?.addEventListener("click", () => recognizeOcrRegion("guess"));
  dom.mergeOcrRegionsBtn?.addEventListener("click", mergeOcrRegions);

  dom.saveHintPresetBtn?.addEventListener("click", () => saveOcrRegionPreset("hint"));
  dom.applyHintPresetBtn?.addEventListener("click", () => applyOcrRegionPreset("hint"));
  dom.saveGuessPresetBtn?.addEventListener("click", () => saveOcrRegionPreset("guess"));
  dom.applyGuessPresetBtn?.addEventListener("click", () => applyOcrRegionPreset("guess"));

  dom.autoOcrAnalyzeBtn?.addEventListener("click", runAutoOcrAnalyze);

  dom.generateOcrReportBtn?.addEventListener("click", generateOcrDebugReport);
  dom.copyOcrReportBtn?.addEventListener("click", copyOcrDebugReport);
  dom.downloadOcrReportBtn?.addEventListener("click", downloadOcrDebugReport);

  [
    dom.ocrCropXInput,
    dom.ocrCropYInput,
    dom.ocrCropWidthInput,
    dom.ocrCropHeightInput
  ].forEach((input) => {
    if (!input) return;

    input.addEventListener("input", () => {
      updateOcrCropInfo();
      updateOcrSelectionBoxFromInputs();
      saveToLocalStorage();
    });
  });

  const autoSaveInputs = [
    dom.modeSelect,
    dom.cluesInput,
    dom.guessWordInput,
    dom.guessScoreInput,
    dom.guessHistoryInput,
    dom.candidateWordInput,
    dom.candidateKeywordsInput,
    dom.candidateReasonInput,
    dom.customWordsInput,
    dom.aiPromptInput,
    dom.aiResponseInput,
    dom.ocrResultInput,
    dom.ocrCropXInput,
    dom.ocrCropYInput,
    dom.ocrCropWidthInput,
    dom.ocrCropHeightInput,
    dom.ocrHintTextInput,
    dom.ocrGuessTextInput,
    dom.importJsonInput
  ];

  autoSaveInputs.forEach((input) => {
    if (!input) return;

    input.addEventListener("input", saveToLocalStorage);
    input.addEventListener("change", saveToLocalStorage);
  });
}