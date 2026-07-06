const modeSelect = document.getElementById("mode");
const cluesInput = document.getElementById("clues");
const guessHistoryInput = document.getElementById("guessHistory");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultList = document.getElementById("resultList");

const wordBank = [
  {
    word: "光阴似箭",
    mode: "semantic",
    keywords: ["时间", "光阴", "快", "流逝", "成语", "岁月", "箭"],
    reason: "形容时间像箭一样飞快流逝。"
  },
  {
    word: "日月如梭",
    mode: "semantic",
    keywords: ["时间", "日月", "快", "流逝", "成语", "岁月", "梭"],
    reason: "形容时间过得很快。"
  },
  {
    word: "白驹过隙",
    mode: "semantic",
    keywords: ["时间", "人生", "短暂", "快", "成语", "缝隙"],
    reason: "比喻时间过得很快，人生短暂。"
  },
  {
    word: "时光荏苒",
    mode: "semantic",
    keywords: ["时间", "时光", "岁月", "流逝", "成语"],
    reason: "形容时间一点一点流逝。"
  },
  {
    word: "岁月如流",
    mode: "semantic",
    keywords: ["时间", "岁月", "流逝", "快", "成语"],
    reason: "形容岁月像流水一样流逝。"
  },
  {
    word: "短视频",
    mode: "masked",
    keywords: ["年轻人", "流行", "娱乐", "软件", "视频", "抖音", "快手"],
    reason: "常见于年轻人娱乐、软件、视频类线索。"
  },
  {
    word: "直播间",
    mode: "masked",
    keywords: ["观众", "弹幕", "主播", "互动", "礼物", "直播"],
    reason: "和主播、观众、弹幕互动有关。"
  },
  {
    word: "人工智能",
    mode: "masked",
    keywords: ["AI", "模型", "生成", "自动", "分析", "算法", "智能"],
    reason: "和模型、自动分析、生成内容有关。"
  }
];

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

function analyzeClues() {
  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();
  const guesses = parseGuessHistory(guessHistoryInput.value);

  resultList.innerHTML = "";

  if (clues.length === 0 && guesses.length === 0) {
    const li = document.createElement("li");
    li.textContent = "请先输入线索或历史猜测。";
    resultList.appendChild(li);
    return;
  }

  const results = wordBank
    .filter((item) => item.mode === mode)
    .map((item) => {
      return {
        ...item,
        score: calculateScore(clues, guesses, item)
      };
    })
    .sort((a, b) => b.score - a.score);

  results.forEach((answer) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${answer.word}</strong>：匹配分 ${answer.score}。${answer.reason}`;
    resultList.appendChild(li);
  });
}

analyzeBtn.addEventListener("click", analyzeClues);