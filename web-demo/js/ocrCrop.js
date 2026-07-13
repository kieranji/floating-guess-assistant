export function getCropSettingsFromInputs({ xInput, yInput, widthInput, heightInput }) {
  const x = xInput ? Number(xInput.value) : 0;
  const y = yInput ? Number(yInput.value) : 0;
  const width = widthInput ? Number(widthInput.value) : 0;
  const height = heightInput ? Number(heightInput.value) : 0;

  if (
    Number.isNaN(x) ||
    Number.isNaN(y) ||
    Number.isNaN(width) ||
    Number.isNaN(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return {
    x,
    y,
    width,
    height
  };
}

export function getImageSize(imageElement) {
  if (
    !imageElement ||
    !imageElement.naturalWidth ||
    !imageElement.naturalHeight
  ) {
    return null;
  }

  return {
    width: imageElement.naturalWidth,
    height: imageElement.naturalHeight
  };
}

export function calculateCropPreset(preset, imageSize) {
  if (!imageSize) {
    return null;
  }

  const width = imageSize.width;
  const height = imageSize.height;

  if (preset === "full") {
    return null;
  }

  if (preset === "top") {
    return {
      x: 0,
      y: 0,
      width,
      height: height * 0.5
    };
  }

  if (preset === "bottom") {
    return {
      x: 0,
      y: height * 0.5,
      width,
      height: height * 0.5
    };
  }

  if (preset === "left") {
    return {
      x: 0,
      y: 0,
      width: width * 0.5,
      height
    };
  }

  if (preset === "right") {
    return {
      x: width * 0.5,
      y: 0,
      width: width * 0.5,
      height
    };
  }

  if (preset === "center") {
    return {
      x: width * 0.15,
      y: height * 0.15,
      width: width * 0.7,
      height: height * 0.7
    };
  }

  return null;
}

export function calculateSelectionBoxFromCrop({ crop, imageElement }) {
  if (!crop || !imageElement) {
    return null;
  }

  const rect = imageElement.getBoundingClientRect();

  if (
    !rect.width ||
    !rect.height ||
    !imageElement.naturalWidth ||
    !imageElement.naturalHeight
  ) {
    return null;
  }

  const scaleX = rect.width / imageElement.naturalWidth;
  const scaleY = rect.height / imageElement.naturalHeight;

  return {
    left: crop.x * scaleX,
    top: crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY
  };
}

export function convertDisplaySelectionToImageCrop({
  displayLeft,
  displayTop,
  displayWidth,
  displayHeight,
  imageElement
}) {
  if (!imageElement) {
    return null;
  }

  const rect = imageElement.getBoundingClientRect();

  if (
    !rect.width ||
    !rect.height ||
    !imageElement.naturalWidth ||
    !imageElement.naturalHeight
  ) {
    return null;
  }

  const scaleX = imageElement.naturalWidth / rect.width;
  const scaleY = imageElement.naturalHeight / rect.height;

  return {
    x: Math.round(displayLeft * scaleX),
    y: Math.round(displayTop * scaleY),
    width: Math.round(displayWidth * scaleX),
    height: Math.round(displayHeight * scaleY)
  };
}