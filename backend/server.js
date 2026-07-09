import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
});

app.use(cors());
app.use(express.json());

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
      "reason": "推理理由"
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

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});