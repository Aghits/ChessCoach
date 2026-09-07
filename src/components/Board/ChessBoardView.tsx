import React, { useEffect, useMemo, forwardRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Square, Arrow, CustomSquareProps, CustomSquareStyles } from 'react-chessboard/dist/chessboard/types';
import { EvaluatedMove } from '../../lib/chess/types';
import { EvalBar } from './EvalBar';

interface ChessBoardViewProps {
  currentFen: string;
  orientation: 'white' | 'black';
  onFlipOrientation: () => void;
  currentMove?: EvaluatedMove;
  onPrevMove: () => void;
  onNextMove: () => void;
  onFirstMove: () => void;
  onLastMove: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  bestMoveArrow?: { from: string; to: string } | null;
  evalScore?: number;
  mateScore?: number;
  isCalculating?: boolean;
}

const BADGE_CONFIG: Record<
  string,
  { label: string; bg: string; border: string; text: string; name: string }
> = {
  masterstroke: { label: '!!', bg: 'bg-teal-500', border: 'border-teal-400', text: 'text-white font-bold', name: 'Masterstroke' },
  sharp: { label: '!', bg: 'bg-blue-500', border: 'border-blue-400', text: 'text-white font-bold', name: 'Sharp Find' },
  theoretical: { label: '📖', bg: 'bg-amber-800', border: 'border-amber-600', text: 'text-amber-100', name: 'Theoretical' },
  optimal: { label: '★', bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-white font-bold', name: 'Optimal' },
  strong: { label: '👍', bg: 'bg-lime-600', border: 'border-lime-400', text: 'text-white font-bold', name: 'Strong' },
  sound: { label: '✓', bg: 'bg-teal-700', border: 'border-teal-500', text: 'text-teal-100', name: 'Sound' },
  imprecise: { label: '?!', bg: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-zinc-950 font-bold', name: 'Imprecise' },
  mistake: { label: '?', bg: 'bg-orange-500', border: 'border-orange-400', text: 'text-white font-bold', name: 'Tactical Slip' },
  miss: { label: '❌', bg: 'bg-rose-500', border: 'border-rose-400', text: 'text-white font-bold', name: 'Missed Tactic' },
  blunder: { label: '??', bg: 'bg-red-600', border: 'border-red-400', text: 'text-white font-bold', name: 'Critical Blunder' },
  // Compatibility aliases
  best: { label: '★', bg: 'bg-emerald-600', border: 'border-emerald-400', text: 'text-white font-bold', name: 'Optimal' },
  good: { label: '✓', bg: 'bg-teal-700', border: 'border-teal-500', text: 'text-teal-100', name: 'Sound' },
  book: { label: '📖', bg: 'bg-amber-800', border: 'border-amber-600', text: 'text-amber-100', name: 'Theoretical' },
  inaccuracy: { label: '?!', bg: 'bg-yellow-500', border: 'border-yellow-300', text: 'text-zinc-950 font-bold', name: 'Imprecise' },
};

export const ChessBoardView: React.FC<ChessBoardViewProps> = ({
  currentFen,
  orientation,
  onFlipOrientation,
  currentMove,
  onPrevMove,
  onNextMove,
  onFirstMove,
  onLastMove,
  hasPrev,
  hasNext,
  bestMoveArrow,
  evalScore,
  mateScore,
  isCalculating,
}) => {
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevMove();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNextMove();
      } else if (e.key === 'Home') {
        e.preventDefault();
        onFirstMove();
      } else if (e.key === 'End') {
        e.preventDefault();
        onLastMove();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevMove, onNextMove, onFirstMove, onLastMove]);

  // Compute custom arrows: The arrow ONLY shows the best move recommendation
  const customArrows: Arrow[] = useMemo(() => {
    if (!bestMoveArrow) return [];
    return [
      [
        bestMoveArrow.from as Square,
        bestMoveArrow.to as Square,
        'rgba(16, 185, 129, 0.9)', // High-contrast emerald green for best move
      ],
    ];
  }, [bestMoveArrow]);

  // Highlight played move squares
  const customSquareStyles = useMemo<CustomSquareStyles>(() => {
    const styles: CustomSquareStyles = {};
    if (currentMove) {
      styles[currentMove.from as Square] = {
        backgroundColor: 'rgba(245, 158, 11, 0.22)',
      };
      styles[currentMove.to as Square] = {
        backgroundColor: 'rgba(245, 158, 11, 0.32)',
      };
    }
    return styles;
  }, [currentMove]);

  // Custom square renderer: stamps evaluation badge on the played move's destination square
  const CustomSquare = useMemo(() => {
    return forwardRef<HTMLDivElement, CustomSquareProps>(({ children, square, style }, ref) => {
      const isTargetSquare = currentMove?.to === square;
      const badge = isTargetSquare && currentMove?.classification
        ? BADGE_CONFIG[currentMove.classification]
        : null;

      return (
        <div ref={ref} style={{ ...style, position: 'relative' }}>
          {children}
          {badge && (
            <div
              className={`absolute top-0.5 right-0.5 z-20 flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-mono leading-none shadow-md pointer-events-none select-none ${badge.bg} ${badge.border} ${badge.text}`}
              title={`${badge.name}: ${currentMove?.san || ''}`}
            >
              {badge.label}
            </div>
          )}
        </div>
      );
    });
  }, [currentMove]);

  return (
    <div className="flex flex-col items-center select-none w-full">
      {/* Board & EvalBar Unit (Strictly Same Height Alignment) */}
      <div className="flex gap-2.5 sm:gap-3 items-stretch justify-center w-full max-w-[560px] sm:max-w-[600px] lg:max-w-[640px]">
        {/* Vertical Eval Bar (stretches to match exact board card height) */}
        <EvalBar
          evalScore={evalScore}
          mateScore={mateScore}
          orientation={orientation}
          isCalculating={isCalculating}
        />

        {/* Enlarged Chessboard Container */}
        <div className="flex-1 min-w-0 rounded border border-zinc-800 bg-zinc-900 p-2 shadow-lg">
          <Chessboard
            position={currentFen}
            boardOrientation={orientation}
            arePiecesDraggable={false}
            customBoardStyle={{
              borderRadius: '4px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            }}
            customDarkSquareStyle={{ backgroundColor: '#475569' }}
            customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
            customArrows={customArrows}
            customSquareStyles={customSquareStyles}
            customSquare={CustomSquare}
            animationDuration={180}
          />
        </div>
      </div>

      {/* Navigation Toolbar */}
      <div className="mt-3 flex w-full max-w-[560px] sm:max-w-[600px] lg:max-w-[640px] items-center justify-between rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1.5">
        <button
          type="button"
          onClick={onFlipOrientation}
          title="Flip Board"
          className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          ⇅ Flip ({orientation === 'white' ? 'White' : 'Black'})
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onFirstMove}
            disabled={!hasPrev}
            title="Start (Home)"
            className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            |◀
          </button>
          <button
            type="button"
            onClick={onPrevMove}
            disabled={!hasPrev}
            title="Previous (←)"
            className="rounded px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onNextMove}
            disabled={!hasNext}
            title="Next (→)"
            className="rounded px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-30"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={onLastMove}
            disabled={!hasNext}
            title="End (End)"
            className="rounded px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            ▶|
          </button>
        </div>

        <div className="text-[11px] text-zinc-500 font-mono">
          Keys: ← →
        </div>
      </div>
    </div>
  );
};
