import React from 'react';

interface EvalBarProps {
  evalScore?: number; // centipawns from White's perspective (+100 = +1.0)
  mateScore?: number; // moves to mate (+2 = White mates in 2, -1 = Black mates in 1)
  orientation: 'white' | 'black';
  isCalculating?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({
  evalScore = 0,
  mateScore,
  orientation,
  isCalculating = false,
}) => {
  let whitePercent = 50;
  let evalText = '0.0';

  if (mateScore !== undefined && mateScore !== null) {
    if (mateScore > 0) {
      whitePercent = 100;
      evalText = `M${mateScore}`;
    } else {
      whitePercent = 0;
      evalText = `-M${Math.abs(mateScore)}`;
    }
  } else if (evalScore !== undefined && evalScore !== null) {
    // Standard logistic curve to convert centipawns to percentage
    // 0 cp -> 50%, +300 cp (+3.0) -> ~80%, +800 cp -> ~95%
    const winChance = 1 / (1 + Math.exp(-0.0035 * evalScore));
    whitePercent = Math.min(96, Math.max(4, Math.round(winChance * 100)));

    const scoreInPawns = evalScore / 100;
    evalText = scoreInPawns > 0 ? `+${scoreInPawns.toFixed(1)}` : scoreInPawns.toFixed(1);
    if (evalScore === 0) evalText = '0.0';
  }

  // Adjust display percentage according to board orientation
  // When orientation is 'white':
  //   - Top is Black player (rank 8): height is (100 - whitePercent)%, color is dark (bg-zinc-900)
  //   - Bottom is White player (rank 1): height is whitePercent%, color is white (bg-zinc-200)
  // When orientation is 'black':
  //   - Top is White player (rank 1): height is whitePercent%, color is white (bg-zinc-200)
  //   - Bottom is Black player (rank 8): height is (100 - whitePercent)%, color is dark (bg-zinc-900)
  const isWhiteOrientation = orientation === 'white';
  const topPercent = isWhiteOrientation ? 100 - whitePercent : whitePercent;
  const bottomPercent = 100 - topPercent;

  const topColor = isWhiteOrientation ? 'bg-zinc-900' : 'bg-zinc-200';
  const bottomColor = isWhiteOrientation ? 'bg-zinc-200' : 'bg-zinc-900';

  const topIsDark = isWhiteOrientation;
  const bottomIsDark = !isWhiteOrientation;

  // Place eval score inside whichever side has more territory (> 50%)
  const isTopDominant = topPercent >= 50;
  const dominantIsDark = isTopDominant ? topIsDark : bottomIsDark;

  return (
    <div className="relative flex w-7 min-w-7 sm:w-8 sm:min-w-8 flex-col items-center justify-between rounded border border-zinc-800 bg-zinc-900 overflow-hidden shadow-md select-none h-full">
      {/* Top portion */}
      <div
        className={`w-full ${topColor} transition-all duration-300 ease-out`}
        style={{ height: `${topPercent}%` }}
      />
      {/* Bottom portion */}
      <div
        className={`w-full ${bottomColor} transition-all duration-300 ease-out`}
        style={{ height: `${bottomPercent}%` }}
      />

      {/* Eval Text Overlay positioned in dominant section */}
      <div
        className={`absolute inset-x-0 ${
          isTopDominant ? 'top-2' : 'bottom-2'
        } flex justify-center`}
      >
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-mono font-bold leading-none ${
            dominantIsDark
              ? 'text-zinc-200 bg-zinc-950/70 border border-zinc-800/80'
              : 'text-zinc-900 bg-white/80 border border-zinc-300/80'
          }`}
        >
          {isCalculating ? '...' : evalText}
        </span>
      </div>
    </div>
  );
};
