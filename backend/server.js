import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const zhipuClient = new OpenAI({
  apiKey: process.env.ZHIPU_API_KEY,
  baseURL: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/"
});

const ZHIPU_VISION_MODEL = process.env.ZHIPU_VISION_MODEL || "glm-4v-flash";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
});

app.use(cors());
app.use(express.json({ limit: "12mb" }));

app.get("/", (req, res) => {
  res.json({
    message: "Floating Guess Assistant backend is running with DeepSeek."
  });
});

app.post("/api/analyze", async (req, res) => {
  const { mode, clues, guesses, customWords } = req.body;

  if (!clues && (!guesses || guesses.length === 0) && (!customWords || customWords.length === 0)) {
    return res.status(400).json({
      error: "Please provide clues, guesses, or custom words."
    });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({
      error: "Missing DEEPSEEK_API_KEY in backend environment."
    });
  }

  const modeName = mode === "semantic" ? "相似度猜词" : "揭字猜词";

  const prompt = `
你是一个猜词游戏分析助手。请根据下面的信息，推测最可能的答案。

游戏模式：${modeName}

已知线索：
${clues || "暂无线索"}

历史猜测和相似度：
${JSON.stringify(guesses || [], null, 2)}

临时候选词：
${JSON.stringify(customWords || [], null, 2)}

请严格输出 JSON，不要输出 Markdown，不要输出解释性前后缀。

JSON 格式必须是：
{
  "candidates": [
    {
      "word": "候选答案",
      "confidence": 0到100之间的数字,
      "reason": "推理理由",
      "keywords": ["关键词1", "关键词2", "关键词3", "关键词4"]
    }
  ],
  "nextGuesses": ["下一步建议词1", "下一步建议词2", "下一步建议词3", "下一步建议词4", "下一步建议词5"],
  "uncertainty": "不确定性说明"
}

要求：
- candidates 最多 10 个。
- confidence 必须是数字，不要带百分号。
- reason 要简短清晰。
- 只返回 JSON 本身。
- 每个 candidate 必须包含 keywords，keywords 用于本地规则匹配。
`;

  try {
    const modelName = process.env.DEEPSEEK_MODEL || "deepseek-chat";

    console.log("Using DeepSeek model:", modelName);

    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "你是一个猜词游戏分析助手。你需要根据线索、历史猜测和候选词，给出清晰、谨慎的答案推测。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7
    });

    const aiText =
      completion.choices?.[0]?.message?.content || "DeepSeek 没有返回内容。";

    let aiJson = null;

    try {
      const cleanedText = aiText
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();

      aiJson = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("AI JSON parse failed:", parseError);
    }

    res.json({
      prompt,
      aiText,
      aiJson
    });
    
  } catch (error) {
    console.error("DeepSeek error:", error);

    res.status(500).json({
      error: "DeepSeek request failed.",
      details: error.message || String(error)
    });
  }
});

app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageDataUrl } = req.body;

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({
        error: "缺少有效图片。请传入 imageDataUrl。"
      });
    }

    if (!process.env.ZHIPU_API_KEY) {
      return res.status(500).json({
        error: "后端缺少 ZHIPU_API_KEY 环境变量。"
      });
    }

    const prompt = `你是一个直播猜词游戏助手。请直接分析这张截图。

任务：
1. 找出题目线索，例如词性、答案字数、分类、提示文字。
2. 找出历史猜测词和关联度/相似度。
3. 忽略排行榜、用户名、礼物、手机状态栏、广告、无关数字。
4. 根据题目线索和历史猜测，推测最可能答案。
5. 输出 JSON，不要输出 Markdown，不要解释 JSON 外的内容。

截图常见结构：
- 中上方可能有词性，例如：动词、名词、成语等。
- 中上方可能有“答案 2 字 / 答案 4 字”。
- 左侧表格通常是历史猜测词和关联度。
- 右侧排行榜通常是噪声，不要当作猜测词。
- OCR 可能不准，你要结合画面理解。

请严格输出这个 JSON 结构：
{
  "mode": "semantic",
  "answerLength": 0,
  "topicClues": [],
  "guesses": [
    {
      "word": "猜测词",
      "score": 0
    }
  ],
  "candidates": [
    {
      "word": "候选答案",
      "confidence": 0,
      "keywords": ["关键词1", "关键词2"],
      "reason": "为什么可能是答案"
    }
  ],
  "nextGuesses": [],
  "warnings": []
}

要求：
- candidates 至少给 5 个。
- confidence 是 0 到 100。
- 如果看不清，不要乱编，在 warnings 里说明。
- 如果识别到答案字数，填 answerLength。
- guesses 只保留真实历史猜测，不要把排行榜名字放进去。`;

    const completion = await zhipuClient.chat.completions.create({
      model: ZHIPU_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 1024
    });

    const aiText = completion.choices?.[0]?.message?.content || "";
    const aiJson = extractJsonFromText(aiText);

    return res.json({
      provider: "zhipu",
      model: ZHIPU_VISION_MODEL,
      aiText,
      aiJson
    });
  } catch (error) {
    console.error("视觉 AI 分析失败：", error);

    return res.status(500).json({
      error: error.message || "视觉 AI 分析失败。"
    });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});

function extractJsonFromText(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    // continue
  }

  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch (error) {
    return null;
  }
}