const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4000/api'
    : 'https://mortychess.onrender.com/api';

export const analyzePosition = async (pgn, moveNumber) => {
  try {
    if (!pgn || moveNumber === undefined) {
      throw new Error('PGN and moveNumber are required');
    }

    const response = await fetch(`${API_BASE_URL}/analyze-position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn, moveNumber }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze position');
    }

    const data = await response.json();
    
    if (!data || !data.best_move || !data.evaluation) {
      throw new Error('Invalid response format from server');
    }

    return data;
  } catch (error) {
    console.error('Error analyzing position:', error);
    throw error;
  }
};

export const analyzeGame = async (pgn) => {
  try {
    if (!pgn) {
      throw new Error('PGN is required');
    }

    const response = await fetch(`${API_BASE_URL}/analyze-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze game');
    }

    const data = await response.json();
    
    if (!data || !data.summary) {
      throw new Error('Invalid response format from server');
    }

    return data;
  } catch (error) {
    console.error('Error analyzing game:', error);
    throw error;
  }
};

export const getBotMove = async (fen, difficulty) => {
  console.log('getBotMove called with:', { fen, difficulty });
  try {
    console.log('Sending request to:', `${API_BASE_URL}/bot-move`);
    const response = await fetch(`${API_BASE_URL}/bot-move`, {
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
    if (!pgn) {
      throw new Error('PGN is required');
    }

    console.log('Sending PGN to analyze:', pgn.substring(0, 100) + '...');
    
    const response = await fetch(`${API_BASE_URL}/analyze-moves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze moves');
    }

    const data = await response.json();
    
    if (!data || !data.moves || !data.summary) {
      throw new Error('Invalid response format from server');
    }

    return data;
  } catch (error) {
    console.error('Error analyzing moves:', error);
    throw error;
  }
};