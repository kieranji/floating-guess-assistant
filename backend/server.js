import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.AI_API_KEY
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Floating Guess Assistant backend is running."
  });
});

app.post("/api/analyze", async (req, res) => {
  const { mode, clues, guesses, customWords } = req.body;

  if (!clues && (!guesses || guesses.length === 0)) {
    return res.status(400).json({
      error: "Please provide clues or guesses."
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

请输出：
1. 最可能答案 Top 10
2. 每个答案的可能性百分比
3. 每个答案的推理理由
4. 下一步最值得尝试的 5 个词
5. 不确定性说明
`;

    if (!process.env.AI_API_KEY) {
    return res.status(500).json({
      error: "Missing AI_API_KEY in backend environment."
    });
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
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

    const aiText = completion.choices[0]?.message?.content || "AI 没有返回内容。";

    res.json({
      prompt,
      aiText
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "AI request failed."
    });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});