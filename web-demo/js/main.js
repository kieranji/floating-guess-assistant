export function initApp({
  checkRequiredElements,
  setupEventListeners,
  dom,
  getLatestAiJson,
  handlers,
  loadSectionStates,
  setupSectionStateSaving,
  setupQuickNav,
  loadJson,
  saveJson,
  loadFromLocalStorage,
  loadWordBank
}) {
  checkRequiredElements();

  setupEventListeners({
    dom,
    getLatestAiJson,
    handlers
  });

  loadSectionStates(loadJson);
  setupSectionStateSaving(saveJson);
  setupQuickNav(saveJson);
  loadFromLocalStorage();
  loadWordBank();
}