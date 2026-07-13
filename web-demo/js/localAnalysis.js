import { calculateScore } from "./scoring.js";

export function analyzeLocalCandidates({
  wordBank,
  mode,
  clues,
  guesses,
  customWords,
  limit = 5
}) {
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

  return results.slice(0, limit);
}