import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ChessComModal } from '../src/components/Importer/ChessComModal';
import { saveRecentUsername } from '../src/lib/chesscom/storage';

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

describe('ChessComModal Previous Username Persistence (TDD & Incremental Slice 2)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('renders with empty input and no recent chips when no history exists', () => {
    const html = renderToString(
      React.createElement(ChessComModal, {
        isOpen: true,
        onClose: () => {},
        onSelectGame: () => {},
      })
    );

    expect(html).toContain('placeholder="Enter Chess.com username');
    expect(html).not.toContain('Recent:');
  });

  it('pre-populates input with previously used username and renders recent chip', () => {
    saveRecentUsername('aghits_assiddiq');
    saveRecentUsername('hikaru');

    const html = renderToString(
      React.createElement(ChessComModal, {
        isOpen: true,
        onClose: () => {},
        onSelectGame: () => {},
      })
    );

    // Input should have the last used username value
    expect(html).toContain('value="hikaru"');
    // Recent chips section should be rendered
    expect(html).toContain('Recent:');
    expect(html).toContain('hikaru');
    expect(html).toContain('aghits_assiddiq');
  });
});
