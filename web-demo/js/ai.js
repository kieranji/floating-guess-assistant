export function buildGeneralAiPrompt({ mode, clues, guesses, customWords }) {
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

  return `你是一个猜词游戏分析助手。请根据下面的信息，推测最可能的答案。

游戏模式：${modeName}

已知线索：
${clues || "暂无线索"}

历史猜测和相似度：
${guessesText}
重要规则：
- 历史猜测词已经被玩家猜过，因此它们都不是正确答案。
- 历史猜测词只能作为语义接近程度参考。
- candidates 中禁止包含历史猜测里已经出现过的词。
- 相似度越高，说明正确答案越接近这个词，但正确答案必须是另一个词。

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
}

export function buildOcrLivePrompt({
  rawOcrText,
  clueText,
  guessText,
  noiseText
}) {
  return `你是一个直播猜词截图分析助手。下面内容来自直播间截图 OCR，可能存在错字、漏字、顺序错乱。

请根据 OCR 结果、可能线索、历史猜测和相似度，推测当前题目的最可能答案。

原始 OCR 文本：
${rawOcrText || "暂无"}

可能线索：
${clueText || "暂无"}

历史猜测和相似度：
${guessText || "暂无"}

被过滤内容，可能包含 OCR 噪声，也可能有少量有用信息：
${noiseText || "暂无"}

请输出严格 JSON，不要输出 Markdown，不要输出解释性前后缀。

JSON 格式：
{
  "candidates": [
    {
      "word": "候选答案",
      "confidence": 0到100之间的数字,
      "reason": "为什么可能是这个答案",
      "keywords": ["关键词1", "关键词2", "关键词3"]
    }
  ],
  "nextGuesses": ["下一步建议猜测词1", "下一步建议猜测词2", "下一步建议猜测词3", "下一步建议猜测词4", "下一步建议猜测词5"],
  "uncertainty": "不确定性说明"
}

要求：
- candidates 最多 10 个。
- confidence 必须是数字，不要带百分号。
- 如果 OCR 内容疑似有错，请在 reason 或 uncertainty 里说明。
- 不要只看最高分猜测，要结合题目线索和相似度分布。
- 如果历史猜测分数较低，说明这些方向可能不是答案。
- 如果信息不足，请说明还需要什么线索。`;
}

export async function analyzeWithAiBackend({
  backendUrl,
  mode,
  clues,
  guesses,
  customWords
}) {
  const response = await fetch(`${backendUrl}/api/analyze`, {
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
    throw new Error("后端返回的不是 JSON，可能是 BACKEND_URL 写错或后端没有运行。");
  }

  if (!response.ok) {
    throw new Error(data.details || data.error || "后端 AI 分析失败。");
  }

  return data;
}