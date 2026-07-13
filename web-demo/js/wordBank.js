export async function loadWordBankFromJson(path = "data/wordBank.json") {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error("词库加载失败");
  }

  return response.json();
}