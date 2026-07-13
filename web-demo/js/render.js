export function renderAiCandidateCards({
  container,
  aiJson,
  searchText = "",
  limit = 5,
  onAddCandidate,
  onUseAsGuess,
  onGenerateFollowup,
  onDirectFollowup
}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!aiJson || !Array.isArray(aiJson.candidates)) {
    container.innerText = "暂无结构化 AI 结果。";
    return;
  }

  const sortedCandidates = [...aiJson.candidates].sort((a, b) => {
    const scoreA = Number(a.confidence) || 0;
    const scoreB = Number(b.confidence) || 0;
    return scoreB - scoreA;
  });

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

  const visibleCandidates = filteredCandidates.slice(0, limit);

  if (visibleCandidates.length === 0) {
    container.innerText = "没有匹配的 AI 候选结果。";
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
      onAddCandidate?.(item);
    });

    useAsGuessButton.addEventListener("click", () => {
      onUseAsGuess?.(item);
    });

    askButton.addEventListener("click", () => {
      onGenerateFollowup?.(item);
    });

    askBackendButton.addEventListener("click", () => {
      onDirectFollowup?.(item);
    });

    container.appendChild(card);
  });

  if (Array.isArray(aiJson.nextGuesses) && aiJson.nextGuesses.length > 0) {
    const nextBox = document.createElement("div");
    nextBox.className = "ai-next-box";
    nextBox.innerHTML = `
      <strong>下一步建议：</strong>
      ${aiJson.nextGuesses.join("、")}
    `;
    container.appendChild(nextBox);
  }

  if (aiJson.uncertainty) {
    const uncertaintyBox = document.createElement("div");
    uncertaintyBox.className = "ai-uncertainty-box";
    uncertaintyBox.innerHTML = `
      <strong>不确定性：</strong>
      ${aiJson.uncertainty}
    `;
    container.appendChild(uncertaintyBox);
  }
}

export function renderFollowupHistoryList({
  container,
  followupHistory,
  onDelete
}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(followupHistory) || followupHistory.length === 0) {
    container.innerText = "暂无追问历史。";
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
      onDelete?.(index);
    });

    container.appendChild(box);
  });
}

export function renderLocalResults({
  container,
  results,
  calculateConfidence
}) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(results) || results.length === 0) {
    const li = document.createElement("li");
    li.textContent = "暂无本地分析结果。";
    container.appendChild(li);
    return;
  }

  const maxScore = results.length > 0 ? results[0].score : 0;

  results.forEach((answer, index) => {
    const li = document.createElement("li");

    const label = index === 0 ? "最可能" : "";
    const confidence = calculateConfidence(answer.score, maxScore);

    const logText =
      answer.logs && answer.logs.length > 0
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

    container.appendChild(li);
  });
}