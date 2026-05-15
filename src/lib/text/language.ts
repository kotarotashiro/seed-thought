export function isLikelyJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

export function needsJapaneseTranslation(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  return !isLikelyJapanese(trimmed);
}
