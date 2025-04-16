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