import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecentUsernames,
  getLastUsername,
  saveRecentUsername,
  removeRecentUsername,
} from '../src/lib/chesscom/storage';

// Mock localStorage for Node test runner
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value.toString(); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
};
(globalThis as any).localStorage = localStorageMock;

describe('Chess.com Username Storage (TDD & Incremental Slice 1)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns empty array and empty string when no usernames saved', () => {
    expect(getRecentUsernames()).toEqual([]);
    expect(getLastUsername()).toBe('');
  });

  it('saves and retrieves the most recent username', () => {
    saveRecentUsername('aghits_assiddiq');
    expect(getLastUsername()).toBe('aghits_assiddiq');
    expect(getRecentUsernames()).toEqual(['aghits_assiddiq']);
  });

  it('deduplicates case-insensitively and puts the latest at the front', () => {
    saveRecentUsername('hikaru');
    saveRecentUsername('MagnusCarlsen');
    saveRecentUsername('HIKARU'); // Re-saving with different casing

    const recent = getRecentUsernames();
    expect(recent).toHaveLength(2);
    expect(recent[0]).toBe('HIKARU');
    expect(recent[1]).toBe('MagnusCarlsen');
    expect(getLastUsername()).toBe('HIKARU');
  });

  it('caps the list at 5 usernames', () => {
    saveRecentUsername('user1');
    saveRecentUsername('user2');
    saveRecentUsername('user3');
    saveRecentUsername('user4');
    saveRecentUsername('user5');
    saveRecentUsername('user6');

    const recent = getRecentUsernames();
    expect(recent).toHaveLength(5);
    expect(recent[0]).toBe('user6');
    expect(recent).not.toContain('user1');
  });

  it('removes a username properly', () => {
    saveRecentUsername('userA');
    saveRecentUsername('userB');
    removeRecentUsername('userA');

    expect(getRecentUsernames()).toEqual(['userB']);
  });
});
