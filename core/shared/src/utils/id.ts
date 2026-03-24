/**
 * Alphabet for short alphanumeric IDs.
 * Excludes ambiguous characters like 0, O, I, l for better readability.
 */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ID_LENGTH = 10;

/**
 * Generate a short, unique alphanumeric ID.
 * Optimized for token efficiency in LLM contexts.
 */
export function generateId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}
