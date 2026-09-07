export interface EngineEvaluation {
  fen: string;
  depth: number;
  evalScore?: number; // In centipawns from White's perspective (+100 = +1.0 for White)
  mateScore?: number; // Moves to mate from White's perspective (+3 = White mates in 3)
  bestMoveUci?: string;
  pvLine?: string[];
  isComplete: boolean;
}

export interface EvaluationOptions {
  depth?: number;
  movetime?: number;
}

export type EvaluationCallback = (evalData: EngineEvaluation) => void;

export class StockfishEngine {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private currentFen: string | null = null;
  private currentCallback: EvaluationCallback | null = null;
  private initPromise: Promise<void> | null = null;
  private engineName: string = 'Stockfish 18 Lite WASM';

  public getEngineName(): string {
    return this.engineName;
  }

  public init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      const tryInitWorker = (workerPath: string, isWasm: boolean) => {
        try {
          const worker = new Worker(workerPath);
          let loaded = false;

          worker.onmessage = (e: MessageEvent) => {
            const line = typeof e.data === 'string' ? e.data : '';
            this.handleEngineOutput(line);
          };

          worker.onerror = (err) => {
            console.warn(`Stockfish worker error on ${workerPath}:`, err);
            if (!loaded && isWasm) {
              try {
                worker.terminate();
              } catch {}
              tryInitWorker('/stockfish/stockfish.js', false);
            }
          };

          // Initialize UCI
          worker.postMessage('uci');
          worker.postMessage('isready');

          // Check readiness
          const checkInterval = setInterval(() => {
            if (this.isReady) {
              loaded = true;
              clearInterval(checkInterval);
              this.worker = worker;
              resolve();
            }
          }, 50);

          // Fallback timeout to ensure app does not block
          setTimeout(() => {
            if (!loaded) {
              clearInterval(checkInterval);
              if (isWasm && !this.isReady) {
                try {
                  worker.terminate();
                } catch {}
                tryInitWorker('/stockfish/stockfish.js', false);
                return;
              }
              this.isReady = true;
              this.worker = worker;
              resolve();
            }
          }, 3000);
        } catch (err) {
          if (isWasm) {
            console.warn('WASM worker instantiation failed, falling back to JS:', err);
            tryInitWorker('/stockfish/stockfish.js', false);
          } else {
            console.error('Failed to create Stockfish worker:', err);
            this.isReady = false;
            resolve();
          }
        }
      };

      const supportsWasm =
        typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
      const initialPath = supportsWasm
        ? '/stockfish/stockfish-18-lite.js'
        : '/stockfish/stockfish.js';
      tryInitWorker(initialPath, supportsWasm);
    });

    return this.initPromise;
  }

  private handleEngineOutput(line: string) {
    if (line.startsWith('id name ')) {
      this.engineName = line.replace('id name ', '').trim();
      return;
    }

    if (line === 'uciok') {
      this.worker?.postMessage('setoption name Hash value 32');
      this.worker?.postMessage('isready');
      return;
    }

    if (line === 'readyok') {
      this.isReady = true;
      return;
    }

    if (!this.currentFen || !this.currentCallback) return;

    // Determine whose turn it is from FEN ('w' or 'b')
    const activeColor = this.currentFen.split(' ')[1] || 'w';
    const isWhiteTurn = activeColor === 'w';

    // Parse info line: e.g. "info depth 14 score cp 45 pv e2e4 e7e5"
    if (line.startsWith('info depth')) {
      const depthMatch = line.match(/depth\s+(\d+)/);
      const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
      const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);
      // Parse PV: match the word 'pv' followed by legal UCI move tokens (e.g. e2e4, e7e8q)
      const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?(?:\s+[a-h][1-8][a-h][1-8][qrbn]?)*)/i);

      const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
      let evalScore: number | undefined;
      let mateScore: number | undefined;

      if (cpMatch) {
        const rawCp = parseInt(cpMatch[1], 10);
        // Normalize to White's perspective
        evalScore = isWhiteTurn ? rawCp : -rawCp;
      }

      if (mateMatch) {
        const rawMate = parseInt(mateMatch[1], 10);
        mateScore = isWhiteTurn ? rawMate : -rawMate;
      }

      let pvLine: string[] | undefined;
      let bestMoveUci: string | undefined;

      if (pvMatch) {
        const moves = pvMatch[1].trim().split(/\s+/).filter(m => /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(m));
        if (moves.length > 0) {
          pvLine = moves;
          bestMoveUci = moves[0];
        }
      }

      this.currentCallback({
        fen: this.currentFen,
        depth,
        evalScore,
        mateScore,
        bestMoveUci,
        pvLine,
        isComplete: false,
      });
    } else if (line.startsWith('bestmove')) {
      const parts = line.split(' ');
      const bestMoveUci = parts[1] && /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(parts[1]) ? parts[1] : undefined;

      this.currentCallback({
        fen: this.currentFen,
        depth: 0,
        bestMoveUci,
        isComplete: true,
      });
    }
  }

  public evaluateFen(
    fen: string,
    optionsOrDepth: number | EvaluationOptions = 14,
    onUpdate?: EvaluationCallback
  ): void {
    if (!this.worker) {
      this.init().then(() => this.evaluateFen(fen, optionsOrDepth, onUpdate));
      return;
    }

    const depth =
      typeof optionsOrDepth === 'number'
        ? optionsOrDepth
        : optionsOrDepth?.depth ?? 10;
    const movetime =
      typeof optionsOrDepth === 'object' ? optionsOrDepth?.movetime : undefined;

    // Stop ongoing search
    this.worker.postMessage('stop');

    this.currentFen = fen;
    this.currentCallback = onUpdate || null;

    this.worker.postMessage(`position fen ${fen}`);

    let goCmd = 'go';
    if (depth !== undefined) {
      goCmd += ` depth ${depth}`;
    }
    if (movetime !== undefined) {
      goCmd += ` movetime ${movetime}`;
    }
    this.worker.postMessage(goCmd);
  }

  public evaluatePosition(
    fen: string,
    optionsOrDepth: number | EvaluationOptions = 14
  ): Promise<EngineEvaluation> {
    return new Promise((resolve) => {
      let lastEval: EngineEvaluation = {
        fen,
        depth: 0,
        isComplete: false,
      };

      this.evaluateFen(fen, optionsOrDepth, (evalData: EngineEvaluation) => {
        if (evalData.fen !== fen) return;
        if (evalData.evalScore !== undefined) lastEval.evalScore = evalData.evalScore;
        if (evalData.mateScore !== undefined) lastEval.mateScore = evalData.mateScore;
        if (evalData.bestMoveUci) lastEval.bestMoveUci = evalData.bestMoveUci;
        if (evalData.pvLine) lastEval.pvLine = evalData.pvLine;
        if (evalData.depth > 0) lastEval.depth = evalData.depth;

        if (evalData.isComplete) {
          lastEval.isComplete = true;
          resolve(lastEval);
        }
      });
    });
  }

  public stop(): void {
    if (this.worker) {
      this.worker.postMessage('stop');
    }
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.initPromise = null;
    }
  }
}

export const stockfishEngine = new StockfishEngine();
