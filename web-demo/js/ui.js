export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function updateText(element, message) {
  if (element) {
    element.textContent = message;
  }
}

export function checkElements(requiredElements) {
  const missingElements = Object.entries(requiredElements)
    .filter(([, element]) => !element)
    .map(([name]) => name);

  if (missingElements.length > 0) {
    console.error("页面缺少这些元素：", missingElements);
    alert(`页面缺少 ${missingElements.length} 个元素，请打开控制台查看详情。`);
  }

  return missingElements;
}