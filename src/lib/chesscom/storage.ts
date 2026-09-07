const RECENT_USERS_KEY = 'chess_coach_recent_usernames';

/**
 * Retrieves the list of previously used Chess.com usernames from localStorage.
 */
export function getRecentUsernames(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * Returns the most recently used Chess.com username, or an empty string if none.
 */
export function getLastUsername(): string {
  const users = getRecentUsernames();
  return users[0] || '';
}

/**
 * Saves a username to the top of the recent list in localStorage.
 * Deduplicates case-insensitively and caps at 5 entries.
 */
export function saveRecentUsername(username: string): string[] {
  const clean = username.trim();
  if (!clean) return getRecentUsernames();

  try {
    const current = getRecentUsernames();
    const filtered = current.filter((u) => u.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, 5);
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [clean];
  }
}

/**
 * Removes a username from the recent list in localStorage.
 */
export function removeRecentUsername(username: string): string[] {
  try {
    const current = getRecentUsernames();
    const updated = current.filter((u) => u.toLowerCase() !== username.trim().toLowerCase());
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
