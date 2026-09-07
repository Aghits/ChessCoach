import React, { useEffect, useRef } from 'react';
import { EvaluatedMove, MoveClassification } from '../../lib/chess/types';

export interface MoveListProps {
  moves: EvaluatedMove[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  className?: string;
}

const BADGE_CONFIG: Record<MoveClassification, { label: string; bg: string; text: string }> = {
  masterstroke: { label: '!!', bg: 'bg-teal-950/80 border border-teal-700', text: 'text-teal-300' },
  sharp: { label: '!', bg: 'bg-blue-950/80 border border-blue-700', text: 'text-blue-300' },
  theoretical: { label: '📖', bg: 'bg-amber-950/80 border border-amber-800', text: 'text-amber-300' },
  optimal: { label: '★', bg: 'bg-emerald-950/80 border border-emerald-800', text: 'text-emerald-300' },
  strong: { label: '👍', bg: 'bg-lime-950/80 border border-lime-800', text: 'text-lime-300' },
  sound: { label: '✓', bg: 'bg-teal-950/60 border border-teal-800/60', text: 'text-teal-300' },
  imprecise: { label: '?!', bg: 'bg-yellow-950/80 border border-yellow-800', text: 'text-yellow-300' },
  mistake: { label: '?', bg: 'bg-orange-950/80 border border-orange-800', text: 'text-orange-300' },
  miss: { label: '❌', bg: 'bg-rose-950/80 border border-rose-800', text: 'text-rose-300' },
  blunder: { label: '??', bg: 'bg-red-950/80 border border-red-800', text: 'text-red-300' },
  // Backward compatibility aliases
  best: { label: '★', bg: 'bg-emerald-950/80 border border-emerald-800', text: 'text-emerald-300' },
  good: { label: '✓', bg: 'bg-teal-950/60 border border-teal-800/60', text: 'text-teal-300' },
  book: { label: '📖', bg: 'bg-amber-950/80 border border-amber-800', text: 'text-amber-300' },
  inaccuracy: { label: '?!', bg: 'bg-yellow-950/80 border border-yellow-800', text: 'text-yellow-300' },
};

export const MoveList: React.FC<MoveListProps> = ({
  moves,
  currentPly,
  onSelectPly,
  className = 'h-[340px] sm:h-[380px]',
}) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentPly]);

  // Group moves into pairs (White & Black)
  const rows: { moveNumber: number; white?: EvaluatedMove; black?: EvaluatedMove }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  const renderMoveBtn = (m?: EvaluatedMove) => {
    if (!m) return <div className="flex-1" />;
    const isActive = m.ply === currentPly;
    const badge = m.classification ? BADGE_CONFIG[m.classification] : null;

    return (
      <button
        ref={isActive ? activeRef : null}
        type="button"
        onClick={() => onSelectPly(m.ply)}
        className={`flex flex-1 items-center justify-between rounded px-2 py-1 text-xs font-mono transition-colors ${
          isActive
            ? 'bg-amber-500/20 text-amber-200 font-semibold border border-amber-500/40'
            : 'text-zinc-300 hover:bg-zinc-800'
        }`}
      >
        <span>{m.san}</span>
        {badge && (
          <span
            className={`ml-1.5 rounded px-1 py-0.2 text-[10px] font-sans font-bold leading-tight ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`flex flex-col ${className} overflow-hidden rounded border border-zinc-800 bg-zinc-950 shadow-xs select-none`}>
      {/* Pinned Top Bar */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-400 flex justify-between items-center backdrop-blur-xs">
        <span className="font-semibold text-zinc-300">Moves ({moves.length})</span>
        <button
          type="button"
          onClick={() => onSelectPly(0)}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset to Start
        </button>
      </div>

      {/* Pinned Column Sub-headers */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-1 bg-zinc-900/40 border-b border-zinc-800/60 text-[10px] uppercase font-mono text-zinc-500 font-semibold tracking-wider">
        <span className="w-7 text-right">#</span>
        <span className="flex-1 px-2">White</span>
        <span className="flex-1 px-2">Black</span>
      </div>

      {/* Scrollable Notation Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-600">No game loaded yet</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.moveNumber}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors ${
                Math.floor((currentPly - 1) / 2) + 1 === row.moveNumber
                  ? 'bg-zinc-900/90'
                  : 'hover:bg-zinc-900/40'
              }`}
            >
              <span className="w-7 text-right text-[11px] text-zinc-500 font-mono select-none">
                {row.moveNumber}.
              </span>
              {renderMoveBtn(row.white)}
              {renderMoveBtn(row.black)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
