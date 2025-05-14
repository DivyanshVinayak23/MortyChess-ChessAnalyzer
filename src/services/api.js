const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:4000/api'
    : 'https://mortychess.onrender.com/api';

// Generate a smart fallback move based on the position
const generateFallbackMove = (fen) => {
  try {
    const { Chess } = require('chess.js');
    const game = new Chess(fen);
    const moves = game.moves();
    
    if (!moves || moves.length === 0) {
      return { move: 'e5' }; // Default if no moves available
    }
    
    // Try to find more strategic moves
    const captures = moves.filter(m => m.includes('x'));
    const checks = moves.filter(m => m.includes('+'));
    const centerMoves = moves.filter(m => 
      m.includes('e4') || m.includes('e5') || 
      m.includes('d4') || m.includes('d5')
    );
    
    // Prioritize moves
    if (checks.length > 0) {
      const selectedMove = checks[Math.floor(Math.random() * checks.length)];
      return { move: selectedMove };
    } 
    
    if (captures.length > 0) {
      const selectedMove = captures[Math.floor(Math.random() * captures.length)];
      return { move: selectedMove };
    }
    
    if (centerMoves.length > 0) {
      const selectedMove = centerMoves[Math.floor(Math.random() * centerMoves.length)];
      return { move: selectedMove };
    }
    
    // If no special moves, pick a random one
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    return { move: randomMove };
  } catch (error) {
    console.error('Error generating fallback move:', error);
    return { move: 'e5' }; // Default fallback
  }
};

// Helper to check if we're online
const checkOnlineStatus = async () => {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
    throw new Error('You appear to be offline. Please check your internet connection.');
  }
  
  // Further check by making a small request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.warn('Network connectivity check failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('Network request timed out. Your connection appears to be slow or unreliable.');
    }
    return false;
  }
};

// Helper function for API requests with retry logic
const fetchWithRetry = async (url, options, retries = 2, delay = 1000) => {
  let lastError;
  
  // First check if we're online
  try {
    await checkOnlineStatus();
  } catch (connectivityError) {
    console.error('Connectivity check failed:', connectivityError);
    // For bot-move endpoint, provide a fallback
    if (url.includes('/bot-move')) {
      // Extract FEN from request body
      let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Default
      try {
        const requestBody = JSON.parse(options.body);
        fen = requestBody.fen || fen;
      } catch (e) {
        console.error('Error parsing request body:', e);
      }
      
      // Add a small delay to simulate server response time
      // This gives the UI time to update properly
      await new Promise(resolve => setTimeout(resolve, 800));
      console.log('Returning fallback move due to connectivity issue');
      
      const fallbackMove = generateFallbackMove(fen);
      return { 
        ...fallbackMove, 
        source: 'fallback-connectivity' 
      }; 
    }
    throw connectivityError;
  }
  
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
      console.log(`Response length: ${responseText.length} characters`);
      
      if (!responseText.trim()) {
        console.error('Empty response received');
        
        // Special handling for bot-move endpoint - if we get an empty response
        // with status 200, construct a default response with a random move
        if (url.includes('/bot-move') && response.status === 200) {
          // Extract FEN from request body
          let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Default
          try {
            const requestBody = JSON.parse(options.body);
            fen = requestBody.fen || fen;
          } catch (e) {
            console.error('Error parsing request body:', e);
          }
          
          // Add a small delay to simulate server response time
          await new Promise(resolve => setTimeout(resolve, 800));
          console.log('Creating fallback bot move response');
          
          const fallbackMove = generateFallbackMove(fen);
          return {
            ...fallbackMove,
            source: 'fallback-empty'
          };
        }
        
        throw new Error('Empty response from server');
      }
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError, 'Response text:', responseText);
        
        // For bot-move endpoint, create a fallback response with a default move
        if (url.includes('/bot-move')) {
          // Extract FEN from request body
          let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Default
          try {
            const requestBody = JSON.parse(options.body);
            fen = requestBody.fen || fen;
          } catch (e) {
            console.error('Error parsing request body:', e);
          }
          
          // Add a small delay to simulate server response time
          await new Promise(resolve => setTimeout(resolve, 800));
          console.log('Creating fallback response for invalid JSON');
          
          const fallbackMove = generateFallbackMove(fen);
          return {
            ...fallbackMove,
            source: 'fallback-parse'
          };
        }
        
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
  
  // If all attempts failed and it's the bot-move endpoint, return a fallback move
  if (url.includes('/bot-move')) {
    // Extract FEN from request body
    let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Default
    try {
      const requestBody = JSON.parse(options.body);
      fen = requestBody.fen || fen;
    } catch (e) {
      console.error('Error parsing request body:', e);
    }
    
    // Add a small delay to simulate server response time
    await new Promise(resolve => setTimeout(resolve, 800));
    console.warn('All retry attempts failed for bot move, providing fallback response');
    
    const fallbackMove = generateFallbackMove(fen);
    return {
      ...fallbackMove,
      source: 'fallback-final'
    }; 
  }
  
  throw lastError;
};

// Generate default move suggestions when the API fails
const generateFallbackSuggestions = (fen) => {
  try {
    const { Chess } = require('chess.js');
    const game = new Chess(fen);
    const moves = game.moves();
    
    if (!moves || moves.length === 0) {
      return { suggestions: [] };
    }
    
    // Get some variety in move types
    const captures = moves.filter(m => m.includes('x'));
    const checks = moves.filter(m => m.includes('+'));
    const centerMoves = moves.filter(m => 
      m.includes('e4') || m.includes('e5') || 
      m.includes('d4') || m.includes('d5')
    );
    
    // Create suggestions array
    const suggestions = [];
    
    // Try to add one of each type
    if (checks.length > 0) {
      const checkMove = checks[Math.floor(Math.random() * checks.length)];
      suggestions.push({
        move: checkMove,
        explanation: "Puts your opponent in check, limiting their options",
        risks: "May expose your pieces to counterattack"
      });
    }
    
    if (captures.length > 0) {
      const captureMove = captures[Math.floor(Math.random() * captures.length)];
      suggestions.push({
        move: captureMove,
        explanation: "Captures your opponent's piece for material advantage",
        risks: "Check if this capture exposes important pieces"
      });
    }
    
    if (centerMoves.length > 0) {
      const centerMove = centerMoves[Math.floor(Math.random() * centerMoves.length)];
      suggestions.push({
        move: centerMove,
        explanation: "Controls the center of the board for better piece mobility",
        risks: "May need to be defended against opponent's attacks"
      });
    }
    
    // Fill remaining suggestions with random moves
    while (suggestions.length < 3 && moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      if (!suggestions.some(s => s.move === randomMove)) {
        suggestions.push({
          move: randomMove,
          explanation: "Develops your position and creates opportunities",
          risks: "Consider how your opponent might respond"
        });
      }
    }
    
    return { suggestions, source: 'fallback' };
  } catch (error) {
    console.error('Error generating fallback suggestions:', error);
    return { 
      suggestions: [
        {
          move: "e4",
          explanation: "Controls the center and opens lines for the bishop and queen",
          risks: "Slightly weakens the d4 square"
        },
        {
          move: "d4",
          explanation: "Establishes a strong center presence",
          risks: "Can lead to a closed position"
        },
        {
          move: "Nf3",
          explanation: "Develops a knight toward the center",
          risks: "Delays pawn development"
        }
      ],
      source: 'fallback-default'
    };
  }
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
    
    // Debug chess position when possible
    try {
      const { Chess } = require('chess.js');
      const game = new Chess(fen);
      console.log('Valid moves for this position:', game.moves());
    } catch (chessError) {
      console.error('Error parsing chess position:', chessError);
    }
    
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

    try {
      return await fetchWithRetry(`${API_BASE_URL}/suggest-moves`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fen }),
      });
    } catch (error) {
      console.error('Error getting move suggestions from API:', error);
      
      // If the API call fails, generate fallback suggestions locally
      console.log('Generating local fallback suggestions');
      await new Promise(resolve => setTimeout(resolve, 800)); // Add delay for UX
      
      return generateFallbackSuggestions(fen);
    }
  } catch (error) {
    console.error('Error getting move suggestions:', error);
    throw error;
  }
};