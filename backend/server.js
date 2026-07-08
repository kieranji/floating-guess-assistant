import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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

  // 目前先不真正调用 AI，先返回 prompt。
  // 下一步我们再把这里接到真正的 AI API。
  res.json({
    prompt,
    mockResult: [
      {
        word: "光阴似箭",
        confidence: 92,
        reason: "线索和“时间过得很快”高度相关。"
      },
      {
        word: "日月如梭",
        confidence: 86,
        reason: "同样是时间流逝类成语。"
      }
    ]
  });
});

app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});