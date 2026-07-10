const modeSelect = document.getElementById("mode");
const cluesInput = document.getElementById("clues");
const guessWordInput = document.getElementById("guessWord");
const guessScoreInput = document.getElementById("guessScore");
const guessHistoryInput = document.getElementById("guessHistory");
const customWordsInput = document.getElementById("customWords");
const candidateWordInput = document.getElementById("candidateWord");
const candidateKeywordsInput = document.getElementById("candidateKeywords");
const candidateReasonInput = document.getElementById("candidateReason");
const addGuessBtn = document.getElementById("addGuessBtn");
const addCandidateBtn = document.getElementById("addCandidateBtn");
const exampleBtn = document.getElementById("exampleBtn");
const clearBtn = document.getElementById("clearBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const copyBtn = document.getElementById("copyBtn");
const importBtn = document.getElementById("importBtn");
const resultList = document.getElementById("resultList");
const saveStatus = document.getElementById("saveStatus");
const exportBtn = document.getElementById("exportBtn");
const aiResponseInput = document.getElementById("aiResponse");
const saveAiResponseBtn = document.getElementById("saveAiResponseBtn");
const copyAiResponseBtn = document.getElementById("copyAiResponseBtn");
const savedAiResponseBox = document.getElementById("savedAiResponse");
const aiCandidateCardsBox = document.getElementById("aiCandidateCards");
const followupHistoryBox = document.getElementById("followupHistory");
const aiCardLimitSelect = document.getElementById("aiCardLimit");
const aiCardSearchInput = document.getElementById("aiCardSearch");
const importJsonInput = document.getElementById("importJson");
const promptBtn = document.getElementById("promptBtn");
const backendAnalyzeBtn = document.getElementById("backendAnalyzeBtn");
const aiPromptInput = document.getElementById("aiPrompt");
const ocrImageInput = document.getElementById("ocrImageInput");
const ocrBtn = document.getElementById("ocrBtn");
const ocrStatus = document.getElementById("ocrStatus");
const ocrResultInput = document.getElementById("ocrResult");
const useOcrTextBtn = document.getElementById("useOcrTextBtn");
const cleanOcrBtn = document.getElementById("cleanOcrBtn");
const BACKEND_URL = "https://effective-fishstick-v64pg6p565wghwg7v-3000.app.github.dev";

let wordBank = [];
let latestAiJson = null;
let followupHistory = [];

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

async function recognizeImageText() {
  if (!ocrImageInput || !ocrImageInput.files || ocrImageInput.files.length === 0) {
    alert("请先选择一张图片。");
    return;
  }

  const file = ocrImageInput.files[0];

  ocrBtn.disabled = true;
  ocrBtn.textContent = "识别中...";
  ocrStatus.textContent = "OCR 正在识别，请稍等。";

  try {
    const result = await Tesseract.recognize(file, "chi_sim+eng", {
      logger: (message) => {
        if (message.status === "recognizing text") {
          const progress = Math.round(message.progress * 100);
          ocrStatus.textContent = `正在识别文字：${progress}%`;
        } else {
          ocrStatus.textContent = `OCR 状态：${message.status}`;
        }
      }
    });

    const text = result.data.text.trim();

    ocrResultInput.value = text || "没有识别到文字。";
    ocrStatus.textContent = "OCR 识别完成。";

    saveToLocalStorage();
  } catch (error) {
    console.error(error);
    ocrStatus.textContent = "OCR 识别失败。";
    alert("OCR 识别失败，请换一张更清晰的图片。");
  } finally {
    ocrBtn.disabled = false;
    ocrBtn.textContent = "识别图片文字";
  }
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

  if (parsed.clues.length > 0) {
    const clueText = parsed.clues.join("\n");

    if (cluesInput.value.trim().length === 0) {
      cluesInput.value = clueText;
    } else {
      cluesInput.value += `\n${clueText}`;
    }
  }

  if (parsed.guesses.length > 0) {
    const guessText = parsed.guesses
      .map((guess) => `${guess.word} ${guess.score}`)
      .join("\n");

    if (guessHistoryInput.value.trim().length === 0) {
      guessHistoryInput.value = guessText;
    } else {
      guessHistoryInput.value += `\n${guessText}`;
    }
  }

  saveToLocalStorage();

  alert(`清洗完成：提取到 ${parsed.clues.length} 条线索，${parsed.guesses.length} 条历史猜测。`);
}

function parseOcrGuessText(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const clues = [];
  const guesses = [];

  lines.forEach((line) => {
    const normalizedLine = line
      .replace(/％/g, "%")
      .replace(/，/g, ",")
      .replace(/：/g, ":")
      .replace(/\s+/g, " ")
      .trim();

    const guessMatch = normalizedLine.match(
      /([\u4e00-\u9fa5A-Za-z0-9]{1,10})\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*%/
    );

    if (guessMatch) {
      const word = guessMatch[1];
      const score = Number(guessMatch[2]);

      if (!Number.isNaN(score) && score >= 0 && score <= 100) {
        guesses.push({
          word,
          score
        });
      }

      return;
    }

    if (
      normalizedLine.includes("动词") ||
      normalizedLine.includes("名词") ||
      normalizedLine.includes("形容词") ||
      normalizedLine.includes("答案") ||
      normalizedLine.includes("提示") ||
      normalizedLine.includes("字") ||
      normalizedLine.includes("文娱") ||
      normalizedLine.includes("休闲") ||
      normalizedLine.includes("赏景") ||
      normalizedLine.includes("关联度") ||
      normalizedLine.includes("相似度")
    ) {
      clues.push(normalizedLine);
    }
  });

  const uniqueGuesses = [];
  const seenWords = new Set();

  guesses.forEach((guess) => {
    if (!seenWords.has(guess.word)) {
      seenWords.add(guess.word);
      uniqueGuesses.push(guess);
    }
  });

  const uniqueClues = [...new Set(clues)];

  return {
    clues: uniqueClues,
    guesses: uniqueGuesses
  };
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

function parseGuessHistory(text) {
  if (!text.trim()) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(/\s+/);
      const word = parts[0];
      const score = Number(parts[1]);

      return {
        word,
        score: Number.isNaN(score) ? 0 : score
      };
    });
}

function parseCustomWords(text, mode) {
  if (!text.trim()) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());

      const word = parts[0] || "";
      const keywords = parts[1]
        ? parts[1].split(",").map((keyword) => keyword.trim()).filter(Boolean)
        : [];

      const reason = parts[2] || "用户临时添加的候选词。";

      return {
        word,
        mode,
        keywords,
        reason
      };
    })
    .filter((item) => item.word.length > 0);
}

function calculateScore(clues, guesses, item) {
  let score = 0;
  const logs = [];

  item.keywords.forEach((keyword) => {
    if (clues.includes(keyword)) {
      score += 10;
      logs.push(`线索命中「${keyword}」+10`);
    }
  });

  guesses.forEach((guess) => {
    if (guess.score >= 80) {
      item.keywords.forEach((keyword) => {
        if (guess.word.includes(keyword) || keyword.includes(guess.word)) {
          score += 20;
          logs.push(`高相似度猜测「${guess.word}」命中「${keyword}」+20`);
        }
      });
    }

    if (guess.score >= 60 && guess.score < 80) {
      item.keywords.forEach((keyword) => {
        if (guess.word.includes(keyword) || keyword.includes(guess.word)) {
          score += 10;
          logs.push(`中相似度猜测「${guess.word}」命中「${keyword}」+10`);
        }
      });
    }

    if (guess.score < 40) {
      item.keywords.forEach((keyword) => {
        if (guess.word.includes(keyword) || keyword.includes(guess.word)) {
          score -= 5;
          logs.push(`低相似度猜测「${guess.word}」命中「${keyword}」-5`);
        }
      });
    }
  });

  if (clues.includes(item.word)) {
    score += 20;
    logs.push(`线索直接包含答案「${item.word}」+20`);
  }

  return {
    score,
    logs
  };
}

function calculateConfidence(score, maxScore) {
  if (maxScore <= 0) {
    return 0;
  }

  const confidence = Math.round((score / maxScore) * 100);

  return Math.max(0, Math.min(confidence, 100));
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

  const activeWordBank = [...wordBank, ...customWords];

  const results = activeWordBank
    .filter((item) => item.mode === mode)
    .map((item) => {
      const result = calculateScore(clues, guesses, item);

      return {
        ...item,
        score: result.score,
        logs: result.logs
      };
    })
    .sort((a, b) => b.score - a.score);

  const topResults = results.slice(0, 5);
  const maxScore = topResults.length > 0 ? topResults[0].score : 0;

  topResults.forEach((answer, index) => {
    const li = document.createElement("li");

    const label = index === 0 ? "最可能" : "";
    const confidence = calculateConfidence(answer.score, maxScore);

    const logText =
    answer.logs.length > 0
      ? answer.logs.join("；")
      : "暂无明显命中规则。";

  li.innerHTML = `
    <strong>${answer.word}</strong>
    ${label ? `<span class="tag">${label}</span>` : ""}
    <span class="confidence">置信度 ${confidence}%</span>
    <br />
    <span class="reason">${answer.reason}</span>
    <br />
    <span class="score-log">得分原因：${logText}</span>
  `;

    resultList.appendChild(li);
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

  localStorage.removeItem("floatingGuessAssistantData");

  updateSaveStatus("已清空本地保存");

  latestAiJson = null;

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

  const modeName = mode === "semantic" ? "相似度猜词" : "揭字猜词";

  const guessesText =
    guesses.length > 0
      ? guesses.map((guess) => `- ${guess.word}：${guess.score}`).join("\n")
      : "暂无历史猜测";

  const customWordsText =
    customWords.length > 0
      ? customWords
          .map((item) => {
            const keywords = item.keywords.join("、");
            return `- ${item.word}：关键词 ${keywords}。解释：${item.reason}`;
          })
          .join("\n")
      : "暂无临时候选词";

  const prompt = `你是一个猜词游戏分析助手。请根据下面的信息，推测最可能的答案。

游戏模式：${modeName}

已知线索：
${clues || "暂无线索"}

历史猜测和相似度：
${guessesText}

临时候选词：
${customWordsText}

请输出：
1. 最可能答案 Top 10
2. 每个答案的可能性百分比
3. 每个答案的推理理由
4. 下一步最值得尝试的 5 个词
5. 你不确定的地方

要求：
- 不要只给一个答案，要给多个候选。
- 如果信息不足，请说明还需要什么线索。
- 输出格式清晰，适合直接给玩家参考。`;

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
    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        clues,
        guesses,
        customWords
      })
    });

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      console.error("后端返回的不是 JSON：", rawText);
      throw new Error("后端返回的不是 JSON，可能是 BACKEND_URL 写错或 3000 端口不是 Public。");
    }

    if (!response.ok) {
      throw new Error(data.details || data.error || "后端分析失败");
    }

    aiPromptInput.value = data.prompt || "";

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

  if (!aiCandidateCardsBox) {
    return;
  }

  aiCandidateCardsBox.innerHTML = "";

  if (!aiJson || !Array.isArray(aiJson.candidates)) {
    aiCandidateCardsBox.innerText = "暂无结构化 AI 结果。";
    return;
  }

  const sortedCandidates = [...aiJson.candidates].sort((a, b) => {
    const scoreA = Number(a.confidence) || 0;
    const scoreB = Number(b.confidence) || 0;
    return scoreB - scoreA;
  });

  const searchText = aiCardSearchInput
    ? aiCardSearchInput.value.trim()
    : "";

  const filteredCandidates = searchText
    ? sortedCandidates.filter((item) => {
        const word = item.word || "";
        const reason = item.reason || "";
        const keywords = Array.isArray(item.keywords)
          ? item.keywords.join(" ")
          : "";

        return (
          word.includes(searchText) ||
          reason.includes(searchText) ||
          keywords.includes(searchText)
        );
      })
    : sortedCandidates;

  const limit = aiCardLimitSelect ? Number(aiCardLimitSelect.value) : 5;
  const visibleCandidates = filteredCandidates.slice(0, limit);

  if (visibleCandidates.length === 0) {
    aiCandidateCardsBox.innerText = "没有匹配的 AI 候选结果。";
    return;
  }

  visibleCandidates.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "ai-candidate-card";

    const confidence = Number(item.confidence) || 0;
const safeConfidence = Math.max(0, Math.min(confidence, 100));

const topLabel = index === 0 ? `<span class="ai-top-tag">AI 最可能</span>` : "";

card.innerHTML = `
  <div class="ai-card-header">
    <strong>${index + 1}. ${item.word}</strong>
    <div>
      ${topLabel}
      <span class="ai-confidence">${safeConfidence}%</span>
    </div>
  </div>

  <div class="confidence-bar">
    <div class="confidence-fill" style="width: ${safeConfidence}%"></div>
  </div>

  <p>${item.reason || "暂无理由。"}</p>
  ${
    Array.isArray(item.keywords) && item.keywords.length > 0
      ? `<p class="ai-keywords">关键词：${item.keywords.join("、")}</p>`
      : ""
  }

  <div class="ai-card-buttons">
    <button type="button" class="add-ai-candidate-btn">
      加入临时候选词
    </button>
    <button type="button" class="use-as-guess-btn">
      填到猜测词
    </button>
    <button type="button" class="ask-about-candidate-btn">
      生成追问
    </button>
    <button type="button" class="ask-backend-candidate-btn">
      直接追问
    </button>
  </div>
`;

    const addButton = card.querySelector(".add-ai-candidate-btn");
    const useAsGuessButton = card.querySelector(".use-as-guess-btn");
    const askButton = card.querySelector(".ask-about-candidate-btn");
    const askBackendButton = card.querySelector(".ask-backend-candidate-btn");

    addButton.addEventListener("click", () => {
      addAiCandidateToCustomWords(item);
    });

    useAsGuessButton.addEventListener("click", () => {
      useAiCandidateAsGuess(item);
    });

    askButton.addEventListener("click", () => {
      generateCandidateFollowupPrompt(item);
    });

    askBackendButton.addEventListener("click", () => {
      askBackendAboutCandidate(item);
    });

    addButton.addEventListener("click", () => {
      addAiCandidateToCustomWords(item);
    });

    aiCandidateCardsBox.appendChild(card);
  });

  if (Array.isArray(aiJson.nextGuesses) && aiJson.nextGuesses.length > 0) {
    const nextBox = document.createElement("div");
    nextBox.className = "ai-next-box";
    nextBox.innerHTML = `
      <strong>下一步建议：</strong>
      ${aiJson.nextGuesses.join("、")}
    `;
    aiCandidateCardsBox.appendChild(nextBox);
  }

  if (aiJson.uncertainty) {
    const uncertaintyBox = document.createElement("div");
    uncertaintyBox.className = "ai-uncertainty-box";
    uncertaintyBox.innerHTML = `
      <strong>不确定性：</strong>
      ${aiJson.uncertainty}
    `;
    aiCandidateCardsBox.appendChild(uncertaintyBox);
  }
}

function renderFollowupHistory() {
  if (!followupHistoryBox) {
    return;
  }

  followupHistoryBox.innerHTML = "";

  if (followupHistory.length === 0) {
    followupHistoryBox.innerText = "暂无追问历史。";
    return;
  }

  followupHistory.forEach((item, index) => {
    const box = document.createElement("div");
    box.className = "followup-history-item";

    box.innerHTML = `
      <div class="followup-history-header">
        <div>
          <strong>${index + 1}. ${item.word}</strong>
          <span>${item.time}</span>
        </div>

        <button type="button" class="delete-followup-btn">
          删除
        </button>
      </div>

      <p>${item.response}</p>
    `;

    const deleteButton = box.querySelector(".delete-followup-btn");

    deleteButton.addEventListener("click", () => {
      deleteFollowupHistoryItem(index);
    });

    followupHistoryBox.appendChild(box);
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
    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        clues: followupClues,
        guesses,
        customWords
      })
    });

    const rawText = await response.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch (error) {
      console.error("后端返回的不是 JSON：", rawText);
      throw new Error("后端返回的不是 JSON。");
    }

    if (!response.ok) {
      throw new Error(data.details || data.error || "后端追问失败");
    }

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
  saveStatus.textContent = message;
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
    aiCardSearch: aiCardSearchInput ? aiCardSearchInput.value : "",
    aiCardLimit: aiCardLimitSelect ? aiCardLimitSelect.value : "5",
    importJson: importJsonInput.value
  };

  localStorage.setItem("floatingGuessAssistantData", JSON.stringify(data));

  const now = new Date();
  const timeText = now.toLocaleTimeString();

  updateSaveStatus(`已自动保存 ${timeText}`);
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem("floatingGuessAssistantData");

  if (!saved) {
    return;
  }

  try {
    const data = JSON.parse(saved);

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

    analyzeClues();
    saveToLocalStorage();
    alert("导入成功。");
  } catch (error) {
    alert("JSON 格式错误，请检查后再试。");
  }

  if (Array.isArray(data.followupHistory)) {
    followupHistory = data.followupHistory;
    renderFollowupHistory();
  } else {
    followupHistory = [];
    renderFollowupHistory();
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

if (ocrBtn) {
  ocrBtn.addEventListener("click", recognizeImageText);
}

if (useOcrTextBtn) {
  useOcrTextBtn.addEventListener("click", useOcrTextAsClues);
}

if (cleanOcrBtn) {
  cleanOcrBtn.addEventListener("click", cleanOcrText);
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
  importJsonInput
];

autoSaveInputs.forEach((input) => {
  if (!input) {
    return;
  }

  input.addEventListener("input", saveToLocalStorage);
  input.addEventListener("change", saveToLocalStorage);
});

loadFromLocalStorage();
loadWordBank();