require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Chess } = require('chess.js');
const moveAnalyzer = require('./services/moveAnalysis');

console.log('Environment variables loaded:', {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV
});

const app = express();
const port = process.env.PORT || 4000; 

// Increase the server's timeout for long-running AI requests
app.timeout = 60000; // 60 seconds

// Increase the request size limit for PGN data
app.use(express.json({ limit: '10mb' }));

const allowedOrigins = [
    'http://localhost:3000',  // Local development frontend
    'https://mortychess.onrender.com',  // Production frontend
    'https://chess-analyzer.onrender.com', // Additional domain if needed
];

// CORS configuration for both development and production
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman, etc.)
        if (!origin) {
            console.log('Request with no origin allowed');
            return callback(null, true);
        }
        
        // Check against allowed origins
        if (allowedOrigins.indexOf(origin) !== -1) {
            console.log(`Allowed request from origin: ${origin}`);
            return callback(null, true);
        } else {
            console.log(`Rejected request from origin: ${origin}`);
            return callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    optionsSuccessStatus: 204
}));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper function to call Gemini with proper timeout and error handling
const callGeminiWithTimeout = async (prompt, endpoint = '', timeoutMs = 25000) => {
    // Adjust timeout based on the endpoint
    let adjustedTimeout = timeoutMs;
    
    if (endpoint === 'analyze-game') {
        adjustedTimeout = 50000; // 50 seconds for game analysis - most complex
    } else if (endpoint === 'analyze-position') {
        adjustedTimeout = 35000; // 35 seconds for position analysis
    } else if (endpoint === 'suggest-moves') {
        adjustedTimeout = 25000; // 25 seconds for move suggestions
    }
    
    console.log(`Using ${adjustedTimeout}ms timeout for ${endpoint || 'generic'} Gemini call`);
    
    return new Promise(async (resolve, reject) => {
        // Set a timeout for the Gemini call
        const timeoutId = setTimeout(() => {
            reject(new Error(`Gemini API call timed out after ${adjustedTimeout}ms`));
        }, adjustedTimeout);
        
        try {
            console.log('Initializing Gemini model');
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
            
            console.log('Sending request to Gemini');
            const result = await model.generateContent(prompt);
            
            console.log('Received response from Gemini');
            const response = await result.response;
            const text = response.text();

            clearTimeout(timeoutId);
            
            if (!text || text.trim() === '') {
                reject(new Error('Empty response from Gemini'));
                return;
            }
            
            console.log(`Gemini response length: ${text.length} characters`);
            resolve(text);
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Error calling Gemini:', error);
            reject(error);
        }
    });
};

app.post('/api/bot-move', async (req, res) => {
    try {
        console.log('Bot move request received:', req.body);
        const { fen, difficulty } = req.body;
        
        if (!fen || !difficulty) {
            console.error('Missing required fields:', { fen: !!fen, difficulty: !!difficulty });
            return res.status(400).json({ error: 'FEN and difficulty are required' });
        }
        
        let move;
        let game;
        
        try {
            console.log('Creating Chess instance with FEN:', fen);
            game = new Chess(fen);
            console.log('Game created successfully');
            
            // Log game state
            console.log('Chess position validation:');
            console.log('- FEN:', game.fen());
            console.log('- Turn:', game.turn());
            console.log('- Is valid:', game.validate_fen(fen).valid);
        } catch (error) {
            console.error('Error creating Chess instance:', error);
            console.error('Invalid FEN:', fen);
            return res.status(400).json({ error: `Invalid FEN position: ${error.message}` });
        }
        
        // Get all available moves
        let moves = [];
        try {
            moves = game.moves();
            console.log(`Available moves (${moves.length}):`, moves);
        } catch (movesError) {
            console.error('Error getting moves:', movesError);
            return res.status(500).json({ error: `Error getting moves: ${movesError.message}` });
        }
        
        if (moves.length === 0) {
            console.error('No valid moves found for position:', fen);
            return res.status(400).json({ error: 'No valid moves found' });
        }

        // Logic for different difficulty levels
        if (difficulty === 'easy') {
            move = moves[Math.floor(Math.random() * moves.length)];
        } else if (difficulty === 'medium') {
            const captures = moves.filter(m => m.includes('x'));
            const checks = moves.filter(m => m.includes('+'));
            
            if (checks.length > 0) {
                move = checks[Math.floor(Math.random() * checks.length)];
            } else if (captures.length > 0) {
                move = captures[Math.floor(Math.random() * captures.length)];
            } else {
                move = moves[Math.floor(Math.random() * moves.length)];
            }
        } else {
            const captures = moves.filter(m => m.includes('x'));
            const checks = moves.filter(m => m.includes('+'));
            const centerMoves = moves.filter(m => 
                m.includes('e4') || m.includes('e5') || 
                m.includes('d4') || m.includes('d5')
            );
            
            if (checks.length > 0) {
                move = checks[Math.floor(Math.random() * checks.length)];
            } else if (captures.length > 0) {
                move = captures[Math.floor(Math.random() * captures.length)];
            } else if (centerMoves.length > 0) {
                move = centerMoves[Math.floor(Math.random() * centerMoves.length)];
            } else {
                move = moves[Math.floor(Math.random() * moves.length)];
            }
        }
        
        // If we somehow still don't have a move, pick a random one as fallback
        if (!move && moves.length > 0) {
            console.log('Using fallback random move');
            move = moves[Math.floor(Math.random() * moves.length)];
        }
        
        // Final safety check - if there's still no move, return an error
        if (!move) {
            console.error('No valid moves found for position:', fen);
            return res.status(400).json({ error: 'No valid moves found' });
        }
        
        const response = { move };
        console.log('Sending bot move response:', response);
        
        // Set explicit content type header
        res.setHeader('Content-Type', 'application/json');
        return res.json(response);
    } catch (error) {
        console.error('Error in bot move:', error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
});

app.post('/api/analyze-position', async (req, res) => {
    try {
        const { pgn, moveNumber } = req.body;
        
        if (!pgn || moveNumber === undefined) {
            return res.status(400).json({ error: 'PGN and moveNumber are required' });
        }

        const prompt = `As a chess grandmaster, analyze this position from the following PGN at move ${moveNumber}:
        ${pgn}, make sure the output is short and to the point, no paragraphs
        `;

        console.log('\n=== Position Analysis Request ===');
        console.log('PGN:', pgn);
        console.log('Move Number:', moveNumber);
        console.log('Prompt:', prompt);
        console.log('\nWaiting for Gemini response...\n');

        const result = await callGeminiWithTimeout(prompt, 'analyze-position');
        const text = result;

        if (!text || text.trim() === '') {
            throw new Error('Empty response from Gemini');
        }

        console.log('=== Gemini Response ===');
        console.log(text);
        console.log('=====================\n');

        // Extract best move and explanation from the response
        const lines = text.split('\n').filter(line => line.trim());
        const bestMove = lines[0]?.split(':')[1]?.trim() || 'No move found';
        const explanation = lines[1]?.split(':')[1]?.trim() || 'No explanation available';

        const analysis = {
            evaluation: explanation,
            current_move: moveNumber,
            position: pgn,
            best_move: [bestMove],
            depth: 0,
            nodes: 0,
            time: 0,
        };
        
        // Add cache headers for position analysis
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'private, max-age=7200'); // Cache for 2 hours
        res.json(analysis);
    } catch (error) {
        console.error('Error in position analysis:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

app.post('/api/analyze-game', async (req, res) => {
    try {
        console.log('\n=== Game Analysis Request Started ===');
        const { pgn } = req.body;
        
        if (!pgn) {
            console.error('Missing PGN in request');
            return res.status(400).json({ error: 'PGN is required' });
        }

        console.log('PGN received, length:', pgn.length);
        console.log('First 100 chars of PGN:', pgn.substring(0, 100) + '...');

        // In development, bypass AI for faster testing
        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode active - sending quick response');
            const quickResponse = {
                summary: "This is a development mode response. The game shows typical opening patterns with opportunities for both sides.",
                moves: pgn.split(' ').filter(move => move && !move.includes('.')),
                best_moves: [],
                depth: 0,
                nodes: 0,
                time: 0,
                current_move: 0,
                source: 'dev-mode'
            };
            
            res.setHeader('Content-Type', 'application/json');
            return res.json(quickResponse);
        }

        const prompt = `As a chess grandmaster, analyze this complete game:
        ${pgn}`;

        console.log('Preparing to call Gemini AI...');
        
        // Set a timeout for the entire request
        const requestTimeout = setTimeout(() => {
            console.error('Request timed out after 45 seconds');
            
            // Create a fallback response
            const fallbackResponse = {
                summary: "Analysis timed out. Here's a basic assessment:\n\n" +
                      "- The game shows normal opening development\n" +
                      "- Both sides had tactical opportunities\n" +
                      "- Consider analyzing key positions with a local engine",
                moves: pgn.split(' ').filter(move => move && !move.includes('.')),
                best_moves: [],
                depth: 0,
                nodes: 0,
                time: 0,
                current_move: 0,
                source: 'timeout-fallback'
            };
            
            // Only send a response if one hasn't been sent yet
            if (!res.headersSent) {
                console.log('Sending fallback response due to timeout');
                res.setHeader('Content-Type', 'application/json');
                res.json(fallbackResponse);
            }
        }, 45000); // 45 second timeout
        
        try {
            console.log('Calling Gemini with 40 second timeout...');
            const result = await callGeminiWithTimeout(prompt, 'analyze-game', 40000);
            const text = result;
            
            // Clear the request timeout since we got a response
            clearTimeout(requestTimeout);
            
            if (!text || text.trim() === '') {
                console.error('Empty response from Gemini');
                throw new Error('Empty response from Gemini');
            }

            console.log('=== Gemini Response Received ===');
            console.log('Response length:', text.length);
            console.log('First 100 chars:', text.substring(0, 100) + '...');

            const analysis = {
                summary: text || 'No analysis available',
                moves: pgn.split(' ').filter(move => move && !move.includes('.')),
                best_moves: [],
                depth: 0,
                nodes: 0,
                time: 0,
                current_move: 0
            };
            
            // Only send a response if one hasn't been sent yet
            if (!res.headersSent) {
                console.log('Sending successful analysis response');
                // Set explicit content type and cache headers
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
                res.json(analysis);
            }
        } catch (geminiError) {
            // Clear the request timeout since we handled the error
            clearTimeout(requestTimeout);
            console.error('Error from Gemini API:', geminiError);
            
            // Create a fallback response
            const fallbackResponse = {
                summary: "AI service unavailable. Here's a basic assessment:\n\n" +
                      "- The game follows standard opening theory\n" +
                      "- Both players had opportunities for tactical play\n" +
                      "- Consider reviewing the game with a local chess engine",
                moves: pgn.split(' ').filter(move => move && !move.includes('.')),
                best_moves: [],
                depth: 0,
                nodes: 0,
                time: 0,
                current_move: 0,
                source: 'error-fallback'
            };
            
            // Only send a response if one hasn't been sent yet
            if (!res.headersSent) {
                console.log('Sending fallback response due to Gemini error');
                res.setHeader('Content-Type', 'application/json');
                res.json(fallbackResponse);
            }
        }
    } catch (error) {
        console.error('Error in game analysis:', error);
        
        // Only send a response if one hasn't been sent yet
        if (!res.headersSent) {
            res.status(500).json({ 
                error: error.message,
                details: error.stack
            });
        }
    }
});

app.post('/api/analyze-moves', async (req, res) => {
    try {
        const { pgn } = req.body;
        
        if (!pgn) {
            return res.status(400).json({ error: 'PGN is required' });
        }

        console.log('Analyzing moves for PGN:', pgn.substring(0, 100) + '...');
        
        // Set a longer timeout for analysis since this can be complex
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Analysis timed out')), 40000); // 40 seconds
        });
        
        // Create a promise for the move analysis
        const analysisPromise = moveAnalyzer.analyzeGame(pgn);
        
        // Race the promises
        let analysis;
        try {
            analysis = await Promise.race([analysisPromise, timeoutPromise]);
        } catch (timeoutError) {
            console.error('Move analysis timed out:', timeoutError);
            return res.status(503).json({ 
                error: 'Analysis timed out. The server is busy, please try again later.',
                retryAfter: 30
            });
        }
        
        if (!analysis || !Array.isArray(analysis)) {
            throw new Error('Invalid analysis result from move analyzer');
        }

        const summary = {
            best: analysis.filter(m => m.quality === 'Best').length,
            excellent: analysis.filter(m => m.quality === 'Excellent').length,
            great: analysis.filter(m => m.quality === 'Great').length,
            good: analysis.filter(m => m.quality === 'Good').length,
            inaccuracy: analysis.filter(m => m.quality === 'Inaccuracy').length,
            miss: analysis.filter(m => m.quality === 'Miss').length,
            blunder: analysis.filter(m => m.quality === 'Blunder').length
        };

        const response = {
            moves: analysis,
            summary: summary
        };

        // Set explicit content type and cache headers
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
        res.json(response);
    } catch (error) {
        console.error('Error in move analysis:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

app.post('/api/suggest-moves', async (req, res) => {
    try {
        console.log('Move suggestions request received:', req.body);
        const { fen } = req.body;
        
        if (!fen) {
            console.error('Missing required field: FEN');
            return res.status(400).json({ error: 'FEN is required' });
        }

        let game;
        try {
            console.log('Creating Chess instance with FEN:', fen);
            game = new Chess(fen);
            console.log('Game created successfully');
            
            // Log game state
            console.log('Chess position validation:');
            console.log('- FEN:', game.fen());
            console.log('- Turn:', game.turn());
            console.log('- Is valid:', game.validate_fen(fen).valid);
        } catch (error) {
            console.error('Error creating Chess instance:', error);
            console.error('Invalid FEN:', fen);
            return res.status(400).json({ error: `Invalid FEN position: ${error.message}` });
        }
        
        const moves = game.moves({ verbose: true });
        console.log(`Available moves (${moves.length}):`, moves.map(m => m.san));
        
        if (moves.length === 0) {
            console.log('No legal moves available');
            return res.status(400).json({ error: 'No legal moves available' });
        }

        // If we're in development environment, use a simpler response for testing
        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode: sending simple move suggestions');
            const simpleSuggestions = [
                {
                    move: moves[0].san,
                    explanation: "This is a good move that develops your position",
                    risks: "May expose your pieces to counterattack"
                },
                {
                    move: moves.length > 1 ? moves[1].san : moves[0].san,
                    explanation: "Controls important squares in the center",
                    risks: "Requires careful defense"
                },
                {
                    move: moves.length > 2 ? moves[2].san : moves[0].san,
                    explanation: "Creates threats against your opponent",
                    risks: "Could be countered if not supported"
                }
            ];
            
            // Set explicit content type header
            res.setHeader('Content-Type', 'application/json');
            return res.json({ suggestions: simpleSuggestions });
        }

        const prompt = `As a chess grandmaster, analyze this position (FEN: ${fen}) and suggest the top 3 best moves.
        
        IMPORTANT: Respond with ONLY the raw JSON array, NO markdown formatting, NO code blocks, NO backticks.
        
        You MUST respond with a valid JSON array containing exactly 3 objects. Each object MUST have these exact fields:
        - "move": The move in algebraic notation (e.g., "e4", "Nf3", "O-O")
        - "explanation": A single line explaining why this move is good
        - "risks": A single line describing potential drawbacks or risks
        
        Example response format (respond with ONLY the array, no other text):
        [
            {
                "move": "e4",
                "explanation": "Controls the center and opens lines for the bishop and queen",
                "risks": "Slightly weakens the d4 square"
            },
            {
                "move": "d4",
                "explanation": "Establishes a strong center presence and opens the queen's diagonal",
                "risks": "Can lead to a closed position"
            },
            {
                "move": "Nf3",
                "explanation": "Develops a knight while maintaining flexibility",
                "risks": "Delays central pawn advance"
            }
        ]

        Keep explanations and risks concise and focused on the immediate position.
        Remember: Return ONLY the raw JSON array, no markdown, no code blocks, no backticks.`;

        console.log('Sending prompt to Gemini');
        
        try {
            const result = await callGeminiWithTimeout(prompt, 'suggest-moves');
            const text = result;

            if (!text || text.trim() === '') {
                console.error('Empty response from Gemini');
                throw new Error('Empty response from Gemini');
            }

            console.log('Gemini response received, length:', text.length);
            
            // Parse the response and ensure it's in the correct format
            let suggestions;
            try {
                // First try to parse the response as JSON
                suggestions = JSON.parse(text);
                
                // Validate the structure
                if (!Array.isArray(suggestions) || suggestions.length !== 3) {
                    console.error('Invalid response format:', suggestions);
                    throw new Error('Invalid response format: expected array of 3 moves');
                }
                
                suggestions = suggestions.map(suggestion => ({
                    move: suggestion.move?.trim() || '',
                    explanation: suggestion.explanation?.trim() || '',
                    risks: suggestion.risks?.trim() || ''
                }));

                // Filter out any invalid suggestions
                suggestions = suggestions.filter(s => s.move && s.explanation && s.risks);
                
                if (suggestions.length === 0) {
                    console.error('No valid suggestions found in response');
                    throw new Error('No valid suggestions found in response');
                }
            } catch (parseError) {
                console.error('Error parsing suggestions:', parseError, 'Response text:', text);
                // If parsing fails, return a more helpful error
                return res.status(500).json({ 
                    error: 'Failed to parse move suggestions',
                    details: parseError.message,
                    rawResponse: text
                });
            }
            
            // Set explicit content type header
            res.setHeader('Content-Type', 'application/json');
            return res.json({ suggestions });
        } catch (modelError) {
            console.error('Error from Gemini API:', modelError);
            
            // Generate fallback suggestions
            const simpleSuggestions = [
                {
                    move: moves[0].san,
                    explanation: "This move develops your position and creates opportunities",
                    risks: "Consider how your opponent might respond"
                },
                {
                    move: moves.length > 1 ? moves[1].san : moves[0].san,
                    explanation: "Controls important squares in the center",
                    risks: "Requires careful defense"
                },
                {
                    move: moves.length > 2 ? moves[2].san : moves[0].san,
                    explanation: "Creates threats against your opponent's position",
                    risks: "Could be countered if not supported properly"
                }
            ];
            
            // Set explicit content type header
            res.setHeader('Content-Type', 'application/json');
            return res.json({ 
                suggestions: simpleSuggestions,
                source: 'fallback-server'
            });
        }
    } catch (error) {
        console.error('Error in move suggestions:', error);
        
        // Set explicit content type header
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ 
            error: error.message || 'Server error',
            details: error.stack
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});