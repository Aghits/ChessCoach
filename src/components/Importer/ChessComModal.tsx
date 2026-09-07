import React, { useState, useEffect } from 'react';
import { fetchRecentChessComGames, ChessComGame } from '../../lib/chesscom/api';
import {
  getRecentUsernames,
  getLastUsername,
  saveRecentUsername,
  removeRecentUsername,
} from '../../lib/chesscom/storage';

interface ChessComModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGame: (pgn: string, whiteName: string, blackName: string, userColor: 'white' | 'black') => void;
}

export const ChessComModal: React.FC<ChessComModalProps> = ({
  isOpen,
  onClose,
  onSelectGame,
}) => {
  const [activeTab, setActiveTab] = useState<'username' | 'pgn'>('username');
  const [username, setUsername] = useState<string>(getLastUsername);
  const [recentUsernames, setRecentUsernames] = useState<string[]>(getRecentUsernames);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<ChessComGame[]>([]);
  const [manualPgn, setManualPgn] = useState('');

  // Sync recent usernames when modal opens
  useEffect(() => {
    if (isOpen) {
      const recents = getRecentUsernames();
      setRecentUsernames(recents);
      const last = recents[0] || '';
      if (!username && last) {
        setUsername(last);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const executeSearch = async (userToSearch: string) => {
    const clean = userToSearch.trim();
    if (!clean) return;

    setIsLoading(true);
    setError(null);
    try {
      const fetched = await fetchRecentChessComGames(clean);
      setGames(fetched);
      const updated = saveRecentUsername(clean);
      setRecentUsernames(updated);
      if (fetched.length === 0) {
        setError(`No recent games found for ${clean}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load games from Chess.com.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(username);
  };

  const handleRecentClick = (recentUser: string) => {
    setUsername(recentUser);
    executeSearch(recentUser);
  };

  const handleRemoveRecent = (e: React.MouseEvent, userToRemove: string) => {
    e.stopPropagation();
    const updated = removeRecentUsername(userToRemove);
    setRecentUsernames(updated);
    if (username.toLowerCase() === userToRemove.toLowerCase()) {
      setUsername(updated[0] || '');
    }
  };

  const handleSelect = (game: ChessComGame) => {
    const cleanUser = username.trim().toLowerCase();
    if (username.trim()) {
      saveRecentUsername(username.trim());
    }
    const isWhite = game.white.username.toLowerCase() === cleanUser;
    const userColor: 'white' | 'black' = isWhite ? 'white' : 'black';
    onSelectGame(game.pgn, game.white.username, game.black.username, userColor);
    onClose();
  };

  const handleLoadManualPgn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPgn.trim()) return;
    onSelectGame(manualPgn.trim(), 'White', 'Black', 'white');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 font-bold text-base">♟</span>
            <h2 className="text-base font-semibold text-zinc-100">Import Game</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('username')}
            className={`border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'username'
                ? 'border-amber-500 text-amber-200'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Chess.com Username
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pgn')}
            className={`border-b-2 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === 'pgn'
                ? 'border-amber-500 text-amber-200'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Paste PGN Text
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {activeTab === 'username' ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Chess.com username (e.g. MagnusCarlsen, Hikaru)"
                  className="flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Fetching...' : 'Find Games'}
                </button>
              </form>

              {/* Recently Used Usernames */}
              {recentUsernames.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 pt-0.5">
                  <span className="text-[11px] text-zinc-500 font-medium">Recent:</span>
                  {recentUsernames.map((u) => (
                    <div
                      key={u}
                      className={`group flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                        username.trim().toLowerCase() === u.toLowerCase()
                          ? 'border-amber-500/80 bg-amber-950/40 text-amber-300'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:text-white'
                      }`}
                      onClick={() => handleRecentClick(u)}
                      title={`Load games for ${u}`}
                    >
                      <span>{u}</span>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveRecent(e, u)}
                        className="text-zinc-500 hover:text-zinc-300 opacity-60 hover:opacity-100 text-[10px]"
                        title="Remove from history"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              {games.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-zinc-400">
                    Latest games ({games.length}):
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                    {games.map((g, idx) => {
                      const cleanUser = username.trim().toLowerCase();
                      const isWhite = g.white.username.toLowerCase() === cleanUser;
                      const userRating = isWhite ? g.white.rating : g.black.rating;
                      const opp = isWhite ? g.black : g.white;
                      const myResult = isWhite ? g.white.result : g.black.result;
                      const isWin = myResult === 'win';
                      const isDraw = ['agreed', 'repetition', 'stalemate', 'timevsinsufficient', 'insufficient'].includes(myResult);

                      const dateStr = new Date(g.end_time * 1000).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      });

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelect(g)}
                          className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-3 hover:border-amber-500/50 hover:bg-zinc-900 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold ${
                                isWin
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : isDraw
                                  ? 'bg-zinc-800 text-zinc-300'
                                  : 'bg-red-950 text-red-400 border border-red-900'
                              }`}
                            >
                              {isWin ? 'W' : isDraw ? 'D' : 'L'}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                                <span>vs. {opp.username}</span>
                                <span className="text-zinc-500">({opp.rating})</span>
                                <span className="text-[10px] rounded bg-zinc-800 px-1 py-0.2 text-zinc-400 uppercase">
                                  {isWhite ? 'White' : 'Black'}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {g.time_class} ({g.time_control}) • Rating: {userRating} • {dateStr}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-amber-400 hover:text-amber-300 font-medium"
                          >
                            Analyze →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleLoadManualPgn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Paste PGN string
                </label>
                <textarea
                  rows={8}
                  value={manualPgn}
                  onChange={(e) => setManualPgn(e.target.value)}
                  placeholder="[Event &quot;Live Chess&quot;]&#10;1. e4 e5 2. Nf3 Nc6..."
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 placeholder-zinc-700 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualPgn.trim()}
                  className="rounded bg-amber-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  Load PGN
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
