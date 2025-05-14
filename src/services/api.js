const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4000/api'
    : 'https://mortychess.onrender.com/api';

// Helper function for API requests with retry logic
const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`API request attempt ${attempt + 1}/${retries + 1} to ${url}`);
      const response = await fetch(url, options);
      
      console.log(`Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error response (${response.status}):`, errorText);
        throw new Error(`API error: ${response.status} ${errorText}`);
      }
      
      // Check for empty response
      const responseText = await response.text();
      if (!responseText.trim()) {
        console.error('Empty response received');
        throw new Error('Empty response from server');
      }
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError, 'Response text:', responseText);
        throw new Error(`Failed to parse JSON response: ${parseError.message}`);
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      lastError = error;
      
      if (attempt < retries) {
        console.log(`Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Exponential backoff
        delay = delay * 2;
      }
    }
  }
  
  throw lastError;
};

export const analyzePosition = async (pgn, moveNumber) => {
  try {
    if (!pgn || moveNumber === undefined) {
      throw new Error('PGN and moveNumber are required');
    }

    return await fetchWithRetry(`${API_BASE_URL}/analyze-position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn, moveNumber }),
    });
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

    return await fetchWithRetry(`${API_BASE_URL}/analyze-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn }),
    });
  } catch (error) {
    console.error('Error analyzing game:', error);
    throw error;
  }
};

export const getBotMove = async (fen, difficulty) => {
  console.log('getBotMove called with:', { fen, difficulty });
  try {
    console.log('Sending request to:', `${API_BASE_URL}/bot-move`);
    
    return await fetchWithRetry(`${API_BASE_URL}/bot-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fen, difficulty }),
    });
  } catch (error) {
    console.error('Error getting bot move:', error);
    throw error;
  }
};

export const fetchChessComGames = async (username) => {
  try {
    const response = await fetchWithRetry(`https://api.chess.com/pub/player/${username}/games/archives`, {
      method: 'GET',
    });
    
    const archives = response;
    const gamesPromises = archives.archives.slice(-3).map(url => 
      fetchWithRetry(url, { method: 'GET' })
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
    
    return await fetchWithRetry(`${API_BASE_URL}/analyze-moves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pgn }),
    });
  } catch (error) {
    console.error('Error analyzing moves:', error);
    throw error;
  }
};

export const getMoveSuggestions = async (fen) => {
  try {
    if (!fen) {
      throw new Error('FEN is required');
    }

    return await fetchWithRetry(`${API_BASE_URL}/suggest-moves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fen }),
    });
  } catch (error) {
    console.error('Error getting move suggestions:', error);
    throw error;
  }
};