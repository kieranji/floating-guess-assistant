export function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`保存 localStorage 失败：${key}`, error);
    return false;
  }
}

export function loadJson(key, fallbackValue = null) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return fallbackValue;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(`读取 localStorage 失败：${key}`, error);
    return fallbackValue;
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`删除 localStorage 失败：${key}`, error);
    return false;
  }
}