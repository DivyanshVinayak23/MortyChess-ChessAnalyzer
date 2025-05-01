const API_BASE_URL = 'http://localhost:5001';

export const analyzePosition = async (pgn, moveNumber) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn, moveNumber }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze position');
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing position:', error);
    throw error;
  }
};

export const analyzeGame = async (pgn) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/analyze-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze game');
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing game:', error);
    throw error;
  }
};

export const getBotMove = async (fen, difficulty) => {
  console.log('getBotMove called with:', { fen, difficulty });
  try {
    console.log('Sending request to:', `${API_BASE_URL}/api/bot-move`);
    const response = await fetch(`${API_BASE_URL}/api/bot-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fen, difficulty }),
    });

    console.log('Response status:', response.status);
    if (!response.ok) {
      throw new Error('Failed to get bot move');
    }

    const data = await response.json();
    console.log('Bot move response data:', data);
    return data;
  } catch (error) {
    console.error('Error getting bot move:', error);
    throw error;
  }
};

export const fetchChessComGames = async (username) => {
  try {
    const response = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
    if (!response.ok) throw new Error('User not found');
    
    const archives = await response.json();
    const gamesPromises = archives.archives.slice(-3).map(url => 
      fetch(url).then(res => res.json())
    );
    
    const monthlyGames = await Promise.all(gamesPromises);
    return monthlyGames.flatMap(month => month.games.map(game => ({
      pgn: game.pgn,
      white: game.white.username,
      black: game.black.username,
      date: new Date(game.end_time * 1000).toLocaleDateString(),
      result: game.white.result === 'win' ? '1-0' : game.black.result === 'win' ? '0-1' : '½-½'
    })));
  } catch (error) {
    console.error('Error fetching chess.com games:', error);
    throw error;
  }
};

export const analyzeMoves = async (pgn) => {
  try {
    console.log('Sending PGN to analyze:', pgn.substring(0, 100) + '...');
    const response = await fetch(`${API_BASE_URL}/api/analyze-moves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server error details:', errorData);
      throw new Error(errorData.error || 'Failed to analyze moves');
    }

    return await response.json();
  } catch (error) {
    console.error('Error analyzing moves:', error);
    throw error;
  }
};