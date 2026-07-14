export const STORAGE_KEYS = {
  appData: "floatingGuessAssistantData",
  sectionStates: "floatingGuessSectionStates"
};

export function createDefaultOcrRegionPresets() {
  return {
    hint: null,
    guess: null
  };
}