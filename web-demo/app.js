const modeSelect = document.getElementById("mode");
const cluesInput = document.getElementById("clues");
const guessHistoryInput = document.getElementById("guessHistory");
const customWordsInput = document.getElementById("customWords");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultList = document.getElementById("resultList");

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

  item.keywords.forEach((keyword) => {
    if (clues.includes(keyword)) {
      score += 10;
    }
  });

  guesses.forEach((guess) => {
    if (guess.score >= 80) {
      item.keywords.forEach((keyword) => {
        if (guess.word.includes(keyword) || keyword.includes(guess.word)) {
          score += 20;
        }
      });
    }

    if (guess.score >= 60 && guess.score < 80) {
      item.keywords.forEach((keyword) => {
        if (guess.word.includes(keyword) || keyword.includes(guess.word)) {
          score += 10;
        }
      });
    }

    if (guess.score < 40) {
      item.keywords.forEach((keyword) => {
        if (guess.word.includes(keyword) || keyword.includes(guess.word)) {
          score -= 5;
        }
      });
    }
  });

  if (clues.includes(item.word)) {
    score += 20;
  }

  return score;
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
      return {
        ...item,
        score: calculateScore(clues, guesses, item)
      };
    })
    .sort((a, b) => b.score - a.score);

  const topResults = results.slice(0, 5);
  const maxScore = topResults.length > 0 ? topResults[0].score : 0;

  topResults.forEach((answer, index) => {
    const li = document.createElement("li");

    const label = index === 0 ? "最可能" : "";
    const confidence = calculateConfidence(answer.score, maxScore);

    li.innerHTML = `
      <strong>${answer.word}</strong>
      ${label ? `<span class="tag">${label}</span>` : ""}
      <span class="confidence">置信度 ${confidence}%</span>
      <br />
      <span class="reason">${answer.reason}</span>
    `;

    resultList.appendChild(li);
  });
}

analyzeBtn.addEventListener("click", analyzeClues);

loadWordBank();