/** Random unique id for user-created entities (events, lanes, subtasks). */
export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
