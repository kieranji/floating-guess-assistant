export function parseOcrGuessText(rawText) {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const clues = [];
  const guesses = [];
  const noiseLines = [];
  const consumedLineIndexes = new Set();

  const hintParts = [];
  let expectingHintText = false;

  const noiseKeywords = [
    "用户名",
    "段位",
    "排行榜",
    "随机词",
    "点赞",
    "礼物",
    "全局加倍",
    "上局",
    "赢家",
    "剩余",
    "直播",
    "关注",
    "分享",
    "下载",
    "电量",
    "排名",
    "进入直播间",
    "发送",
    "评论",
    "弹幕"
  ];

  lines.forEach((line, index) => {
    if (consumedLineIndexes.has(index)) {
      return;
    }

    const normalizedLine = line
      .replace(/％/g, "%")
      .replace(/，/g, ",")
      .replace(/：/g, ":")
      .replace(/[|｜]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalizedLine) {
      return;
    }

    const compactLine = normalizedLine.replace(/\s+/g, "");

    const nextLine = lines[index + 1]
      ? lines[index + 1]
          .trim()
          .replace(/％/g, "%")
          .replace(/\s+/g, " ")
      : "";

    const isCurrentLineWord = /^[\u4e00-\u9fa5A-Za-z0-9]{1,12}$/.test(compactLine);
    const nextScoreMatch = nextLine.match(/^([0-9]{1,3}(?:\.[0-9]+)?)\s*%?$/);

    if (isCurrentLineWord && nextScoreMatch) {
      const score = Number(nextScoreMatch[1]);

      if (!Number.isNaN(score) && score >= 0 && score <= 100) {
        guesses.push({
          word: compactLine,
          score
        });

        consumedLineIndexes.add(index + 1);
        return;
      }
    }

    const hintLabelMatch = compactLine.match(/提示([1-9])\/([1-9])/);

    if (hintLabelMatch || compactLine === "提示") {
      expectingHintText = true;
      return;
    }

    const guessMatchesWithPercent = [
      ...normalizedLine.matchAll(
        /([\u4e00-\u9fa5A-Za-z0-9]{1,12})\s*([0-9]{1,3}(?:\.[0-9]+)?)\s*%/g
      )
    ];

    if (guessMatchesWithPercent.length > 0) {
      guessMatchesWithPercent.forEach((match) => {
        const word = match[1];
        const score = Number(match[2]);

        if (!Number.isNaN(score) && score >= 0 && score <= 100) {
          guesses.push({
            word,
            score
          });
        }
      });

      return;
    }

    const guessMatchWithoutPercent = normalizedLine.match(
      /^([\u4e00-\u9fa5A-Za-z0-9]{1,12})\s*([0-9]{1,3}(?:\.[0-9]+)?)$/
    );

    if (guessMatchWithoutPercent) {
      const word = guessMatchWithoutPercent[1];
      const score = Number(guessMatchWithoutPercent[2]);

      if (!Number.isNaN(score) && score >= 0 && score <= 100) {
        guesses.push({
          word,
          score
        });

        return;
      }
    }

    const lengthMatch = compactLine.match(/答案?([0-9一二三四五六七八九十])字/);

    if (lengthMatch) {
      clues.push(`答案字数：${lengthMatch[1]} 字`);
      return;
    }

    const isMostlyNumber = /^[0-9:.\s%]+$/.test(normalizedLine);

    if (isMostlyNumber) {
      noiseLines.push(normalizedLine);
      return;
    }

    const hasNoiseKeyword = noiseKeywords.some((keyword) =>
      normalizedLine.includes(keyword)
    );

    if (hasNoiseKeyword) {
      noiseLines.push(normalizedLine);
      return;
    }

    const isTooLong = normalizedLine.length > 40;

    if (isTooLong) {
      noiseLines.push(normalizedLine);
      return;
    }

    const hasUsefulChinese = /[\u4e00-\u9fa5]/.test(normalizedLine);

    if (!hasUsefulChinese) {
      noiseLines.push(normalizedLine);
      return;
    }

    if (expectingHintText) {
      hintParts.push(normalizedLine);
      expectingHintText = false;
      return;
    }

    clues.push(normalizedLine);
  });

  if (hintParts.length > 0) {
    clues.push(`提示：${[...new Set(hintParts)].join(" / ")}`);
  }

  const uniqueGuesses = [];
  const seenGuessKeys = new Set();

  guesses.forEach((guess) => {
    const key = `${guess.word}-${guess.score}`;

    if (!seenGuessKeys.has(key)) {
      seenGuessKeys.add(key);
      uniqueGuesses.push(guess);
    }
  });

  return {
    clues: [...new Set(clues)],
    guesses: uniqueGuesses,
    noiseLines: [...new Set(noiseLines)]
  };
}

export function parseGuessHistory(text) {
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

export function parseCustomWords(text, mode) {
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
}``