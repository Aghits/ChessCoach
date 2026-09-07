import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { ChessBoardView } from './components/Board/ChessBoardView';
import { MoveList } from './components/Board/MoveList';
import { CoachCard } from './components/Coach/CoachCard';
import { GameReviewCard } from './components/Review/GameReviewCard';
import { ChessComModal } from './components/Importer/ChessComModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { loadSettings, saveSettings, AppSettings, PROVIDER_DEFAULTS } from './lib/settings/storage';
import { parsePgn } from './lib/chess/pgnParser';
import { EvaluatedMove, GameMetadata } from './lib/chess/types';
import { stockfishEngine, EngineEvaluation } from './lib/chess/engineWorker';
import { uciToSan, isBookMove, updateEvaluatedMove } from './lib/chess/evalClassifier';
import { getOpeningByFen } from './lib/chess/openingBook';
import { analyzeGameMoves } from './lib/chess/gameAnalyzer';
import { summarizeMoveDelta, formatRefutationLine, describeMoveDelta, extractBoardThreats } from './lib/chess/featureExtractor';
import { detectPrimaryImbalance } from './lib/chess/silmanImbalances';
import { generateCoachingTip, CoachingOutput } from './lib/ai/client';
import { SAMPLE_GAMES } from './lib/chess/sampleGames';

export default function App() {
  // Settings & Modals State
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'moves' | 'review'>('moves');

  // Game & Move State
  const defaultGame = SAMPLE_GAMES[0];
  const initialParsed = useMemo(() => parsePgn(defaultGame.pgn, defaultGame.userColor), [defaultGame]);

  const [metadata, setMetadata] = useState<GameMetadata>(initialParsed.metadata);
  const [moves, setMoves] = useState<EvaluatedMove[]>(initialParsed.moves);
  const [initialFen, setInitialFen] = useState<string>(initialParsed.initialFen);
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>(defaultGame.userColor);

  // Engine Evaluation State
  const [currentEvalScore, setCurrentEvalScore] = useState<number | undefined>(0);
  const [currentMateScore, setCurrentMateScore] = useState<number | undefined>(undefined);
  const [isEngineCalculating, setIsEngineCalculating] = useState(false);

  // Batch Game Analysis State
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const cancelAnalysisRef = useRef(false);
  const hasAutoAnalyzedRef = useRef(false);

  // AI Coach State
  const [coachingData, setCoachingData] = useState<CoachingOutput | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [isPreviewingBestMove, setIsPreviewingBestMove] = useState(false);
  const [previewingFen, setPreviewingFen] = useState<string | null>(null);

  // Initialize Stockfish Engine on mount
  useEffect(() => {
    stockfishEngine.init();
    return () => stockfishEngine.terminate();
  }, []);

  // Compute current FEN
  const currentMove = currentPly > 0 ? moves[currentPly - 1] : undefined;
  const currentFen = useMemo(() => {
    if (currentPly === 0) return initialFen;
    return moves[currentPly - 1]?.fen || initialFen;
  }, [currentPly, moves, initialFen]);

  // Reset previews whenever active move changes
  useEffect(() => {
    setPreviewingFen(null);
    setIsPreviewingBestMove(false);
  }, [currentPly]);

  // Handle previewing moves (best move or tactical refutation line) on the board
  const displayedFen = useMemo(() => {
    if (previewingFen) return previewingFen;
    if (isPreviewingBestMove && currentMove?.bestMoveUci && currentMove.previousFen) {
      try {
        const chess = new Chess(currentMove.previousFen);
        const from = currentMove.bestMoveUci.substring(0, 2);
        const to = currentMove.bestMoveUci.substring(2, 4);
        const promo = currentMove.bestMoveUci.length > 4 ? currentMove.bestMoveUci[4] : undefined;
        chess.move({ from, to, promotion: promo });
        return chess.fen();
      } catch {
        return currentFen;
      }
    }
    return currentFen;
  }, [previewingFen, isPreviewingBestMove, currentMove, currentFen]);

  const movesRef = useRef(moves);
  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);

  // Start full-game batch analysis
  const handleStartGameAnalysis = useCallback(
    async (movesToAnalyze?: EvaluatedMove[]) => {
      const targetMoves = movesToAnalyze || movesRef.current;
      if (!targetMoves.length) return;

      cancelAnalysisRef.current = false;
      setIsBatchAnalyzing(true);
      setAnalysisProgress({ current: 0, total: targetMoves.length, percent: 0 });

      try {
        const analyzed = await analyzeGameMoves(targetMoves, {
          depth: 10,
          movetime: 80,
          onProgress: (p) => {
            setAnalysisProgress({
              current: p.current,
              total: p.total,
              percent: p.percent,
            });
            // Progressively update moves so user sees badges appear in real time
            setMoves((prev) => {
              const next = [...prev];
              if (p.current - 1 < next.length) {
                next[p.current - 1] = p.currentMove;
              }
              return next;
            });
          },
          shouldCancel: () => cancelAnalysisRef.current,
        });

        if (!cancelAnalysisRef.current) {
          setMoves(analyzed);
          setAnalysisProgress(null);
        }
      } catch (err) {
        console.error('Batch game analysis failed:', err);
      } finally {
        setIsBatchAnalyzing(false);
      }
    },
    []
  );

  // Cancel ongoing batch analysis
  const handleCancelAnalysis = useCallback(() => {
    cancelAnalysisRef.current = true;
    setIsBatchAnalyzing(false);
    setAnalysisProgress(null);
    stockfishEngine.stop();
  }, []);

  // Automatically trigger batch analysis on initial game mount
  useEffect(() => {
    if (!hasAutoAnalyzedRef.current && initialParsed.moves.length > 0) {
      hasAutoAnalyzedRef.current = true;
      handleStartGameAnalysis(initialParsed.moves);
    }
  }, [initialParsed, handleStartGameAnalysis]);

  // When active move changes, load analyzed data or trigger fallback engine evaluation
  useEffect(() => {
    setIsPreviewingBestMove(false);
    setCoachingData(null);

    // If batch analysis is in progress, do not trigger single-move evaluation
    if (isBatchAnalyzing) {
      if (currentMove?.evalScore !== undefined) {
        setCurrentEvalScore(currentMove.evalScore);
        setCurrentMateScore(currentMove.mateScore);
      }
      return;
    }

    // If current move is a theoretical / book move, load it directly - no need to analyze book moves!
    if (
      currentMove &&
      (currentMove.isBook ||
        currentMove.classification === 'theoretical' ||
        currentMove.classification === 'book')
    ) {
      setCurrentEvalScore(currentMove.evalScore ?? 0);
      setCurrentMateScore(undefined);
      setIsEngineCalculating(false);
      return;
    }

    // If current move is already evaluated, immediately load the analyzed data!
    if (currentMove && currentMove.evalScore !== undefined) {
      setCurrentEvalScore(currentMove.evalScore);
      setCurrentMateScore(currentMove.mateScore);
      setIsEngineCalculating(false);
      return;
    }

    if (currentPly === 0) {
      setCurrentEvalScore(0);
      setCurrentMateScore(undefined);
      setIsEngineCalculating(false);
      return;
    }

    setIsEngineCalculating(true);

    // If current move is a standard opening move, immediately classify it as book
    const targetMove = moves[currentPly - 1];
    if (
      targetMove &&
      (targetMove.isBook || isBookMove(currentPly, targetMove.san, targetMove.fen))
    ) {
      setMoves((prevMoves) => {
        const updated = [...prevMoves];
        if (updated[currentPly - 1]) {
          const opening = getOpeningByFen(targetMove.fen);
          updated[currentPly - 1] = {
            ...updated[currentPly - 1],
            classification: 'theoretical',
            centipawnLoss: 0,
            evalScore: 0,
            bestMoveSan: targetMove.san,
            bestMoveUci: `${targetMove.from}${targetMove.to}`,
            isBook: true,
            openingName: opening?.name || updated[currentPly - 1].openingName,
            eco: opening?.eco || updated[currentPly - 1].eco,
          };
        }
        return updated;
      });
      setCurrentEvalScore(0);
      setCurrentMateScore(undefined);
      setIsEngineCalculating(false);
      return;
    }

    stockfishEngine.evaluateFen(currentFen, 16, (evalData: EngineEvaluation) => {
      if (evalData.fen !== currentFen) return;

      if (evalData.evalScore !== undefined) setCurrentEvalScore(evalData.evalScore);
      if (evalData.mateScore !== undefined) setCurrentMateScore(evalData.mateScore);

      if (evalData.isComplete) {
        setIsEngineCalculating(false);
      }

      setMoves((prevMoves) => {
        const updated = [...prevMoves];

        // 1. Current position's best move belongs to the NEXT move to be played
        if (evalData.bestMoveUci && currentPly < updated.length) {
          const nextMove = updated[currentPly];
          if (nextMove) {
            updated[currentPly] = {
              ...nextMove,
              bestMoveUci: evalData.bestMoveUci,
              bestMoveSan: uciToSan(currentFen, evalData.bestMoveUci),
            };
          }
        }

        // 2. Update current played move's evaluation and classification
        if (currentPly > 0) {
          const targetIndex = currentPly - 1;
          const target = updated[targetIndex];
          if (!target) return prevMoves;

          const prevMove = targetIndex > 0 ? updated[targetIndex - 1] : undefined;
          updated[targetIndex] = updateEvaluatedMove(target, prevMove, currentPly, evalData);
        }

        return updated;
      });
    });
  }, [currentFen, currentPly, isBatchAnalyzing, currentMove]);

  // Load a new game (from Chess.com or PGN input)
  const handleSelectGame = useCallback(
    (pgn: string, white: string, black: string, userColor: 'white' | 'black') => {
      // Cancel any ongoing batch analysis
      cancelAnalysisRef.current = true;
      stockfishEngine.stop();
      setIsBatchAnalyzing(false);
      setAnalysisProgress(null);

      try {
        const parsed = parsePgn(pgn, userColor);
        setMetadata({
          ...parsed.metadata,
          white: white || parsed.metadata.white,
          black: black || parsed.metadata.black,
          userColor,
        });
        setMoves(parsed.moves);
        setInitialFen(parsed.initialFen);
        setCurrentPly(0);
        setOrientation(userColor);
        setCoachingData(null);
        setCurrentEvalScore(0);
        setCurrentMateScore(undefined);

        // Auto-trigger full game analysis for the newly loaded game
        setTimeout(() => {
          handleStartGameAnalysis(parsed.moves);
        }, 100);
      } catch (err) {
        console.error('Failed to parse selected game PGN:', err);
      }
    },
    [handleStartGameAnalysis]
  );

  // Load a sample preset game
  const handleLoadSample = (sample: typeof SAMPLE_GAMES[0]) => {
    handleSelectGame(sample.pgn, 'White', 'Black', sample.userColor);
  };

  // Trigger Principle Explanation
  const handleExplain = async () => {
    if (!currentMove) return;
    setIsExplaining(true);

    const isBook =
      currentMove.classification === 'theoretical' ||
      currentMove.classification === 'book' ||
      isBookMove(currentPly, currentMove.san);
    const classification = isBook ? 'theoretical' : currentMove.classification || 'sound';
    const centipawnLoss = isBook ? 0 : currentMove.centipawnLoss || 0;
    const bestMoveSan = isBook ? currentMove.san : currentMove.bestMoveSan || currentMove.san;
    const bestMoveUci = isBook ? `${currentMove.from}${currentMove.to}` : currentMove.bestMoveUci || `${currentMove.from}${currentMove.to}`;

    const prevEval = currentPly > 1 ? moves[currentPly - 2]?.evalScore || 0 : 0;
    const currEval = currentMove.evalScore || 0;
    const notes = summarizeMoveDelta(currentMove.previousFen, currentMove.fen, currentMove.san);

    // Build allowed context for anti-hallucination guardrail
    const playedMoveSquares = [currentMove.from, currentMove.to];
    const bestMoveSquares: string[] = [];
    if (bestMoveUci && bestMoveUci.length >= 4) {
      bestMoveSquares.push(bestMoveUci.substring(0, 2), bestMoveUci.substring(2, 4));
    }

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

    const refutationDetails = formatRefutationLine(
      currentMove.fen,
      currentMove.pvLine || [],
      currentPly,
      {
        from: currentMove.from,
        to: currentMove.to,
        san: currentMove.san,
        capturedPieceType,
        centipawnLoss,
        classification,
      }
    );

    const isTrueTacticalLoss =
      !refutationDetails.isExchange &&
      Boolean(refutationDetails.threatenedPieceName) &&
      Boolean(refutationDetails.threatenedSquare) &&
      (centipawnLoss >= 150 ||
        classification === 'blunder' ||
        classification === 'miss' ||
        classification === 'mistake');

    const tacticalTarget = isTrueTacticalLoss
      ? {
          square: refutationDetails.threatenedSquare!,
          piece: refutationDetails.threatenedPieceName!,
          threatenedBy: refutationDetails.attackerPieceName,
          outcome: refutationDetails.tacticalSummary,
        }
      : undefined;

    const pvSquares = (currentMove.pvLine || []).flatMap((uci) =>
      uci.length >= 4 ? [uci.substring(0, 2), uci.substring(2, 4)] : []
    );

    // Extract active threats and hanging pieces
    const prevThreats = currentMove.previousFen ? extractBoardThreats(currentMove.previousFen) : [];
    const currThreats = currentMove.fen ? extractBoardThreats(currentMove.fen) : [];
    const activeBoardThreats = Array.from(
      new Set([
        ...prevThreats.filter((t) => !t.isDefended).map((t) => t.summary),
        ...currThreats.filter((t) => !t.isDefended).map((t) => t.summary),
      ])
    ).slice(0, 4);

    // Engine result FEN if available
    let engineFen: string | undefined;
    try {
      if (currentMove.previousFen && (bestMoveSan || bestMoveUci)) {
        const c = new Chess(currentMove.previousFen);
        if (bestMoveSan) {
          try {
            c.move(bestMoveSan);
            engineFen = c.fen();
          } catch {}
        }
        if (!engineFen && bestMoveUci && bestMoveUci.length >= 4) {
          try {
            c.move({
              from: bestMoveUci.substring(0, 2) as any,
              to: bestMoveUci.substring(2, 4) as any,
              promotion: bestMoveUci[4] as any,
            });
            engineFen = c.fen();
          } catch {}
        }
      }
    } catch {}

    const validFens = [currentMove.previousFen, currentMove.fen, engineFen].filter(Boolean) as string[];

    const context = {
      playedMoveSquares,
      bestMoveSquares,
      pvSquares,
      featureSquares: ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'],
      fens: validFens,
    };

    const imbalanceDetection = detectPrimaryImbalance({
      prevFen: currentMove.previousFen,
      playedFen: currentMove.fen,
      playedSan: currentMove.san,
      engineSan: bestMoveSan,
      loss: centipawnLoss,
    });

    const playedMoveDelta = describeMoveDelta(
      currentMove.previousFen,
      currentMove.san,
      `${currentMove.from}${currentMove.to}`
    );

    const engineMoveDelta = describeMoveDelta(
      currentMove.previousFen,
      bestMoveSan,
      bestMoveUci
    );

    try {
      const output = await generateCoachingTip(
        {
          playerColor: currentMove.color === 'w' ? 'white' : 'black',
          moveSan: currentMove.san,
          fromSquare: currentMove.from,
          toSquare: currentMove.to,
          bestMoveSan,
          bestMoveUci,
          classification,
          centipawnLoss,
          evalBefore: prevEval,
          evalAfter: currEval,
          positionalNotes: notes,
          refutationMoves: refutationDetails.moves.map((m) => m.notation),
          refutationLineSan: refutationDetails.lineSan,
          activeBoardThreats,
          tacticalTarget,
          isExchange: refutationDetails.isExchange,
          exchangeSummary: refutationDetails.exchangeSummary,
          silmanImbalance: imbalanceDetection.primaryImbalance,
          playedMoveDelta,
          engineMoveDelta,
        },
        context,
        settings
      );
      setCoachingData(output);
    } catch (err) {
      console.error('Coaching explanation error:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  // Best move arrow on the board
  const bestMoveArrow = useMemo(() => {
    if (
      !currentMove?.bestMoveUci ||
      currentMove.bestMoveUci.length < 4 ||
      currentMove.classification === 'optimal' ||
      currentMove.classification === 'best' ||
      currentMove.classification === 'masterstroke' ||
      currentMove.classification === 'theoretical' ||
      currentMove.classification === 'book'
    ) {
      return null;
    }
    return {
      from: currentMove.bestMoveUci.substring(0, 2),
      to: currentMove.bestMoveUci.substring(2, 4),
    };
  }, [currentMove]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/90 px-6 py-3.5 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-600 font-serif font-bold text-white shadow-sm">
              ♞
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-zinc-100">ChessPrinciple AI</h1>
                <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] font-mono text-amber-400">
                  v0.1
                </span>
              </div>
              <p className="text-xs text-zinc-400">Actionable Positional Principles & Pocket Rules for Club Players</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sample selector */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 mr-2">
              <span>Samples:</span>
              {SAMPLE_GAMES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleLoadSample(sample)}
                  className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                >
                  {sample.id === 'club-tactical-lpdo' ? '1800 LPDO Game' : 'IQP Mastery'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition-colors"
            >
              Import Game ♟
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
            >
              Settings ⚙
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 sm:p-6 space-y-4">
        {/* Game Info Bar */}
        <div className="flex flex-col gap-2.5 rounded border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-zinc-500">White: </span>
                <strong className="text-zinc-200">{metadata.white}</strong>
                {metadata.whiteRating && <span className="text-zinc-500 font-mono"> ({metadata.whiteRating})</span>}
              </div>
              <span className="text-zinc-600 font-bold">vs</span>
              <div>
                <span className="text-zinc-500">Black: </span>
                <strong className="text-zinc-200">{metadata.black}</strong>
                {metadata.blackRating && <span className="text-zinc-500 font-mono"> ({metadata.blackRating})</span>}
              </div>
              <div className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                Result: {metadata.result}
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-zinc-500 text-[11px]">
              <button
                type="button"
                disabled={isBatchAnalyzing}
                onClick={() => handleStartGameAnalysis()}
                className="flex items-center gap-1.5 rounded border border-amber-600/70 bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-900/60 hover:text-amber-100 disabled:opacity-50 transition-colors"
                title="Run Stockfish analysis on all moves sequentially"
              >
                <span>⚡</span>
                <span>{isBatchAnalyzing ? 'Analyzing Game...' : 'Analyze Full Game'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab((t) => (t === 'review' ? 'moves' : 'review'))}
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeRightTab === 'review'
                    ? 'border-emerald-600 bg-emerald-950/80 text-emerald-200'
                    : 'border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:border-emerald-600 hover:text-emerald-300'
                }`}
              >
                <span>📊</span>
                <span>{activeRightTab === 'review' ? 'Show Notation' : 'Game Review'}</span>
              </button>

              <div className="hidden sm:flex items-center gap-1.5">
                <span>Engine:</span>
                <span className="font-mono text-emerald-400 font-medium">
                  SF 18 Lite (NNUE)
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                <span>Provider:</span>
                <span className="font-mono text-zinc-300 font-medium">
                  {settings.apiKey ? PROVIDER_DEFAULTS[settings.provider].name : 'Local Fallback'}
                </span>
              </div>
            </div>
          </div>

          {/* Batch Analysis Progress Bar */}
          {isBatchAnalyzing && analysisProgress && (
            <div className="flex items-center gap-3 border-t border-zinc-800/80 pt-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-400 font-medium whitespace-nowrap">
                <span className="inline-block animate-spin text-xs">⚙</span>
                <span>Analyzing move {analysisProgress.current} of {analysisProgress.total} ({analysisProgress.percent}%)</span>
              </div>
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/60">
                <div
                  className="h-full bg-amber-500 transition-all duration-150 rounded-full"
                  style={{ width: `${analysisProgress.percent}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancelAnalysis}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Board & Analysis Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 flex-1">
          {/* Left Column: Enlarged Chessboard + Aligned Eval Bar */}
          <div className="flex justify-center lg:col-span-7">
            <ChessBoardView
              currentFen={displayedFen}
              orientation={orientation}
              onFlipOrientation={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
              currentMove={currentMove}
              onPrevMove={() => setCurrentPly((p) => Math.max(0, p - 1))}
              onNextMove={() => setCurrentPly((p) => Math.min(moves.length, p + 1))}
              onFirstMove={() => setCurrentPly(0)}
              onLastMove={() => setCurrentPly(moves.length)}
              hasPrev={currentPly > 0}
              hasNext={currentPly < moves.length}
              bestMoveArrow={bestMoveArrow}
              evalScore={currentEvalScore}
              mateScore={currentMateScore}
              isCalculating={isEngineCalculating}
            />
          </div>

          {/* Right Column: Coach Pocket Rules, Notation & Game Review */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            {/* Diagnosis + Pocket Rule Card */}
            <CoachCard
              currentMove={currentMove}
              coachingData={coachingData}
              isLoading={isExplaining}
              onExplainClick={handleExplain}
              onPreviewBestMove={() => setIsPreviewingBestMove((v) => !v)}
              isPreviewingBestMove={isPreviewingBestMove}
              onPreviewFen={setPreviewingFen}
              previewingFen={previewingFen}
            />

            {/* Right Column Tab Switcher */}
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveRightTab('moves')}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  activeRightTab === 'moves'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                Move Notation
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab('review')}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  activeRightTab === 'review'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                Game Review
              </button>
            </div>

            {/* Active Tab View: Move List or Game Review */}
            <div className="flex-1">
              {activeRightTab === 'moves' ? (
                <MoveList
                  moves={moves}
                  currentPly={currentPly}
                  onSelectPly={(ply) => setCurrentPly(ply)}
                  className="h-[340px] sm:h-[380px]"
                />
              ) : (
                <GameReviewCard
                  moves={moves}
                  whiteName={metadata.white}
                  blackName={metadata.black}
                  whiteRating={metadata.whiteRating}
                  blackRating={metadata.blackRating}
                  currentPly={currentPly}
                  onSelectPly={(ply) => setCurrentPly(ply)}
                  className="h-[340px] sm:h-[380px] overflow-y-auto"
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => {
          setSettings(newSettings);
          saveSettings(newSettings);
        }}
      />

      <ChessComModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSelectGame={handleSelectGame}
      />
    </div>
  );
}
