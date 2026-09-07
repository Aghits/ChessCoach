export interface ChessComPlayerInfo {
  username: string;
  rating: number;
  result: string;
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  time_class: string; // 'bullet' | 'blitz' | 'rapid' | 'daily'
  rules: string;
  white: ChessComPlayerInfo;
  black: ChessComPlayerInfo;
}

export interface GameArchiveResponse {
  games: ChessComGame[];
}

export interface ArchivesListResponse {
  archives: string[];
}

/**
 * Fetch the latest games for a given Chess.com username.
 * Looks at the most recent monthly archive from the player's archives list.
 */
export async function fetchRecentChessComGames(username: string): Promise<ChessComGame[]> {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    throw new Error('Please enter a Chess.com username.');
  }

  // 1. Fetch archives list
  const archivesUrl = `https://api.chess.com/pub/player/${cleanUsername}/games/archives`;
  const archivesRes = await fetch(archivesUrl);

  if (archivesRes.status === 404) {
    throw new Error(`Player "${username}" not found on Chess.com.`);
  }

  if (!archivesRes.ok) {
    throw new Error(`Failed to fetch archives from Chess.com (${archivesRes.status}).`);
  }

  const archivesData: ArchivesListResponse = await archivesRes.json();
  if (!archivesData.archives || archivesData.archives.length === 0) {
    throw new Error(`No games found for player "${username}".`);
  }

  // Take the most recent monthly archive (last in the array)
  const latestArchiveUrl = archivesData.archives[archivesData.archives.length - 1];
  const gamesRes = await fetch(latestArchiveUrl);

  if (!gamesRes.ok) {
    throw new Error(`Failed to fetch games for latest archive (${gamesRes.status}).`);
  }

  const gamesData: GameArchiveResponse = await gamesRes.json();
  let games = gamesData.games || [];

  // If latest month has fewer than 5 games and there is a previous month, fetch previous month too
  if (games.length < 5 && archivesData.archives.length > 1) {
    const prevArchiveUrl = archivesData.archives[archivesData.archives.length - 2];
    try {
      const prevGamesRes = await fetch(prevArchiveUrl);
      if (prevGamesRes.ok) {
        const prevGamesData: GameArchiveResponse = await prevGamesRes.json();
        games = [...(prevGamesData.games || []), ...games];
      }
    } catch {
      // Non-fatal if previous month fails
    }
  }

  // Only keep standard chess games with PGNs
  const standardGames = games.filter(
    (g) => (g.rules === 'chess' || !g.rules) && typeof g.pgn === 'string' && g.pgn.length > 0
  );

  // Sort descending by end_time (newest first)
  standardGames.sort((a, b) => b.end_time - a.end_time);

  return standardGames;
}
