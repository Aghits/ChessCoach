import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EvalBar } from '../src/components/Board/EvalBar';

describe('EvalBar Player Color Orientation (TDD)', () => {
  it('renders bottom bar as white and top as black when orientation is white', () => {
    // When orientation is white, bottom of board is White player and top is Black player
    const html = renderToString(
      React.createElement(EvalBar, {
        evalScore: 0,
        orientation: 'white',
      })
    );

    // Top portion must be black/dark (Black player at rank 8)
    // Bottom portion must be white/light (White player at rank 1)
    expect(html).toMatch(/class="[^"]*bg-zinc-900[^"]*"[^>]*style="height:\s*50%"/);
    expect(html).toMatch(/class="[^"]*bg-zinc-200[^"]*"[^>]*style="height:\s*50%"/);
  });

  it('renders bottom bar as black and top as white when orientation is black', () => {
    // When orientation is black, bottom of board is Black player and top is White player
    const html = renderToString(
      React.createElement(EvalBar, {
        evalScore: 0,
        orientation: 'black',
      })
    );

    // Top portion must be white/light (White player at rank 1)
    // Bottom portion must be black/dark (Black player at rank 8)
    // Verify top div is bg-zinc-200 and bottom div is bg-zinc-900
    expect(html).toMatch(/<div class="[^"]*bg-zinc-200[^"]*"[^>]*style="height:\s*50%"/);
    expect(html).toMatch(/<div class="[^"]*bg-zinc-900[^"]*"[^>]*style="height:\s*50%"/);
  });

  it('correctly expands black bar at the bottom when Black is winning in black orientation', () => {
    // evalScore is -300 from White's perspective (+3.0 for Black)
    const html = renderToString(
      React.createElement(EvalBar, {
        evalScore: -300,
        orientation: 'black',
      })
    );

    // In black orientation:
    // Top is White player: ~26% height, colored bg-zinc-200 (white)
    // Bottom is Black player: ~74% height, colored bg-zinc-900 (black)
    // Black bar should be at the bottom matching Black player's side
    expect(html).toMatch(/<div class="[^"]*bg-zinc-200[^"]*"[^>]*style="height:\s*2[5-7]%"/);
    expect(html).toMatch(/<div class="[^"]*bg-zinc-900[^"]*"[^>]*style="height:\s*7[3-5]%"/);
  });
});
