export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
