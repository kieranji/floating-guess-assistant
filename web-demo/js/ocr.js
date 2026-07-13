export async function createCroppedOcrImage(file, crop) {
  if (!crop) {
    return file;
  }

  const image = new Image();
  const imageUrl = URL.createObjectURL(file);

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  const safeX = Math.max(0, Math.min(crop.x, image.naturalWidth));
  const safeY = Math.max(0, Math.min(crop.y, image.naturalHeight));
  const safeWidth = Math.max(1, Math.min(crop.width, image.naturalWidth - safeX));
  const safeHeight = Math.max(1, Math.min(crop.height, image.naturalHeight - safeY));

  canvas.width = safeWidth;
  canvas.height = safeHeight;

  context.drawImage(
    image,
    safeX,
    safeY,
    safeWidth,
    safeHeight,
    0,
    0,
    safeWidth,
    safeHeight
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || file);
    }, "image/png");
  });
}

export async function preprocessOcrImage(imageBlobOrFile, options = {}) {
  const {
    usePreprocess = true,
    scale = 2,
    contrast = 1.35,
    brightness = 8
  } = options;

  if (!usePreprocess) {
    return imageBlobOrFile;
  }

  const image = new Image();
  const imageUrl = URL.createObjectURL(imageBlobOrFile);

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageUrl;
  });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = image.naturalWidth * scale;
  canvas.height = image.naturalHeight * scale;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];

    let value = (gray - 128) * contrast + 128 + brightness;
    value = Math.max(0, Math.min(255, value));

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  context.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob || imageBlobOrFile);
    }, "image/png");
  });
}

export async function runOcrOnImage({
  file,
  crop,
  usePreprocess,
  scale,
  logger
}) {
  if (!file) {
    throw new Error("请先选择一张图片。");
  }

  const croppedImage = await createCroppedOcrImage(file, crop);

  const imageForOcr = await preprocessOcrImage(croppedImage, {
    usePreprocess,
    scale
  });

  const result = await Tesseract.recognize(imageForOcr, "chi_sim+eng", {
    logger
  });

  return result.data.text.trim();
}