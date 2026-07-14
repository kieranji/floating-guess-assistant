import { STORAGE_KEYS } from "./state.js";

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

export function saveSectionStates(storageSaveFn) {
  const sections = document.querySelectorAll(".section-details");
  const states = {};

  sections.forEach((section) => {
    const key = section.dataset.section;

    if (key) {
      states[key] = section.open;
    }
  });

  storageSaveFn(STORAGE_KEYS.sectionStates, states);
}

export function loadSectionStates(storageLoadFn) {
  const states = storageLoadFn(STORAGE_KEYS.sectionStates, null);

  if (!states) {
    return;
  }

  const sections = document.querySelectorAll(".section-details");

  sections.forEach((section) => {
    const key = section.dataset.section;

    if (key && Object.prototype.hasOwnProperty.call(states, key)) {
      section.open = states[key];
    }
  });
}

export function setupSectionStateSaving(storageSaveFn) {
  const sections = document.querySelectorAll(".section-details");

  sections.forEach((section) => {
    section.addEventListener("toggle", () => {
      saveSectionStates(storageSaveFn);
    });
  });
}

export function setupQuickNav(storageSaveFn) {
  const navButtons = document.querySelectorAll("[data-target-section]");

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetKey = button.dataset.targetSection;
      const targetSection = document.querySelector(
        `.section-details[data-section="${targetKey}"]`
      );

      if (!targetSection) {
        alert("没有找到对应区域。");
        return;
      }

      targetSection.open = true;
      saveSectionStates(storageSaveFn);

      targetSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
}