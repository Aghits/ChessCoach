import React, { useState, useMemo, useEffect } from 'react';
import { Chess } from 'chess.js';
import { CoachingOutput } from '../../lib/ai/client';
import { EvaluatedMove } from '../../lib/chess/types';
import { formatRefutationLine } from '../../lib/chess/featureExtractor';

interface CoachCardProps {
  currentMove?: EvaluatedMove;
  coachingData: CoachingOutput | null;
  isLoading: boolean;
  onExplainClick: () => void;
  onPreviewBestMove?: () => void;
  isPreviewingBestMove?: boolean;
  onPreviewFen?: (fen: string | null) => void;
  previewingFen?: string | null;
}

const CLASSIFICATION_TAGS: Record<
  string,
  { label: string; icon: string; bg: string; text: string; border: string }
> = {
  masterstroke: { label: 'Masterstroke', icon: '!!', bg: 'bg-teal-950/80', text: 'text-teal-300', border: 'border-teal-700' },
  sharp: { label: 'Sharp Find', icon: '!', bg: 'bg-blue-950/80', text: 'text-blue-300', border: 'border-blue-700' },
  theoretical: { label: 'Theoretical', icon: '📖', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-800' },
  optimal: { label: 'Optimal', icon: '★', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-800' },
  strong: { label: 'Strong', icon: '👍', bg: 'bg-lime-950/80', text: 'text-lime-300', border: 'border-lime-800' },
  sound: { label: 'Sound', icon: '✓', bg: 'bg-teal-950/60', text: 'text-teal-300', border: 'border-teal-800/60' },
  imprecise: { label: 'Imprecise', icon: '?!', bg: 'bg-yellow-950/80', text: 'text-yellow-300', border: 'border-yellow-800' },
  mistake: { label: 'Tactical Slip', icon: '?', bg: 'bg-orange-950/80', text: 'text-orange-300', border: 'border-orange-800' },
  miss: { label: 'Missed Tactic', icon: '❌', bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-800' },
  blunder: { label: 'Critical Blunder', icon: '??', bg: 'bg-red-950/80', text: 'text-red-300', border: 'border-red-800' },
  // Compatibility aliases
  best: { label: 'Optimal', icon: '★', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-800' },
  good: { label: 'Sound', icon: '✓', bg: 'bg-teal-950/60', text: 'text-teal-300', border: 'border-teal-800/60' },
  book: { label: 'Theoretical', icon: '📖', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-800' },
  inaccuracy: { label: 'Imprecise', icon: '?!', bg: 'bg-yellow-950/80', text: 'text-yellow-300', border: 'border-yellow-800' },
};

export const CoachCard: React.FC<CoachCardProps> = ({
  currentMove,
  coachingData,
  isLoading,
  onExplainClick,
  onPreviewBestMove,
  isPreviewingBestMove = false,
  onPreviewFen,
  previewingFen,
}) => {
  const [showMoves, setShowMoves] = useState(false);

  useEffect(() => {
    setShowMoves(false);
  }, [currentMove?.ply]);

  const refutationDetails = useMemo(() => {
    if (!currentMove?.fen || !currentMove?.pvLine || currentMove.pvLine.length === 0) return null;
    let capturedPieceType: any = undefined;
    try {
      if (currentMove.previousFen && currentMove.to) {
        const prevChess = new Chess(currentMove.previousFen);
        const target = prevChess.get(currentMove.to as any);
        if (target) {
          capturedPieceType = target.type;
        }
      }
    } catch {}

    return formatRefutationLine(currentMove.fen, currentMove.pvLine, currentMove.ply, {
      from: currentMove.from,
      to: currentMove.to,
      san: currentMove.san,
      capturedPieceType,
      centipawnLoss: currentMove.centipawnLoss,
      classification: currentMove.classification,
    });
  }, [currentMove]);

  if (!currentMove) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/60 p-5 text-center text-xs text-zinc-500">
        Load a game and navigate to any move to inspect positional principles.
      </div>
    );
  }

  const isSignificant =
    currentMove.classification === 'blunder' ||
    currentMove.classification === 'miss' ||
    currentMove.classification === 'mistake' ||
    currentMove.classification === 'imprecise' ||
    currentMove.classification === 'inaccuracy';

  const isBook =
    Boolean(currentMove.isBook) ||
    currentMove.classification === 'theoretical' ||
    currentMove.classification === 'book';

  const tag = currentMove.classification ? CLASSIFICATION_TAGS[currentMove.classification] : null;

  return (
    <div className="flex flex-col rounded border border-zinc-800 bg-zinc-900 p-5 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-zinc-100">
            {currentMove.moveNumber}. {currentMove.color === 'b' ? '...' : ''}
            {currentMove.san}
          </span>
          {tag && (
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide border ${tag.bg} ${tag.text} ${tag.border}`}
            >
              <span className="font-bold">{tag.icon}</span>
              <span>{tag.label}</span>
            </span>
          )}
          {currentMove.centipawnLoss !== undefined && currentMove.centipawnLoss > 30 && (
            <span className="text-[11px] text-zinc-400 font-mono">
              (-{(currentMove.centipawnLoss / 100).toFixed(1)})
            </span>
          )}
        </div>

        {isBook ? (
          <div className="flex items-center gap-1.5 rounded border border-amber-800/70 bg-amber-950/60 px-2.5 py-1 text-xs font-semibold text-amber-300 shadow-xs select-none">
            <span>📖</span>
            <span>Opening Theory</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onExplainClick}
            disabled={isLoading}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              isSignificant
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Analyzing...' : coachingData ? 'Re-explain' : 'Explain Principle'}
          </button>
        )}
      </div>

      {/* Main Coaching Content */}
      {isLoading ? (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 text-xs text-zinc-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <span>Synthesizing chess principles & pocket rules...</span>
        </div>
      ) : coachingData ? (
        <div className="space-y-4 text-xs leading-relaxed">
          {/* Category & Imbalance Connection */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-medium">Position Imbalance:</span>
              <span className="rounded bg-zinc-800 px-2 py-0.5 font-medium text-amber-300">
                {coachingData.imbalance || coachingData.category}
              </span>
              {coachingData.source === 'ai' && (
                <span className="text-[10px] text-zinc-500 border border-zinc-700/50 rounded px-1">
                  AI Grounded
                </span>
              )}
            </div>
            {coachingData.imbalanceConnection && (
              <p className="text-[11px] text-zinc-400 pl-0.5">
                {coachingData.imbalanceConnection}
              </p>
            )}
          </div>

          {/* The Contrast (Move Comparison) */}
          <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              The Contrast: {currentMove.san} vs {currentMove.bestMoveSan || 'Best Move'}
            </div>
            <p className="text-zinc-200 leading-relaxed">
              {coachingData.moveDifference || coachingData.diagnosis}
            </p>
          </div>

          {/* Why Best Move is Superior */}
          {(coachingData.whyBetter || coachingData.whyEngineBetter) && (
            <div className="rounded border border-emerald-900/40 bg-emerald-950/20 p-3 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span>♟</span>
                <span>Why {currentMove.bestMoveSan || "Stockfish's Move"} is Superior</span>
              </div>
              <p className="text-emerald-100 leading-relaxed">
                {coachingData.whyBetter || coachingData.whyEngineBetter}
              </p>
            </div>
          )}

          {/* Practical Actionable Principle */}
          <div className="rounded border border-amber-900/40 bg-amber-950/20 p-3 space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>💡</span>
              <span>Practical Actionable Principle</span>
            </div>
            <p className="text-amber-100 font-medium leading-relaxed">
              {coachingData.practicalPrinciple || coachingData.pocketRule}
            </p>
          </div>

          {/* Engine Alternative & Refutation */}
          {(currentMove.bestMoveSan ||
            coachingData.refutationSummary ||
            (refutationDetails && refutationDetails.moves.length > 0)) && (
            <div className="rounded border border-zinc-800 bg-zinc-950/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-zinc-400">
                    {currentMove.classification === 'optimal' ||
                    currentMove.classification === 'best' ||
                    currentMove.classification === 'masterstroke' ||
                    currentMove.classification === 'theoretical' ||
                    currentMove.classification === 'book' ? (
                      <>
                        Stockfish confirms: <span className="font-mono font-bold text-emerald-400">{currentMove.san}</span> (Optimal move played)
                      </>
                    ) : (
                      <>
                        Stockfish recommends: <span className="font-mono font-bold text-emerald-400">{currentMove.bestMoveSan || currentMove.bestMoveUci}</span>
                      </>
                    )}
                  </div>
                  {coachingData.refutationSummary && (
                    <div className="mt-0.5 text-[11px] text-zinc-400">
                      {coachingData.refutationSummary}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {refutationDetails && refutationDetails.moves.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMoves(!showMoves)}
                      className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                        showMoves
                          ? 'border-amber-600 bg-amber-950/80 text-amber-200'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-amber-500 hover:text-white'
                      }`}
                    >
                      {showMoves ? 'Hide Moves' : 'Show Moves'}
                    </button>
                  )}

                  {onPreviewBestMove &&
                    currentMove.bestMoveUci &&
                    currentMove.classification !== 'optimal' &&
                    currentMove.classification !== 'best' &&
                    currentMove.classification !== 'masterstroke' &&
                    currentMove.classification !== 'theoretical' &&
                    currentMove.classification !== 'book' && (
                      <button
                        type="button"
                        onClick={onPreviewBestMove}
                        className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                          isPreviewingBestMove
                            ? 'border-emerald-600 bg-emerald-950 text-emerald-200'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300'
                        }`}
                      >
                        {isPreviewingBestMove ? 'Hide Engine Move' : 'Preview Move'}
                      </button>
                    )}
                </div>
              </div>

              {/* Continuation Moves Panel */}
              {showMoves && refutationDetails && refutationDetails.moves.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                      Tactical Continuation:
                    </span>
                    {previewingFen && (
                      <button
                        type="button"
                        onClick={() => onPreviewFen?.(null)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                      >
                        Reset Board
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {refutationDetails.moves.map((m, idx) => {
                      const isActive = previewingFen === m.fenAfter;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onPreviewFen?.(isActive ? null : m.fenAfter)}
                          className={`rounded px-2.5 py-1 font-mono text-xs font-medium border transition-colors flex items-center gap-1 ${
                            isActive
                              ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                              : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-amber-500 hover:text-white'
                          }`}
                          title={`Click to preview move ${m.notation} on the board`}
                        >
                          <span>{m.notation}</span>
                          {m.capturedPieceName && (
                            <span className="text-[10px] text-rose-300 font-sans">
                              (x {m.capturedPieceName.split(' ')[1] || 'piece'})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {refutationDetails.tacticalSummary && (
                    <div className="text-[11px] text-zinc-400">
                      {refutationDetails.isExchange ? (
                        <>
                          Exchange Sequence: <span className="text-zinc-300">{refutationDetails.tacticalSummary}</span>
                        </>
                      ) : (
                        <>
                          Concrete Impact: <span className="text-zinc-300">{refutationDetails.tacticalSummary}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : isBook ? (
        <div className="rounded border border-amber-800/60 bg-amber-950/20 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-800/80 text-amber-200 text-xs font-mono select-none">
              📖
            </span>
            <div className="flex items-center gap-2 font-medium">
              {currentMove.eco && (
                <span className="rounded bg-amber-900/60 border border-amber-700/60 px-1.5 py-0.5 font-mono text-[11px] text-amber-200 font-bold">
                  {currentMove.eco}
                </span>
              )}
              <span className="text-sm text-zinc-100 font-semibold">
                {currentMove.openingName || 'Established Opening Theory'}
              </span>
            </div>
          </div>
          <p className="text-xs text-zinc-400 pl-8 leading-relaxed">
            This move follows established opening book theory{currentMove.eco ? ` (${currentMove.eco})` : ''}. Opening moves represent standard preparation and are not analyzed as tactical errors.
          </p>
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-zinc-400">
          {isSignificant ? (
            <span>
              This move is flagged as <strong className="text-amber-300">{tag?.label || currentMove.classification}</strong>. Click <span className="text-amber-400 font-medium">Explain Principle</span> above for the diagnosis and pocket rule.
            </span>
          ) : (
            <span>Position evaluated as solid. Click above to view the strategic ideas for this position.</span>
          )}
        </div>
      )}
    </div>
  );
};
