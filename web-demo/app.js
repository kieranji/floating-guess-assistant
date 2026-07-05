const modeSelect = document.getElementById("mode");
const cluesInput = document.getElementById("clues");
const analyzeBtn = document.getElementById("analyzeBtn");
const resultList = document.getElementById("resultList");

const semanticAnswers = [
  {
    word: "光阴似箭",
    reason: "和时间流逝有关，也符合“光阴”这个高相似度猜测。"
  },
  {
    word: "日月如梭",
    reason: "四字成语，常用来形容时间过得很快。"
  },
  {
    word: "白驹过隙",
    reason: "形容时间飞快流逝，语义接近时间类线索。"
  },
  {
    word: "时光荏苒",
    reason: "和时间、岁月流逝有关。"
  },
  {
    word: "岁月如流",
    reason: "含有岁月、流逝的含义。"
  }
];

const maskedAnswers = [
  {
    word: "短视频",
    reason: "如果线索包含年轻人、流行、娱乐、软件等词，可能是短视频。"
  },
  {
    word: "直播间",
    reason: "如果描述提到观众、互动、弹幕，可能和直播间有关。"
  },
  {
    word: "社交软件",
    reason: "如果描述中有聊天、好友、消息等内容，可能是社交软件。"
  },
  {
    word: "网络游戏",
    reason: "如果描述中有玩家、关卡、互动等内容，可能是网络游戏。"
  },
  {
    word: "人工智能",
    reason: "如果描述中有模型、生成、自动分析等内容，可能是人工智能。"
  }
];

function analyzeClues() {
  const mode = modeSelect.value;
  const clues = cluesInput.value.trim();

  resultList.innerHTML = "";

  if (clues.length === 0) {
    const li = document.createElement("li");
    li.textContent = "请先输入一些线索。";
    resultList.appendChild(li);
    return;
  }

  let answers;

  if (mode === "semantic") {
    answers = semanticAnswers;
  } else {
    answers = maskedAnswers;
  }

  answers.forEach((answer) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${answer.word}</strong>：${answer.reason}`;
    resultList.appendChild(li);
  });
}

analyzeBtn.addEventListener("click", analyzeClues);