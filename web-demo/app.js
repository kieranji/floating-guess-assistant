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
const savedAiResponseBox = document.getElementById("savedAiResponse");
const importJsonInput = document.getElementById("importJson");
const promptBtn = document.getElementById("promptBtn");
const backendAnalyzeBtn = document.getElementById("backendAnalyzeBtn");
const aiPromptInput = document.getElementById("aiPrompt");
const BACKEND_URL = "https://effective-fishstick-v64pg6p565wghwg7v-3000.app.github.dev";

let wordBank = [];

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

  localStorage.removeItem("floatingGuessAssistantData");

  updateSaveStatus("已清空本地保存");
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
      throw new Error(data.error || "后端分析失败");
    }

    aiPromptInput.value = data.prompt || "";

    if (data.aiText) {
      aiResponseInput.value = data.aiText;
      savedAiResponseBox.innerText = data.aiText;
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
    savedAiResponse: savedAiResponseBox.innerText,
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
    savedAiResponseBox.innerText = data.savedAiResponse || "暂无 AI 分析。";
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
  importJsonInput
];

autoSaveInputs.forEach((input) => {
  input.addEventListener("input", saveToLocalStorage);
  input.addEventListener("change", saveToLocalStorage);
});

loadFromLocalStorage();
loadWordBank();