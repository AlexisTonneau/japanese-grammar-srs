export interface MockAttempt {
  questionId: string;
  correct: boolean;
  at: string;
}

const KEY = "minna-srs:mock-attempts:v1";
const CHANGE_EVENT = "minna-srs:mock-change";

function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function onMockChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

export function readMockAttempts(): MockAttempt[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockAttempt[]) : [];
  } catch {
    return [];
  }
}

export function appendMockAttempt(entry: MockAttempt): void {
  const log = readMockAttempts();
  log.push(entry);
  localStorage.setItem(KEY, JSON.stringify(log));
  notifyChange();
}

export function writeMockAttempts(entries: MockAttempt[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
  notifyChange();
}

export function clearMockAttempts(): void {
  localStorage.removeItem(KEY);
  notifyChange();
}
