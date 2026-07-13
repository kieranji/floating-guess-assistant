import { saveJson, loadJson, removeItem } from "./js/storage.js";
import {
  parseOcrGuessText,
  parseGuessHistory,
  parseCustomWords
} from "./js/parser.js";
import { calculateConfidence } from "./js/scoring.js";
import {
  buildGeneralAiPrompt,
  buildOcrLivePrompt,
  analyzeWithAiBackend
} from "./js/ai.js";
import {
  createCroppedOcrImage,
  preprocessOcrImage,
  runOcrOnImage
} from "./js/ocr.js";
import {
  getCropSettingsFromInputs,
  getImageSize,
  calculateCropPreset,
  calculateSelectionBoxFromCrop,
  convertDisplaySelectionToImageCrop
} from "./js/ocrCrop.js";
import {
  wait,
  updateText,
  checkElements,
  loadSectionStates,
  setupSectionStateSaving,
  setupQuickNav
} from "./js/ui.js";
import {
  renderAiCandidateCards,
  renderFollowupHistoryList,
  renderLocalResults,
  renderOcrPreview
} from "./js/render.js";
import {
  buildOcrDebugReport,
  createTextDownload
} from "./js/ocrReport.js";
import { dom } from "./js/dom.js";

const {
  modeSelect,
  cluesInput,

  guessWordInput,
  guessScoreInput,
  guessHistoryInput,
  customWordsInput,

  candidateWordInput,
  candidateKeywordsInput,
  candidateReasonInput,

  addGuessBtn,
  addCandidateBtn,
  exampleBtn,
  clearBtn,
  analyzeBtn,
  copyBtn,
  exportBtn,
  importBtn,

  resultList,
  saveStatus,

  aiPromptInput,
  aiResponseInput,
  saveAiResponseBtn,
  copyAiResponseBtn,
  savedAiResponseBox,
  aiCandidateCardsBox,
  followupHistoryBox,
  aiCardLimitSelect,
  aiCardSearchInput,

  promptBtn,
  backendAnalyzeBtn,

  importJsonInput,

  ocrImageInput,
  ocrImagePreview,
  ocrImageWrapper,
  ocrSelectionBox,

  ocrCropXInput,
  ocrCropYInput,
  ocrCropWidthInput,
  ocrCropHeightInput,
  clearOcrCropBtn,
  ocrCropInfo,

  ocrUsePreprocessInput,
  ocrScaleSelect,
  previewPreprocessBtn,
  preprocessImagePreview,

  cropFullBtn,
  cropTopBtn,
  cropBottomBtn,
  cropLeftBtn,
  cropRightBtn,
  cropCenterBtn,

  saveHintPresetBtn,
  applyHintPresetBtn,
  saveGuessPresetBtn,
  applyGuessPresetBtn,
  ocrRegionPresetInfo,

  ocrBtn,
  ocrHintRegionBtn,
  ocrGuessRegionBtn,
  ocrStatus,
  ocrResultInput,
  ocrHintTextInput,
  ocrGuessTextInput,
  mergeOcrRegionsBtn,

  useOcrTextBtn,
  cleanOcrBtn,
  ocrCluePreview,
  ocrGuessPreview,
  ocrNoisePreview,
  ocrModePreview,
  applyOcrParsedBtn,
  ocrPromptBtn,
  ocrBackendAnalyzeBtn,
  autoOcrAnalyzeBtn,
  ocrFlowLog,

  generateOcrReportBtn,
  copyOcrReportBtn,
  downloadOcrReportBtn,
  ocrDebugReportInput
} = dom;
const BACKEND_URL = APP_CONFIG.backendUrl;

function checkRequiredElements() {
  checkElements({
    modeSelect,
    cluesInput,
    guessWordInput,
    guessScoreInput,
    guessHistoryInput,
    customWordsInput,
    candidateWordInput,
    candidateKeywordsInput,
    candidateReasonInput,
    addGuessBtn,
    addCandidateBtn,
    exampleBtn,
    clearBtn,
    analyzeBtn,
    copyBtn,
    importBtn,
    resultList,
    saveStatus,
    exportBtn,
    aiResponseInput,
    saveAiResponseBtn,
    copyAiResponseBtn,
    savedAiResponseBox,
    aiCandidateCardsBox,
    followupHistoryBox,
    aiCardLimitSelect,
    aiCardSearchInput,
    importJsonInput,
    promptBtn,
    backendAnalyzeBtn,
    aiPromptInput,
    ocrImageInput,
    ocrImagePreview,
    ocrImageWrapper,
    ocrSelectionBox,
    ocrCropXInput,
    ocrCropYInput,
    ocrCropWidthInput,
    ocrCropHeightInput,
    clearOcrCropBtn,
    ocrUsePreprocessInput,
    ocrScaleSelect,
    previewPreprocessBtn,
    preprocessImagePreview,
    ocrCropInfo,
    cropFullBtn,
    cropTopBtn,
    cropBottomBtn,
    cropLeftBtn,
    cropRightBtn,
    cropCenterBtn,
    ocrBtn,
    ocrStatus,
    ocrResultInput,
    useOcrTextBtn,
    cleanOcrBtn,
    ocrCluePreview,
    ocrGuessPreview,
    ocrNoisePreview,
    ocrModePreview,
    applyOcrParsedBtn,
    ocrPromptBtn,
    ocrBackendAnalyzeBtn,
    autoOcrAnalyzeBtn,
    ocrFlowLog,
    ocrHintRegionBtn,
    ocrGuessRegionBtn,
    ocrHintTextInput,
    ocrGuessTextInput,
    mergeOcrRegionsBtn,
    saveHintPresetBtn,
    applyHintPresetBtn,
    saveGuessPresetBtn,
    applyGuessPresetBtn,
    ocrRegionPresetInfo,
    generateOcrReportBtn,
    copyOcrReportBtn,
    downloadOcrReportBtn,
    ocrDebugReportInput
  });
}

async function loadWordBank() {
  try {
    const response = await fetch("data/wordBank.json");

    if (!response.ok) {
      throw new Error("词库加载失败");
    }

    wordBank = await response.json();
    console.log("词库加载成功：", wordBank);
  } catch (error) {
    console.error(error);

    resultList.innerHTML = "";
    const li = document.createElement("li");
    li.textContent = "词库加载失败，请检查 data/wordBank.json 是否存在。";
    resultList.appendChild(li);
  }
}

function previewOcrImage() {
  if (!ocrImageInput || !ocrImageInput.files || ocrImageInput.files.length === 0) {
    return;
  }

  const file = ocrImageInput.files[0];

  if (!file.type.startsWith("image/")) {
    alert("请选择图片文件。");
    return;
  }

  const imageUrl = URL.createObjectURL(file);

  if (ocrImagePreview) {
    ocrImagePreview.src = imageUrl;
    ocrImagePreview.style.display = "block";

    ocrImagePreview.onload = () => {
      updateOcrCropInfo();
      updateOcrSelectionBoxFromInputs();
    };
  }

  if (ocrStatus) {
    ocrStatus.textContent = "图片已加载，可以开始 OCR 识别。";
  }
}

function getPointerPositionInImage(event) {
  if (!ocrImagePreview) {
    return null;
  }

  const rect = ocrImagePreview.getBoundingClientRect();

  const clientX = event.clientX;
  const clientY = event.clientY;

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
    return null;
  }

  return {
    x,
    y,
    rect
  };
}

function resetOcrFlowLog() {
  if (ocrFlowLog) {
    ocrFlowLog.textContent = "";
  }
}

function addOcrFlowLog(message) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${message}`;

  if (ocrFlowLog) {
    if (!ocrFlowLog.textContent || ocrFlowLog.textContent === "暂无流程日志。") {
      ocrFlowLog.textContent = line;
    } else {
      ocrFlowLog.textContent += `\n${line}`;
    }

    ocrFlowLog.scrollTop = ocrFlowLog.scrollHeight;
  }

  console.log(line);
}

function startOcrAreaSelection(event) {
  const position = getPointerPositionInImage(event);

  if (!position) {
    return;
  }

  isSelectingOcrArea = true;
  ocrSelectionStart = position;

  if (ocrSelectionBox) {
    ocrSelectionBox.style.display = "block";
    ocrSelectionBox.style.left = `${position.x}px`;
    ocrSelectionBox.style.top = `${position.y}px`;
    ocrSelectionBox.style.width = "0px";
    ocrSelectionBox.style.height = "0px";
  }
}

function updateOcrAreaSelection(event) {
  if (!isSelectingOcrArea || !ocrSelectionStart || !ocrSelectionBox) {
    return;
  }

  const position = getPointerPositionInImage(event);

  if (!position) {
    return;
  }

  const x1 = ocrSelectionStart.x;
  const y1 = ocrSelectionStart.y;
  const x2 = position.x;
  const y2 = position.y;

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  ocrSelectionBox.style.left = `${left}px`;
  ocrSelectionBox.style.top = `${top}px`;
  ocrSelectionBox.style.width = `${width}px`;
  ocrSelectionBox.style.height = `${height}px`;
}

function finishOcrAreaSelection(event) {
  if (!isSelectingOcrArea || !ocrSelectionStart) {
    return;
  }

  const position = getPointerPositionInImage(event);

  isSelectingOcrArea = false;

  if (!position || !ocrImagePreview) {
    return;
  }

  const x1 = ocrSelectionStart.x;
  const y1 = ocrSelectionStart.y;
  const x2 = position.x;
  const y2 = position.y;

  const displayLeft = Math.min(x1, x2);
  const displayTop = Math.min(y1, y2);
  const displayWidth = Math.abs(x2 - x1);
  const displayHeight = Math.abs(y2 - y1);

  if (displayWidth < 10 || displayHeight < 10) {
    return;
  }

  const crop = convertDisplaySelectionToImageCrop({
    displayLeft,
    displayTop,
    displayWidth,
    displayHeight,
    imageElement: ocrImagePreview
  });

  if (!crop) {
    return;
  }

  if (ocrCropXInput) ocrCropXInput.value = crop.x;
  if (ocrCropYInput) ocrCropYInput.value = crop.y;
  if (ocrCropWidthInput) ocrCropWidthInput.value = crop.width;
  if (ocrCropHeightInput) ocrCropHeightInput.value = crop.height;

  if (ocrStatus) {
    ocrStatus.textContent = `已选择 OCR 区域：x=${crop.x}, y=${crop.y}, 宽=${crop.width}, 高=${crop.height}`;
  }  

  updateOcrCropInfo();
  saveToLocalStorage();
}

function updateOcrCropInfo() {
  if (!ocrCropInfo) {
    return;
  }

  const crop = getOcrCropSettings();

  if (!crop) {
    ocrCropInfo.textContent = "当前识别区域：整张图片";
    return;
  }

  ocrCropInfo.textContent = `当前识别区域：x=${crop.x}, y=${crop.y}, 宽=${crop.width}, 高=${crop.height}`;
}

function setOcrCropValues(x, y, width, height) {
  if (ocrCropXInput) ocrCropXInput.value = Math.round(x);
  if (ocrCropYInput) ocrCropYInput.value = Math.round(y);
  if (ocrCropWidthInput) ocrCropWidthInput.value = Math.round(width);
  if (ocrCropHeightInput) ocrCropHeightInput.value = Math.round(height);

  updateOcrCropInfo();
  updateOcrSelectionBoxFromInputs();
  saveToLocalStorage();
}

function getCurrentImageSize() {
  const imageSize = getImageSize(ocrImagePreview);

  if (!imageSize) {
    alert("请先上传图片。");
    return null;
  }

  return imageSize;
}

function applyOcrCropPreset(preset) {
  const imageSize = getCurrentImageSize();

  if (!imageSize) {
    return;
  }

  if (preset === "full") {
    clearOcrCropSettings();
    return;
  }

  const crop = calculateCropPreset(preset, imageSize);

  if (!crop) {
    return;
  }

  setOcrCropValues(crop.x, crop.y, crop.width, crop.height);
}

function getCurrentCropOrAlert() {
  const crop = getOcrCropSettings();

  if (!crop) {
    alert("请先框选或填写一个 OCR 区域。");
    return null;
  }

  return crop;
}

function saveOcrRegionPreset(type) {
  const crop = getCurrentCropOrAlert();

  if (!crop) {
    return;
  }

  ocrRegionPresets[type] = {
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height
  };

  updateOcrRegionPresetInfo();
  saveToLocalStorage();

  const label = type === "hint" ? "提示区" : "猜测区";
  alert(`已保存当前区域为${label}预设。`);
}

function applyOcrRegionPreset(type) {
  const preset = ocrRegionPresets[type];

  if (!preset) {
    const label = type === "hint" ? "提示区" : "猜测区";
    alert(`还没有保存${label}预设。`);
    return;
  }

  setOcrCropValues(preset.x, preset.y, preset.width, preset.height);

  const label = type === "hint" ? "提示区" : "猜测区";

  if (ocrStatus) {
    ocrStatus.textContent = `已应用${label}预设。`;
  }
}

function updateOcrRegionPresetInfo() {
  if (!ocrRegionPresetInfo) {
    return;
  }

  const hint = ocrRegionPresets.hint;
  const guess = ocrRegionPresets.guess;

  const hintText = hint
    ? `提示区：x=${hint.x}, y=${hint.y}, 宽=${hint.width}, 高=${hint.height}`
    : "提示区：未保存";

  const guessText = guess
    ? `猜测区：x=${guess.x}, y=${guess.y}, 宽=${guess.width}, 高=${guess.height}`
    : "猜测区：未保存";

  ocrRegionPresetInfo.textContent = `${hintText}；${guessText}`;
}

function updateOcrSelectionBoxFromInputs() {
  const crop = getOcrCropSettings();
  const box = calculateSelectionBoxFromCrop({
    crop,
    imageElement: ocrImagePreview
  });

  if (!ocrSelectionBox || !box) {
    if (ocrSelectionBox) {
      ocrSelectionBox.style.display = "none";
    }

    return;
  }

  ocrSelectionBox.style.display = "block";
  ocrSelectionBox.style.left = `${box.left}px`;
  ocrSelectionBox.style.top = `${box.top}px`;
  ocrSelectionBox.style.width = `${box.width}px`;
  ocrSelectionBox.style.height = `${box.height}px`;
}

function getOcrCropSettings() {
  return getCropSettingsFromInputs({
    xInput: ocrCropXInput,
    yInput: ocrCropYInput,
    widthInput: ocrCropWidthInput,
    heightInput: ocrCropHeightInput
  });
}

function clearOcrCropSettings() {
  if (ocrCropXInput) ocrCropXInput.value = "";
  if (ocrCropYInput) ocrCropYInput.value = "";
  if (ocrCropWidthInput) ocrCropWidthInput.value = "";
  if (ocrCropHeightInput) ocrCropHeightInput.value = "";

  if (ocrSelectionBox) {
    ocrSelectionBox.style.display = "none";
    ocrSelectionBox.style.left = "0px";
    ocrSelectionBox.style.top = "0px";
    ocrSelectionBox.style.width = "0px";
    ocrSelectionBox.style.height = "0px";
  }

  if (ocrStatus) {
    ocrStatus.textContent = "已清除裁剪区域，将识别整张图片。";
  }

  saveToLocalStorage();
  updateOcrCropInfo();
}

async function previewPreprocessedOcrImage() {
  if (!ocrImageInput || !ocrImageInput.files || ocrImageInput.files.length === 0) {
    alert("请先选择一张图片。");
    return;
  }

  const file = ocrImageInput.files[0];
  const crop = getOcrCropSettings();

  if (previewPreprocessBtn) {
    previewPreprocessBtn.disabled = true;
    previewPreprocessBtn.textContent = "生成预览中...";
  }

  try {
    const previewUrl = URL.createObjectURL(processedImage);
    const croppedImage = await createCroppedOcrImage(file, crop);

    const processedImage = await preprocessOcrImage(croppedImage, {
      usePreprocess: ocrUsePreprocessInput ? ocrUsePreprocessInput.checked : true,
      scale: ocrScaleSelect ? Number(ocrScaleSelect.value) || 2 : 2
    });

    if (preprocessImagePreview) {
      preprocessImagePreview.src = previewUrl;
      preprocessImagePreview.style.display = "block";
    }

    if (ocrStatus) {
      ocrStatus.textContent = "预处理图片已生成，可对比后再 OCR。";
    }
  } catch (error) {
    console.error(error);
    alert("生成预处理图片失败。");
  } finally {
    if (previewPreprocessBtn) {
      previewPreprocessBtn.disabled = false;
      previewPreprocessBtn.textContent = "预览预处理图片";
    }
  }
}

async function runOcrOnCurrentImage() {
  if (!ocrImageInput || !ocrImageInput.files || ocrImageInput.files.length === 0) {
    throw new Error("请先选择一张图片。");
  }

  const file = ocrImageInput.files[0];
  const crop = getOcrCropSettings();

  const usePreprocess = ocrUsePreprocessInput
    ? ocrUsePreprocessInput.checked
    : true;

  const scale = ocrScaleSelect ? Number(ocrScaleSelect.value) || 2 : 2;

  return runOcrOnImage({
    file,
    crop,
    usePreprocess,
    scale,
    logger: (message) => {
      if (message.status === "recognizing text") {
        const progress = Math.round(message.progress * 100);

        if (ocrStatus) {
          ocrStatus.textContent = `正在识别文字：${progress}%`;
        }
      } else if (ocrStatus) {
        ocrStatus.textContent = `OCR 状态：${message.status}`;
      }
    }
  });
}

async function recognizeImageText() {
  if (!ocrBtn) {
    return;
  }

  ocrBtn.disabled = true;
  ocrBtn.textContent = "识别中...";

  if (ocrStatus) {
    ocrStatus.textContent = "OCR 正在识别当前区域，请稍等。";
  }

  try {
    const text = await runOcrOnCurrentImage();

    if (ocrResultInput) {
      ocrResultInput.value = text || "没有识别到文字。";
    }

    if (ocrStatus) {
      ocrStatus.textContent = "OCR 识别完成。";
    }

    saveToLocalStorage();
  } catch (error) {
    console.error(error);
    if (ocrStatus) {
      ocrStatus.textContent = "OCR 识别失败。";
    }
    alert(error.message || "OCR 识别失败，请换一张更清晰的图片。");
  } finally {
    ocrBtn.disabled = false;
    ocrBtn.textContent = "识别当前区域";
  }
}

async function recognizeOcrRegion(target) {
  const button = target === "hint" ? ocrHintRegionBtn : ocrGuessRegionBtn;
  const output = target === "hint" ? ocrHintTextInput : ocrGuessTextInput;
  const label = target === "hint" ? "提示区" : "猜测区";

  if (!button || !output) {
    return;
  }

  button.disabled = true;
  button.textContent = `${label}识别中...`;

  if (ocrStatus) {
    ocrStatus.textContent = `正在识别${label}。`;
  }

  try {
    const text = await runOcrOnCurrentImage();

    output.value = text || "没有识别到文字。";

    if (ocrStatus) {
      ocrStatus.textContent = `${label} OCR 识别完成。`;
    }

    saveToLocalStorage();
  } catch (error) {
    console.error(error);
    alert(`${label} OCR 失败：${error.message || "未知错误"}`);
  } finally {
    button.disabled = false;
    button.textContent = target === "hint" ? "识别为提示区" : "识别为猜测区";
  }
}

async function recognizeOcrRegionSilent(target) {
  const output = target === "hint" ? ocrHintTextInput : ocrGuessTextInput;
  const label = target === "hint" ? "提示区" : "猜测区";

  if (!output) {
    throw new Error(`${label}输出框不存在。`);
  }

  if (ocrStatus) {
    ocrStatus.textContent = `自动流程：正在识别${label}...`;
  }

  const text = await runOcrOnCurrentImage();

  output.value = text || "没有识别到文字。";

  if (ocrStatus) {
    ocrStatus.textContent = `自动流程：${label}识别完成。`;
  }

  saveToLocalStorage();

  return text;
}

function mergeOcrRegions() {
  const hintText = ocrHintTextInput ? ocrHintTextInput.value.trim() : "";
  const guessText = ocrGuessTextInput ? ocrGuessTextInput.value.trim() : "";

  if (!hintText && !guessText) {
    alert("提示区和猜测区都没有内容。");
    return;
  }

  const mergedText = [hintText, guessText].filter(Boolean).join("\n");

  if (ocrResultInput) {
    ocrResultInput.value = mergedText;
  }

  saveToLocalStorage();
  alert("已合并提示区和猜测区 OCR 文本。现在可以点击“清洗 OCR 文本”。");
}

function mergeOcrRegionsSilent() {
  const hintText = ocrHintTextInput ? ocrHintTextInput.value.trim() : "";
  const guessText = ocrGuessTextInput ? ocrGuessTextInput.value.trim() : "";

  if (!hintText && !guessText) {
    throw new Error("提示区和猜测区都没有内容。");
  }

  const mergedText = [hintText, guessText].filter(Boolean).join("\n");

  if (ocrResultInput) {
    ocrResultInput.value = mergedText;
  }

  saveToLocalStorage();

  return mergedText;
}

function useOcrTextAsClues() {
  const text = ocrResultInput.value.trim();

  if (!text) {
    alert("没有可填入的 OCR 文字。");
    return;
  }

  if (cluesInput.value.trim().length === 0) {
    cluesInput.value = text;
  } else {
    cluesInput.value += `\n${text}`;
  }

  saveToLocalStorage();
  alert("OCR 文字已填入线索。");
}

function cleanOcrText() {
  if (!ocrResultInput) {
    return;
  }

  const rawText = ocrResultInput.value.trim();

  if (!rawText) {
    alert("请先进行 OCR 识别，或把 OCR 文本粘贴到识别结果框。");
    return;
  }

  const parsed = parseOcrGuessText(rawText);
  latestOcrParsed = parsed;

  const modeText = autoSelectModeFromOcr(parsed);

  renderOcrPreview({
    cluePreview: ocrCluePreview,
    guessPreview: ocrGuessPreview,
    noisePreview: ocrNoisePreview,
    modePreview: ocrModePreview,
    parsed,
    modeText
  });

  saveToLocalStorage();

  alert(`清洗完成：提取到 ${parsed.clues.length} 条线索，${parsed.guesses.length} 条历史猜测。请检查预览后点击“应用 OCR 清洗结果”。`);
}

function cleanOcrTextSilent() {
  if (!ocrResultInput) {
    throw new Error("OCR 结果框不存在。");
  }

  const rawText = ocrResultInput.value.trim();

  if (!rawText) {
    throw new Error("OCR 文本为空。");
  }

  const parsed = parseOcrGuessText(rawText);
  latestOcrParsed = parsed;

  const modeText = autoSelectModeFromOcr(parsed);

  renderOcrPreview({
    cluePreview: ocrCluePreview,
    guessPreview: ocrGuessPreview,
    noisePreview: ocrNoisePreview,
    modePreview: ocrModePreview,
    parsed,
    modeText
  });

  saveToLocalStorage();

  return parsed;
}

function mergeUniqueLines(existingText, newText) {
  const existingLines = existingText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const newLines = newText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set(existingLines);
  const mergedLines = [...existingLines];

  newLines.forEach((line) => {
    if (!seen.has(line)) {
      seen.add(line);
      mergedLines.push(line);
    }
  });

  return mergedLines.join("\n");
}

function applyOcrParsedResult() {
  if (!ocrCluePreview || !ocrGuessPreview) {
    alert("OCR 预览区域不存在。");
    return;
  }

  const clueText = ocrCluePreview.value.trim();
  const guessText = ocrGuessPreview.value.trim();

  if (!clueText && !guessText) {
    alert("没有可应用的 OCR 清洗结果。");
    return;
  }

  if (clueText) {
    cluesInput.value = mergeUniqueLines(cluesInput.value, clueText);
  }

  if (guessText) {
    guessHistoryInput.value = mergeUniqueLines(guessHistoryInput.value, guessText);
  }

  analyzeClues();
  saveToLocalStorage();

  alert("已应用 OCR 清洗结果，并已自动更新本地分析。");
}

function applyOcrParsedResultSilent() {
  if (!ocrCluePreview || !ocrGuessPreview) {
    throw new Error("OCR 预览区域不存在。");
  }

  const clueText = ocrCluePreview.value.trim();
  const guessText = ocrGuessPreview.value.trim();

  if (!clueText && !guessText) {
    throw new Error("没有可应用的 OCR 清洗结果。");
  }

  if (clueText) {
    cluesInput.value = mergeUniqueLines(cluesInput.value, clueText);
  }

  if (guessText) {
    guessHistoryInput.value = mergeUniqueLines(guessHistoryInput.value, guessText);
  }

  analyzeClues();
  saveToLocalStorage();
}

function generateOcrLivePrompt() {
  const rawOcrText = ocrResultInput ? ocrResultInput.value.trim() : "";
  const clueText = ocrCluePreview ? ocrCluePreview.value.trim() : "";
  const guessText = ocrGuessPreview ? ocrGuessPreview.value.trim() : "";
  const noiseText = ocrNoisePreview ? ocrNoisePreview.textContent.trim() : "";

  if (!rawOcrText && !clueText && !guessText) {
    alert("请先进行 OCR 识别或清洗 OCR 文本。");
    return;
  }

  const prompt = buildOcrLivePrompt({
    rawOcrText,
    clueText,
    guessText,
    noiseText
  });

  aiPromptInput.value = prompt;

  navigator.clipboard
    .writeText(prompt)
    .then(() => {
      alert("直播截图分析 Prompt 已生成并复制。");
    })
    .catch(() => {
      alert("直播截图分析 Prompt 已生成，请手动复制。");
    });

  saveToLocalStorage();
}

async function analyzeOcrWithBackend() {
  const rawOcrText = ocrResultInput ? ocrResultInput.value.trim() : "";
  const clueText = ocrCluePreview ? ocrCluePreview.value.trim() : "";
  const guessText = ocrGuessPreview ? ocrGuessPreview.value.trim() : "";
  const noiseText = ocrNoisePreview ? ocrNoisePreview.textContent.trim() : "";

  if (clueText) {
    cluesInput.value = mergeUniqueLines(cluesInput.value, clueText);
  }

  if (guessText) {
    guessHistoryInput.value = mergeUniqueLines(guessHistoryInput.value, guessText);
  }

  analyzeClues();
  saveToLocalStorage();

  if (!rawOcrText && !clueText && !guessText) {
    alert("请先进行 OCR 识别或清洗 OCR 文本。");
    return;
  }

  const guesses = parseGuessHistory(guessHistoryInput.value);

  const ocrClues = `这是直播猜词截图 OCR 清洗结果，OCR 可能有错字、漏字或顺序错乱。

  页面当前线索：
  ${cluesInput.value.trim() || "暂无"}

  本次 OCR 可能线索：
  ${clueText || "暂无"}

  原始 OCR 文本：
  ${rawOcrText || "暂无"}

  被过滤内容，可能包含 OCR 噪声，也可能包含少量有用信息：
  ${noiseText || "暂无"}

  请结合 OCR 内容、题目线索、历史猜测和相似度推测答案。`;

  if (ocrBackendAnalyzeBtn) {
    ocrBackendAnalyzeBtn.textContent = "OCR AI 分析中...";
    ocrBackendAnalyzeBtn.disabled = true;
  }

  try {
    const data = await analyzeWithAiBackend({
      backendUrl: BACKEND_URL,
      mode,
      clues: followupClues,
      guesses,
      customWords
  });

    if (aiPromptInput) {
      aiPromptInput.value = data.prompt || "";
    }

    if (data.aiText) {
      if (aiResponseInput) {
        aiResponseInput.value = data.aiText;
      }

      if (savedAiResponseBox) {
        savedAiResponseBox.innerText = data.aiText;
      }

      renderAiCards(data.aiJson);

      if (aiCandidateCardsBox) {
        aiCandidateCardsBox.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }

    saveToLocalStorage();
    alert("OCR 后端 AI 分析完成。");
  } catch (error) {
    alert(`OCR 后端分析失败：${error.message}`);
  } finally {
    if (ocrBackendAnalyzeBtn) {
      ocrBackendAnalyzeBtn.textContent = "用 OCR 结果直接 AI 分析";
      ocrBackendAnalyzeBtn.disabled = false;
    }
  }
}

async function runAutoOcrAnalyze() {
  if (!autoOcrAnalyzeBtn) {
    return;
  }

  if (!ocrImageInput || !ocrImageInput.files || ocrImageInput.files.length === 0) {
    alert("请先上传一张直播截图。");
    return;
  }

  if (!ocrRegionPresets.hint || !ocrRegionPresets.guess) {
    alert("请先保存提示区预设和猜测区预设。");
    return;
  }

  let currentStep = "准备开始";

  autoOcrAnalyzeBtn.disabled = true;
  autoOcrAnalyzeBtn.textContent = "自动分析中...";

  resetOcrFlowLog();
  addOcrFlowLog("开始一键 OCR + AI 分析。");

  try {
    currentStep = "应用提示区预设";
    addOcrFlowLog("应用提示区预设。");
    if (ocrStatus) {
      ocrStatus.textContent = "自动流程：应用提示区预设。";
    }
    applyOcrRegionPreset("hint");
    await wait(200);

    currentStep = "识别提示区";
    addOcrFlowLog("开始识别提示区。");
    await recognizeOcrRegionSilent("hint");
    addOcrFlowLog("提示区识别完成。");

    currentStep = "应用猜测区预设";
    addOcrFlowLog("应用猜测区预设。");
    if (ocrStatus) {
      ocrStatus.textContent = "自动流程：应用猜测区预设。";
    }
    applyOcrRegionPreset("guess");
    await wait(200);

    currentStep = "识别猜测区";
    addOcrFlowLog("开始识别猜测区。");
    await recognizeOcrRegionSilent("guess");
    addOcrFlowLog("猜测区识别完成。");

    currentStep = "合并 OCR 文本";
    addOcrFlowLog("合并提示区和猜测区 OCR 文本。");
    if (ocrStatus) {
      ocrStatus.textContent = "自动流程：合并 OCR 文本。";
    }
    mergeOcrRegionsSilent();

    currentStep = "清洗 OCR 文本";
    addOcrFlowLog("清洗 OCR 文本。");
    if (ocrStatus) {
      ocrStatus.textContent = "自动流程：清洗 OCR 文本。";
    }
    cleanOcrTextSilent();

    currentStep = "应用 OCR 清洗结果";
    addOcrFlowLog("应用 OCR 清洗结果到线索和历史猜测。");
    if (ocrStatus) {
      ocrStatus.textContent = "自动流程：应用 OCR 清洗结果。";
    }
    applyOcrParsedResultSilent();

    currentStep = "调用后端 AI";
    addOcrFlowLog("调用后端 AI 分析。");
    if (ocrStatus) {
      ocrStatus.textContent = "自动流程：调用后端 AI。";
    }
    await analyzeOcrWithBackend();

    currentStep = "完成";
    addOcrFlowLog("一键 OCR + AI 分析完成。");

    if (ocrStatus) {
      ocrStatus.textContent = "一键 OCR + AI 分析完成。";
    }
  } catch (error) {
    console.error(error);

    const hintText = ocrHintTextInput ? ocrHintTextInput.value.trim() : "";
    const guessText = ocrGuessTextInput ? ocrGuessTextInput.value.trim() : "";
    const mergedText = ocrResultInput ? ocrResultInput.value.trim() : "";

    addOcrFlowLog(`流程失败，失败步骤：${currentStep}`);
    addOcrFlowLog(`错误信息：${error.message}`);

    if (hintText) {
      addOcrFlowLog(`当前提示区 OCR 文本长度：${hintText.length}`);
    }

    if (guessText) {
      addOcrFlowLog(`当前猜测区 OCR 文本长度：${guessText.length}`);
    }

    if (mergedText) {
      addOcrFlowLog(`当前合并 OCR 文本长度：${mergedText.length}`);
    }

    if (ocrStatus) {
      ocrStatus.textContent = `一键 OCR + AI 分析失败：${currentStep}`;
    }

    alert(`一键 OCR + AI 分析失败。\n失败步骤：${currentStep}\n错误：${error.message}`);
  } finally {
    autoOcrAnalyzeBtn.disabled = false;
    autoOcrAnalyzeBtn.textContent = "一键 OCR + AI 分析";
    saveToLocalStorage();
  }
}

function generateOcrDebugReport() {
  const report = buildOcrDebugReport({
    mode: modeSelect ? modeSelect.value : "",
    cropInfo: ocrCropInfo ? ocrCropInfo.textContent.trim() : "",
    flowLog: ocrFlowLog ? ocrFlowLog.textContent.trim() : "",
    hintText: ocrHintTextInput ? ocrHintTextInput.value.trim() : "",
    guessText: ocrGuessTextInput ? ocrGuessTextInput.value.trim() : "",
    mergedText: ocrResultInput ? ocrResultInput.value.trim() : "",
    cluePreview: ocrCluePreview ? ocrCluePreview.value.trim() : "",
    guessPreview: ocrGuessPreview ? ocrGuessPreview.value.trim() : "",
    noisePreview: ocrNoisePreview ? ocrNoisePreview.textContent.trim() : "",
    aiPrompt: aiPromptInput ? aiPromptInput.value.trim() : "",
    aiResponse: aiResponseInput ? aiResponseInput.value.trim() : ""
  });

  if (ocrDebugReportInput) {
    ocrDebugReportInput.value = report;
  }

  saveToLocalStorage();

  alert("OCR 调试报告已生成。");
}

async function copyOcrDebugReport() {
  if (!ocrDebugReportInput) {
    return;
  }

  const text = ocrDebugReportInput.value.trim();

  if (!text) {
    alert("请先生成 OCR 调试报告。");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    alert("OCR 调试报告已复制。");
  } catch (error) {
    alert("复制失败，请手动复制。");
  }
}

function downloadOcrDebugReport() {
  if (!ocrDebugReportInput) {
    return;
  }

  let text = ocrDebugReportInput.value.trim();

  if (!text) {
    generateOcrDebugReport();
    text = ocrDebugReportInput.value.trim();
  }

  if (!text) {
    alert("没有可下载的 OCR 调试报告。");
    return;
  }

  createTextDownload({
    text,
    filenamePrefix: "ocr-debug-report"
  });

  alert("OCR 调试报告已开始下载。");
}

function autoSelectModeFromOcr(parsed) {
  if (!parsed) {
    return "模式判断：暂无";
  }

  const hasSimilarityScores =
    Array.isArray(parsed.guesses) && parsed.guesses.length >= 2;

  const clueText = Array.isArray(parsed.clues)
    ? parsed.clues.join("\n")
    : "";

  const looksLikeMaskedText =
    clueText.includes("____") ||
    clueText.includes("□□□□") ||
    clueText.includes("空格") ||
    clueText.includes("填字") ||
    clueText.includes("猜字") ||
    clueText.includes("已揭示") ||
    clueText.includes("隐藏");

  if (hasSimilarityScores) {
    modeSelect.value = "semantic";
    return "模式判断：相似度猜词";
  }

  if (looksLikeMaskedText) {
    modeSelect.value = "masked";
    return "模式判断：揭字猜词";
  }

  return "模式判断：暂不确定";
}

function addGuess() {
  const word = guessWordInput.value.trim();
  const score = guessScoreInput.value.trim();

  if (!word || !score) {
    alert("请输入猜测词和相似度。");
    return;
  }

  const scoreNumber = Number(score);

  if (Number.isNaN(scoreNumber) || scoreNumber < 0 || scoreNumber > 100) {
    alert("相似度必须是 0 到 100 之间的数字。");
    return;
  }

  const newLine = `${word} ${scoreNumber}`;

  if (guessHistoryInput.value.trim().length === 0) {
    guessHistoryInput.value = newLine;
  } else {
    guessHistoryInput.value += `\n${newLine}`;
  }

  guessWordInput.value = "";
  guessScoreInput.value = "";

  analyzeClues();
  saveToLocalStorage();
}

function addCandidate() {
  const word = candidateWordInput.value.trim();
  const keywords = candidateKeywordsInput.value.trim();
  const reason = candidateReasonInput.value.trim();

  if (!word) {
    alert("请输入候选词。");
    return;
  }

  if (!keywords) {
    alert("请输入关键词。");
    return;
  }

  const finalReason = reason || "用户临时添加的候选词。";
  const newLine = `${word} | ${keywords} | ${finalReason}`;

  if (customWordsInput.value.trim().length === 0) {
    customWordsInput.value = newLine;
  } else {
    customWordsInput.value += `\n${newLine}`;
  }

  candidateWordInput.value = "";
  candidateKeywordsInput.value = "";
  candidateReasonInput.value = "";

  analyzeClues();
  saveToLocalStorage();
}
  
function analyzeClues() {
  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();
  const guesses = parseGuessHistory(guessHistoryInput.value);
  const customWords = parseCustomWords(customWordsInput.value, mode);

  resultList.innerHTML = "";

  if (wordBank.length === 0) {
    const li = document.createElement("li");
    li.textContent = "词库还没加载完成，请刷新页面再试。";
    resultList.appendChild(li);
    return;
  }

  if (clues.length === 0 && guesses.length === 0 && customWords.length === 0) {
    const li = document.createElement("li");
    li.textContent = "请先输入线索、历史猜测或临时候选词。";
    resultList.appendChild(li);
    return;
  }

  const topResults = analyzeLocalCandidates({
    wordBank,
    mode,
    clues,
    guesses,
    customWords,
    limit: 5
  });

  renderLocalResults({
    container: resultList,
    results: topResults,
    calculateConfidence
  });
}

function fillExample() {
  modeSelect.value = "semantic";

  cluesInput.value = "四字成语，和时间有关，形容时间过得很快";

  guessHistoryInput.value = `光阴 84
时间 72
人生 35
日月 61`;

  customWordsInput.value = `沧海桑田 | 时间,变化,成语,岁月 | 形容世事变化很大`;

  analyzeClues();
  saveToLocalStorage();
}

function clearInputs() {
  guessWordInput.value = "";
  guessScoreInput.value = "";
  candidateWordInput.value = "";
  candidateKeywordsInput.value = "";
  candidateReasonInput.value = "";
  cluesInput.value = "";
  guessHistoryInput.value = "";
  customWordsInput.value = "";
  importJsonInput.value = "";
  aiPromptInput.value = "";
  aiResponseInput.value = "";
  savedAiResponseBox.innerText = "暂无 AI 分析。";
  resultList.innerHTML = "";
  followupHistory = [];
  renderFollowupHistory();

  removeItem("floatingGuessAssistantData");

  updateSaveStatus("已清空本地保存");

  latestAiJson = null;
  latestOcrParsed = null;

  if (aiCandidateCardsBox) {
    aiCandidateCardsBox.innerText = "暂无结构化 AI 结果。";
  } 

  if (aiCardSearchInput) {
    aiCardSearchInput.value = "";
  }

  if (ocrResultInput) {
    ocrResultInput.value = "";
  }

  if (ocrStatus) {
    ocrStatus.textContent = "尚未识别图片。";
  }

  renderOcrPreview({
    cluePreview: ocrCluePreview,
    guessPreview: ocrGuessPreview,
    noisePreview: ocrNoisePreview,
    modePreview: ocrModePreview,
    parsed: null,
    modeText: "模式判断：暂无"
  });

  if (ocrImagePreview) {
    ocrImagePreview.src = "";
    ocrImagePreview.style.display = "none";
  }

  if (ocrUsePreprocessInput) {
    ocrUsePreprocessInput.checked = true; 
  }

  if (ocrScaleSelect) {
    ocrScaleSelect.value = "2";
  }

  if (preprocessImagePreview) {
    preprocessImagePreview.src = "";
    preprocessImagePreview.style.display = "none";
  }

  if (ocrHintTextInput) {
    ocrHintTextInput.value = "";
  }

  if (ocrGuessTextInput) {
    ocrGuessTextInput.value = "";
  }

  if (ocrFlowLog) {
    ocrFlowLog.textContent = "暂无流程日志。";
  }

  if (ocrDebugReportInput) {
    ocrDebugReportInput.value = "";
  }

  if (ocrCropXInput) ocrCropXInput.value = "";
  if (ocrCropYInput) ocrCropYInput.value = "";
  if (ocrCropWidthInput) ocrCropWidthInput.value = "";
  if (ocrCropHeightInput) ocrCropHeightInput.value = "";
}

async function copyResults() {
  const items = Array.from(resultList.querySelectorAll("li"));

  if (items.length === 0) {
    alert("还没有可以复制的结果。");
    return;
  }

  const text = items
    .map((item, index) => `${index + 1}. ${item.innerText}`)
    .join("\n");

  try {
    await navigator.clipboard.writeText(text);
    alert("结果已复制。");
  } catch (error) {
    alert("复制失败，请手动复制。");
  }
}

async function exportCurrentData() {
  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();
  const guesses = parseGuessHistory(guessHistoryInput.value);
  const customWords = parseCustomWords(customWordsInput.value, mode);
  const aiPrompt = aiPromptInput.value.trim();
  const aiResponse = aiResponseInput.value.trim();
  const savedAiResponse = savedAiResponseBox.innerText.trim();

  const exportData = {
  mode,
  clues,
  guesses,
  customWords,
  aiPrompt,
  aiResponse,
  savedAiResponse,
  latestAiJson,
  followupHistory,
  exportedAt: new Date().toISOString()
};

  const jsonText = JSON.stringify(exportData, null, 2);

  try {
    await navigator.clipboard.writeText(jsonText);
    alert("完整 JSON 已复制，包含 AI Prompt 和 AI 返回结果。");
  } catch (error) {
    console.log(jsonText);
    alert("复制失败，JSON 已输出到控制台。");
  }
}

function generateAiPrompt() {
  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();
  const guesses = parseGuessHistory(guessHistoryInput.value);
  const customWords = parseCustomWords(customWordsInput.value, mode);

  const prompt = buildGeneralAiPrompt({
    mode,
    clues,
    guesses,
    customWords
  });

  aiPromptInput.value = prompt;

  navigator.clipboard
    .writeText(prompt)
    .then(() => {
      alert("AI Prompt 已生成并复制。");
    })
    .catch(() => {
      alert("AI Prompt 已生成，但复制失败，请手动复制。");
    });
}

async function analyzeWithBackend() {
  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();
  const guesses = parseGuessHistory(guessHistoryInput.value);
  const customWords = parseCustomWords(customWordsInput.value, mode);

  if (!clues && guesses.length === 0 && customWords.length === 0) {
    alert("请先输入线索、历史猜测或临时候选词。");
    return;
  }

  backendAnalyzeBtn.textContent = "分析中...";
  backendAnalyzeBtn.disabled = true;

  try {
    const data = await analyzeWithAiBackend({
      backendUrl: BACKEND_URL,
      mode,
      clues,
      guesses,
      customWords
    });

    if (aiPromptInput) {
      aiPromptInput.value = data.prompt || "";
    }

    if (data.aiText) {
      if (aiResponseInput) {
        aiResponseInput.value = data.aiText;
      }

      if (savedAiResponseBox) {
        savedAiResponseBox.innerText = data.aiText;
      }

      renderAiCards(data.aiJson);
      latestAiJson = data.aiJson || null;

      if (aiCandidateCardsBox) {
        aiCandidateCardsBox.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }

    saveToLocalStorage();
    alert("后端分析完成。");
  } catch (error) {
    alert(`调用后端失败：${error.message}`);
  } finally {
    backendAnalyzeBtn.textContent = "后端 AI 分析";
    backendAnalyzeBtn.disabled = false;
  }
}

function saveAiResponse() {
  const response = aiResponseInput.value.trim();

  if (!response) {
    alert("请先粘贴 AI 返回结果。");
    return;
  }

  savedAiResponseBox.innerText = response;
  saveToLocalStorage();
  alert("AI 分析已保存到页面。");
}

function renderAiCards(aiJson) {
  latestAiJson = aiJson;

  renderAiCandidateCards({
    container: aiCandidateCardsBox,
    aiJson,
    searchText: aiCardSearchInput ? aiCardSearchInput.value.trim() : "",
    limit: aiCardLimitSelect ? Number(aiCardLimitSelect.value) : 5,
    onAddCandidate: addAiCandidateToCustomWords,
    onUseAsGuess: useAiCandidateAsGuess,
    onGenerateFollowup: generateCandidateFollowupPrompt,
    onDirectFollowup: askBackendAboutCandidate
  });
}

function renderFollowupHistory() {
  renderFollowupHistoryList({
    container: followupHistoryBox,
    followupHistory,
    onDelete: deleteFollowupHistoryItem
  });
}

function deleteFollowupHistoryItem(index) {
  const confirmed = confirm("确定要删除这条追问历史吗？");

  if (!confirmed) {
    return;
  }

  followupHistory.splice(index, 1);
  renderFollowupHistory();
  saveToLocalStorage();
}

function addAiCandidateToCustomWords(item) {
  if (!item || !item.word) {
    return;
  }

  const reason = item.reason || "AI 推荐的候选词。";
  const keywords = Array.isArray(item.keywords) && item.keywords.length > 0
    ? item.keywords.join(",")
    : item.word
        .split("")
        .filter((char) => char.trim().length > 0)
        .join(",");

  const newLine = `${item.word} | ${keywords} | ${reason}`;

  const existingLines = customWordsInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const alreadyExists = existingLines.some((line) =>
    line.startsWith(`${item.word} |`)
  );

  if (alreadyExists) {
    alert("这个候选词已经在临时候选词列表里了。");
    return;
  }

  if (customWordsInput.value.trim().length === 0) {
    customWordsInput.value = newLine;
  } else {
    customWordsInput.value += `\n${newLine}`;
  }

  analyzeClues();
  saveToLocalStorage();

  alert(`已加入临时候选词：${item.word}`);
}

function useAiCandidateAsGuess(item) {
  if (!item || !item.word) {
    return;
  }

  guessWordInput.value = item.word;
  guessScoreInput.value = "";
  guessScoreInput.focus();

  saveToLocalStorage();

  alert(`已填入猜测词：${item.word}，请补充相似度。`);
}

function generateCandidateFollowupPrompt(item) {
  if (!item || !item.word) {
    return;
  }

  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();
  const guesses = parseGuessHistory(guessHistoryInput.value);
  const customWords = parseCustomWords(customWordsInput.value, mode);

  const modeName = mode === "semantic" ? "相似度猜词" : "揭字猜词";

  const guessesText =
    guesses.length > 0
      ? guesses.map((guess) => `- ${guess.word}：${guess.score}`).join("\n")
      : "暂无历史猜测";

  const customWordsText =
    customWords.length > 0
      ? customWords
          .map((wordItem) => {
            const keywords = wordItem.keywords.join("、");
            return `- ${wordItem.word}：关键词 ${keywords}。解释：${wordItem.reason}`;
          })
          .join("\n")
      : "暂无临时候选词";

  const prompt = `你是一个猜词游戏分析助手。请专门分析下面这个候选答案是否可能是正确答案。

游戏模式：${modeName}

候选答案：
${item.word}

候选答案当前置信度：
${item.confidence || "未知"}%

候选答案理由：
${item.reason || "暂无"}

已知线索：
${clues || "暂无线索"}

历史猜测和相似度：
${guessesText}

临时候选词：
${customWordsText}

请输出：
1. 这个候选答案为什么可能是正确答案
2. 这个候选答案为什么可能不是正确答案
3. 如果它不是答案，最接近的 5 个替代答案
4. 下一步最应该尝试的 3 个猜测词
5. 还需要什么线索才能判断

要求：
- 输出清晰
- 不要过度确定
- 根据相似度分数谨慎推理`;

  aiPromptInput.value = prompt;

  navigator.clipboard
    .writeText(prompt)
    .then(() => {
      alert(`已生成关于「${item.word}」的追问 Prompt，并复制。`);
    })
    .catch(() => {
      alert(`已生成关于「${item.word}」的追问 Prompt，请手动复制。`);
    });

  saveToLocalStorage();
}

async function askBackendAboutCandidate(item) {
  if (!item || !item.word) {
    return;
  }

  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();
  const guesses = parseGuessHistory(guessHistoryInput.value);
  const customWords = parseCustomWords(customWordsInput.value, mode);

  const followupClues = `
请重点分析候选答案「${item.word}」是否可能是正确答案。

原始线索：
${clues || "暂无线索"}

候选答案当前理由：
${item.reason || "暂无"}

候选答案当前置信度：
${item.confidence || "未知"}%

请说明：
1. 它为什么可能是答案
2. 它为什么可能不是答案
3. 如果不是它，最接近的替代答案有哪些
`;

  backendAnalyzeBtn.textContent = "追问中...";
  backendAnalyzeBtn.disabled = true;

  try {
    const data = await analyzeWithAiBackend({
      backendUrl: BACKEND_URL,
      mode: modeSelect.value,
      clues: ocrClues,
      guesses,
      customWords: parseCustomWords(customWordsInput.value, modeSelect.value)
    });

    if (aiPromptInput) {
      aiPromptInput.value = data.prompt || "";
    }

    if (data.aiText) {
      if (aiResponseInput) {
        aiResponseInput.value = data.aiText;
      }

      if (savedAiResponseBox) {
        savedAiResponseBox.innerText = data.aiText;
      }

      followupHistory.unshift({
        word: item.word,
        response: data.aiText,
        time: new Date().toLocaleString()
      });

      renderFollowupHistory();
      renderAiCards(data.aiJson);

      if (followupHistoryBox) {
        followupHistoryBox.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    }
    saveToLocalStorage();
    alert(`已完成对「${item.word}」的追问分析。`);
  } catch (error) {
    alert(`追问失败：${error.message}`);
  } finally {
    backendAnalyzeBtn.textContent = "后端 AI 分析";
    backendAnalyzeBtn.disabled = false;
  }
}

async function copyAiResponse() {
  const text = savedAiResponseBox.innerText.trim();

  if (!text || text === "暂无 AI 分析。") {
    alert("还没有可以复制的 AI 分析。");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    alert("AI 分析已复制。");
  } catch (error) {
    alert("复制失败，请手动复制。");
  }
}

function updateSaveStatus(message) {
  updateText(saveStatus, message);
}

function saveToLocalStorage() {
  const data = {
    mode: modeSelect.value,
    clues: cluesInput.value,
    guessWord: guessWordInput.value,
    guessScore: guessScoreInput.value,
    guessHistory: guessHistoryInput.value,
    candidateWord: candidateWordInput.value,
    candidateKeywords: candidateKeywordsInput.value,
    candidateReason: candidateReasonInput.value,
    customWords: customWordsInput.value,
    aiPrompt: aiPromptInput.value,
    aiResponse: aiResponseInput.value,
    ocrResult: ocrResultInput ? ocrResultInput.value : "",
    savedAiResponse: savedAiResponseBox.innerText,
    latestAiJson,
    followupHistory,
    ocrRegionPresets,
    aiCardSearch: aiCardSearchInput ? aiCardSearchInput.value : "",
    aiCardLimit: aiCardLimitSelect ? aiCardLimitSelect.value : "5",
    importJson: importJsonInput.value,
    ocrCropX: ocrCropXInput ? ocrCropXInput.value : "",
    ocrCropY: ocrCropYInput ? ocrCropYInput.value : "",
    ocrCropWidth: ocrCropWidthInput ? ocrCropWidthInput.value : "",
    ocrCropHeight: ocrCropHeightInput ? ocrCropHeightInput.value : "",
    ocrUsePreprocess: ocrUsePreprocessInput ? ocrUsePreprocessInput.checked : true,
    ocrScale: ocrScaleSelect ? ocrScaleSelect.value : "2",
    ocrHintText: ocrHintTextInput ? ocrHintTextInput.value : "",
    ocrDebugReport: ocrDebugReportInput ? ocrDebugReportInput.value : "",
    ocrGuessText: ocrGuessTextInput ? ocrGuessTextInput.value : ""
  };

  saveJson("floatingGuessAssistantData", data);

  const now = new Date();
  const timeText = now.toLocaleTimeString();

  updateSaveStatus(`已自动保存 ${timeText}`);
}

function loadFromLocalStorage() {
  const data = localStorage.getItem("floatingGuessAssistantData");

  if (!data) {
    return;
  }

  try {
    const data = JSON.parse(saved);

    if (data.ocrRegionPresets) {
      ocrRegionPresets = data.ocrRegionPresets;
      updateOcrRegionPresetInfo();
    }

    modeSelect.value = data.mode || "semantic";
    cluesInput.value = data.clues || "";
    guessWordInput.value = data.guessWord || "";
    guessScoreInput.value = data.guessScore || "";
    guessHistoryInput.value = data.guessHistory || "";
    candidateWordInput.value = data.candidateWord || "";
    candidateKeywordsInput.value = data.candidateKeywords || "";
    candidateReasonInput.value = data.candidateReason || "";
    customWordsInput.value = data.customWords || "";
    aiPromptInput.value = data.aiPrompt || "";
    aiResponseInput.value = data.aiResponse || "";

    if (ocrResultInput) {
      ocrResultInput.value = data.ocrResult || "";
    }

    if (ocrCropXInput) ocrCropXInput.value = data.ocrCropX || "";
    if (ocrCropYInput) ocrCropYInput.value = data.ocrCropY || "";  
    if (ocrCropWidthInput) ocrCropWidthInput.value = data.ocrCropWidth || "";
    if (ocrCropHeightInput) ocrCropHeightInput.value = data.ocrCropHeight || "";

    if (ocrUsePreprocessInput) {
      ocrUsePreprocessInput.checked =
        data.ocrUsePreprocess !== undefined ? data.ocrUsePreprocess : true;
    }

    if (ocrScaleSelect) {
      ocrScaleSelect.value = data.ocrScale || "2";
    }

    updateOcrCropInfo();

    setTimeout(() => {
      updateOcrSelectionBoxFromInputs();
    }, 300);

    savedAiResponseBox.innerText = data.savedAiResponse || "暂无 AI 分析。";

    if (aiCardLimitSelect) {
      aiCardLimitSelect.value = data.aiCardLimit || "5";
    }

    if (aiCardSearchInput) {
      aiCardSearchInput.value = data.aiCardSearch || "";
    }

    if (data.latestAiJson) {
      latestAiJson = data.latestAiJson;
      renderAiCards(latestAiJson);
    }

    if (Array.isArray(data.followupHistory)) {
      followupHistory = data.followupHistory;
      renderFollowupHistory();
    }

    if (ocrHintTextInput) {
      ocrHintTextInput.value = data.ocrHintText || "";
    }

    if (ocrGuessTextInput) {
      ocrGuessTextInput.value = data.ocrGuessText || "";
    }

    if (ocrDebugReportInput) {
      ocrDebugReportInput.value = data.ocrDebugReport || "";
    }

    importJsonInput.value = data.importJson || "";

    updateSaveStatus("已恢复上次保存内容");
  } catch (error) {
    console.error("读取本地保存失败：", error);
  }
}

function importCurrentData() {
  const text = importJsonInput.value.trim();

  if (!text) {
    alert("请先粘贴 JSON。");
    return;
  }

  try {
    const data = JSON.parse(text);

    if (data.mode) {
      modeSelect.value = data.mode;
    }

    cluesInput.value = data.clues || "";
    aiPromptInput.value = data.aiPrompt || "";
    aiResponseInput.value = data.aiResponse || "";

    if (data.savedAiResponse) {
      savedAiResponseBox.innerText = data.savedAiResponse;
    } else {
      savedAiResponseBox.innerText = "暂无 AI 分析。";
    }

    if (data.latestAiJson) {
      latestAiJson = data.latestAiJson;
      renderAiCards(latestAiJson);
    } else {
      latestAiJson = null;
     renderAiCards(null);
    }

    if (Array.isArray(data.guesses)) {
      guessHistoryInput.value = data.guesses
        .map((guess) => `${guess.word} ${guess.score}`)
        .join("\n");
    }

    if (Array.isArray(data.customWords)) {
      customWordsInput.value = data.customWords
        .map((item) => {
          const keywords = Array.isArray(item.keywords)
            ? item.keywords.join(",")
            : "";

          return `${item.word} | ${keywords} | ${item.reason || "用户临时添加的候选词。"}`;
        })
        .join("\n");
    }

    if (Array.isArray(data.followupHistory)) {
      followupHistory = data.followupHistory;
      renderFollowupHistory();
    } else {
      followupHistory = [];
      renderFollowupHistory();
    }

    analyzeClues();
    saveToLocalStorage();
    alert("导入成功。");
  } catch (error) {
    alert("JSON 格式错误，请检查后再试。");
  }
}

addGuessBtn.addEventListener("click", addGuess);
addCandidateBtn.addEventListener("click", addCandidate);
exampleBtn.addEventListener("click", fillExample);
clearBtn.addEventListener("click", clearInputs);
analyzeBtn.addEventListener("click", analyzeClues);
copyBtn.addEventListener("click", copyResults);
exportBtn.addEventListener("click", exportCurrentData);
promptBtn.addEventListener("click", generateAiPrompt);
backendAnalyzeBtn.addEventListener("click", analyzeWithBackend);
saveAiResponseBtn.addEventListener("click", saveAiResponse);
importBtn.addEventListener("click", importCurrentData);

if (ocrImageInput) {
  ocrImageInput.addEventListener("change", previewOcrImage);
}

if (ocrBtn) {
  ocrBtn.addEventListener("click", recognizeImageText);
}

if (useOcrTextBtn) {
  useOcrTextBtn.addEventListener("click", useOcrTextAsClues);
}

if (cleanOcrBtn) {
  cleanOcrBtn.addEventListener("click", cleanOcrText);
}

if (applyOcrParsedBtn) {
  applyOcrParsedBtn.addEventListener("click", applyOcrParsedResult);
}

if (ocrPromptBtn) {
  ocrPromptBtn.addEventListener("click", generateOcrLivePrompt);
}

if (ocrBackendAnalyzeBtn) {
  ocrBackendAnalyzeBtn.addEventListener("click", analyzeOcrWithBackend);
}

if (ocrUsePreprocessInput) {
  ocrUsePreprocessInput.addEventListener("change", saveToLocalStorage);
}

if (ocrScaleSelect) {
  ocrScaleSelect.addEventListener("change", saveToLocalStorage);
}

if (aiCardLimitSelect) {
  aiCardLimitSelect.addEventListener("change", () => {
    renderAiCards(latestAiJson);
    saveToLocalStorage();
  });
}

if (aiCardSearchInput) {
  aiCardSearchInput.addEventListener("input", () => {
    renderAiCards(latestAiJson);
    saveToLocalStorage();
  });
}

if (clearOcrCropBtn) {
  clearOcrCropBtn.addEventListener("click", clearOcrCropSettings);
}

if (ocrImageWrapper) {
  ocrImageWrapper.addEventListener("mousedown", startOcrAreaSelection);
  ocrImageWrapper.addEventListener("mousemove", updateOcrAreaSelection);
  window.addEventListener("mouseup", finishOcrAreaSelection);
}

if (previewPreprocessBtn) {
  previewPreprocessBtn.addEventListener("click", previewPreprocessedOcrImage);
}

if (cropFullBtn) {
  cropFullBtn.addEventListener("click", () => applyOcrCropPreset("full"));
}

if (cropTopBtn) {
  cropTopBtn.addEventListener("click", () => applyOcrCropPreset("top"));
}

if (cropBottomBtn) {
  cropBottomBtn.addEventListener("click", () => applyOcrCropPreset("bottom"));
}

if (cropLeftBtn) {
  cropLeftBtn.addEventListener("click", () => applyOcrCropPreset("left"));
}

if (cropRightBtn) {
  cropRightBtn.addEventListener("click", () => applyOcrCropPreset("right"));
}

if (cropCenterBtn) {
  cropCenterBtn.addEventListener("click", () => applyOcrCropPreset("center"));
}

if (ocrHintRegionBtn) {
  ocrHintRegionBtn.addEventListener("click", () => recognizeOcrRegion("hint"));
}

if (ocrGuessRegionBtn) {
  ocrGuessRegionBtn.addEventListener("click", () => recognizeOcrRegion("guess"));
}

if (mergeOcrRegionsBtn) {
  mergeOcrRegionsBtn.addEventListener("click", mergeOcrRegions);
}

if (saveHintPresetBtn) {
  saveHintPresetBtn.addEventListener("click", () => saveOcrRegionPreset("hint"));
}

if (applyHintPresetBtn) {
  applyHintPresetBtn.addEventListener("click", () => applyOcrRegionPreset("hint"));
}

if (saveGuessPresetBtn) {
  saveGuessPresetBtn.addEventListener("click", () => saveOcrRegionPreset("guess"));
}

if (applyGuessPresetBtn) {
  applyGuessPresetBtn.addEventListener("click", () => applyOcrRegionPreset("guess"));
}

if (autoOcrAnalyzeBtn) {
  autoOcrAnalyzeBtn.addEventListener("click", runAutoOcrAnalyze);
}

if (generateOcrReportBtn) {
  generateOcrReportBtn.addEventListener("click", generateOcrDebugReport);
}

if (copyOcrReportBtn) {
  copyOcrReportBtn.addEventListener("click", copyOcrDebugReport);
}

if (downloadOcrReportBtn) {
  downloadOcrReportBtn.addEventListener("click", downloadOcrDebugReport);
}

if (ocrImageWrapper) {
  ocrImageWrapper.addEventListener("touchstart", (event) => {
    startOcrAreaSelection(event.touches[0]);
  });

  ocrImageWrapper.addEventListener("touchmove", (event) => {
    event.preventDefault();
    updateOcrAreaSelection(event.touches[0]);
  });

  ocrImageWrapper.addEventListener("touchend", (event) => {
    if (event.changedTouches.length > 0) {
      finishOcrAreaSelection(event.changedTouches[0]);
    }
  });
}

[
  ocrCropXInput,
  ocrCropYInput,
  ocrCropWidthInput,
  ocrCropHeightInput
].forEach((input) => {
  if (!input) {
    return;
  }

  input.addEventListener("input", () => {
    updateOcrCropInfo();
    updateOcrSelectionBoxFromInputs();
    saveToLocalStorage();
  });
});

copyAiResponseBtn.addEventListener("click", copyAiResponse);

const autoSaveInputs = [
  modeSelect,
  cluesInput,
  guessWordInput,
  guessScoreInput,
  guessHistoryInput,
  candidateWordInput,
  candidateKeywordsInput,
  candidateReasonInput,
  customWordsInput,
  aiPromptInput,
  aiResponseInput,
  ocrResultInput,
  ocrCropXInput,
  ocrCropYInput,
  ocrCropWidthInput,
  ocrCropHeightInput,
  ocrHintTextInput,
  ocrGuessTextInput,
  importJsonInput
];

autoSaveInputs.forEach((input) => {
  if (!input) {
    return;
  }

  input.addEventListener("input", saveToLocalStorage);
  input.addEventListener("change", saveToLocalStorage);
});

loadSectionStates(loadJson);
setupSectionStateSaving(saveJson);
setupQuickNav(saveJson);
loadFromLocalStorage();
loadWordBank();