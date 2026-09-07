import React, { useMemo } from 'react';
import { EvaluatedMove } from '../../lib/chess/types';
import { getClassificationSummary, ClassificationSummaryItem } from '../../lib/chess/evalClassifier';

interface GameReviewCardProps {
  moves: EvaluatedMove[];
  whiteName: string;
  blackName: string;
  whiteRating?: number;
  blackRating?: number;
  currentPly?: number;
  onSelectPly?: (ply: number) => void;
  className?: string;
}

export const GameReviewCard: React.FC<GameReviewCardProps> = ({
  moves,
  whiteName,
  blackName,
  whiteRating,
  blackRating,
  currentPly,
  onSelectPly,
  className = '',
}) => {
  const summary = useMemo(() => getClassificationSummary(moves), [moves]);

  // Helper to find ply of next move with this classification and color
  const handleCategoryClick = (key: string, color: 'w' | 'b') => {
    if (!onSelectPly) return;
    const matchingMoves = moves.filter((m) => {
      let cls = m.classification;
      if (cls === 'book') cls = 'theoretical';
      if (cls === 'best') cls = 'optimal';
      if (cls === 'good') cls = 'sound';
      if (cls === 'inaccuracy') cls = 'imprecise';
      return cls === key && m.color === color;
    });

    if (matchingMoves.length === 0) return;

    // Cycle to next occurrence after currentPly, or wrap to first
    const nextMove =
      matchingMoves.find((m) => currentPly !== undefined && m.ply > currentPly) ||
      matchingMoves[0];

    onSelectPly(nextMove.ply);
  };

  return (
    <div className={`flex flex-col rounded border border-zinc-800 bg-zinc-900 p-4 sm:p-5 shadow-sm space-y-4 select-none ${className}`}>
      {/* Accuracy Header Banner */}
      <div className="grid grid-cols-2 gap-3 items-center border-b border-zinc-800 pb-4">
        {/* White Player Accuracy */}
        <div className="flex flex-col items-center justify-center p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium truncate max-w-full">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-white border border-zinc-400" />
            <span className="truncate">{whiteName}</span>
            {whiteRating && <span className="text-zinc-500 font-mono text-[10px]">({whiteRating})</span>}
          </div>
          <div className="mt-1 text-2xl sm:text-3xl font-mono font-black text-white tracking-tight">
            {summary.whiteAccuracy.toFixed(1)}
            <span className="text-xs text-zinc-400 font-sans ml-0.5">%</span>
          </div>
          <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Accuracy</span>
        </div>

        {/* Black Player Accuracy */}
        <div className="flex flex-col items-center justify-center p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium truncate max-w-full">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-500" />
            <span className="truncate">{blackName}</span>
            {blackRating && <span className="text-zinc-500 font-mono text-[10px]">({blackRating})</span>}
          </div>
          <div className="mt-1 text-2xl sm:text-3xl font-mono font-black text-zinc-100 tracking-tight">
            {summary.blackAccuracy.toFixed(1)}
            <span className="text-xs text-zinc-400 font-sans ml-0.5">%</span>
          </div>
          <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Accuracy</span>
        </div>
      </div>

      {/* 10-Tier Move Comparison Table */}
      <div className="flex flex-col divide-y divide-zinc-800/60 text-xs">
        {summary.items.map((row: ClassificationSummaryItem) => {
          const hasWhite = row.whiteCount > 0;
          const hasBlack = row.blackCount > 0;

          return (
            <div
              key={row.key}
              className="flex items-center justify-between py-2 px-1 hover:bg-zinc-800/30 rounded transition-colors"
            >
              {/* Category Name */}
              <div className="w-28 sm:w-32 text-left font-medium text-zinc-300 truncate">
                {row.name}
              </div>

              {/* White Count */}
              <button
                type="button"
                disabled={!hasWhite}
                onClick={() => handleCategoryClick(row.key, 'w')}
                className={`w-10 text-center font-mono font-bold transition-transform ${
                  hasWhite
                    ? 'text-zinc-100 hover:text-amber-300 hover:scale-110 cursor-pointer'
                    : 'text-zinc-600 cursor-default'
                }`}
                title={hasWhite ? `Jump to White's ${row.name}` : undefined}
              >
                {row.whiteCount}
              </button>

              {/* Central Badge Icon */}
              <div className="flex items-center justify-center w-8">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-mono leading-none shadow-xs select-none ${row.badgeBg} ${row.badgeBorder} ${row.badgeText}`}
                  title={row.name}
                >
                  {row.symbol}
                </div>
              </div>

              {/* Black Count */}
              <button
                type="button"
                disabled={!hasBlack}
                onClick={() => handleCategoryClick(row.key, 'b')}
                className={`w-10 text-center font-mono font-bold transition-transform ${
                  hasBlack
                    ? 'text-zinc-100 hover:text-amber-300 hover:scale-110 cursor-pointer'
                    : 'text-zinc-600 cursor-default'
                }`}
                title={hasBlack ? `Jump to Black's ${row.name}` : undefined}
              >
                {row.blackCount}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="pt-2 text-center text-[11px] text-zinc-500">
        Click any count to inspect that move directly on the board.
      </div>
    </div>
  );
};
