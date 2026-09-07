export interface SampleGame {
  id: string;
  title: string;
  description: string;
  pgn: string;
  userColor: 'white' | 'black';
}

export const SAMPLE_GAMES: SampleGame[] = [
  {
    id: 'club-tactical-lpdo',
    title: 'Club 1800 Match: Loose Piece Disaster',
    description: 'Classic demonstration of "Loose Pieces Drop Off (LPDO)" and premature queen sorties.',
    userColor: 'black',
    pgn: `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.02.14"]
[White "TacticalMaster"]
[Black "ClubPlayer1800"]
[Result "1-0"]
[WhiteElo "1840"]
[BlackElo "1795"]
[TimeControl "180+2"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 d6 6. O-O a6 7. Bb3 Ba7 8. Nbd2 O-O 9. h3 h6 10. Re1 Be6 11. Bc2 Qd7 12. Nf1 Ne7 13. d4 Ng6 14. Ng3 Rad8 15. Be3 Rfe8 16. d5 Bxe3 17. fxe3 Bxh3 18. gxh3 Qxh3 19. Nf5 Ng4 20. Qe2 Ne7 21. Qg2 Qxg2+ 22. Kxg2 Nxf5 23. exf5 Nf6 24. e4 1-0`,
  },
  {
    id: 'silman-iqp-mastery',
    title: 'Positional Study: Isolated Queen Pawn (IQP)',
    description: 'A study on outpost squares, piece coordination, and pawn structure weaknesses.',
    userColor: 'white',
    pgn: `[Event "Club Championship"]
[Site "Chess.com"]
[Date "2026.01.20"]
[White "PositionalStrategist"]
[Black "Tactician1900"]
[Result "1-0"]
[WhiteElo "1920"]
[BlackElo "1880"]
[TimeControl "600"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 Be7 6. e3 c6 7. Bd3 O-O 8. Qc2 Nbd7 9. Nge2 Re8 10. O-O Nf8 11. f3 Be6 12. Rad1 Rc8 13. Kh1 a6 14. e4 dxe4 15. fxe4 Ng4 16. Bc1 Bg5 17. Nf4 Bxf4 18. Bxf4 Ng6 19. Bc1 Qh4 20. h3 Nh6 21. Qf2 Qxf2 22. Rxf2 Rcd8 23. d5 cxd5 24. exd5 Bxd5 25. Bxg6 hxg6 26. Rxd5 1-0`,
  },
];
