export function buildOcrDebugReport({
  mode,
  cropInfo,
  flowLog,
  hintText,
  guessText,
  mergedText,
  cluePreview,
  guessPreview,
  noisePreview,
  aiPrompt,
  aiResponse
}) {
  return `# OCR Debug Report

## Mode

${mode || "N/A"}

## Crop Info

${cropInfo || "N/A"}

## OCR Flow Log

${flowLog || "N/A"}

## Hint Region OCR Text

${hintText || "N/A"}

## Guess Region OCR Text

${guessText || "N/A"}

## Merged OCR Text

${mergedText || "N/A"}

## Parsed Clues

${cluePreview || "N/A"}

## Parsed Guesses

${guessPreview || "N/A"}

## Filtered Noise

${noisePreview || "N/A"}

## AI Prompt

${aiPrompt || "N/A"}

## AI Response

${aiResponse || "N/A"}
`;
}

export function createTextDownload({
  text,
  filenamePrefix = "ocr-debug-report"
}) {
  const now = new Date();
  const dateText = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `${filenamePrefix}-${dateText}.txt`;

  const blob = new Blob([text], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}