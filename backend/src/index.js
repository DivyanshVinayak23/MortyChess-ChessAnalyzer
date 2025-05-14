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

app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
        
        Please provide:
        1. The best move in this position(give the move directly)
        2. An one line explanation of why this move is best
        
        Format your response in a clear, concise manner.`;

        console.log('\n=== Position Analysis Request ===');
        console.log('PGN:', pgn);
        console.log('Move Number:', moveNumber);
        console.log('Prompt:', prompt);
        console.log('\nWaiting for Gemini response...\n');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

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
        const { pgn } = req.body;
        
        if (!pgn) {
            return res.status(400).json({ error: 'PGN is required' });
        }

        const prompt = `As a chess grandmaster, analyze this complete game:
        ${pgn}
        Please provide: (one line for each)
        1. Mistake Moves by both the players
        2. Overall assessment of both the players
        
        Format your response in a clear, structured manner.`;

        console.log('\n=== Game Analysis Request ===');
        console.log('PGN:', pgn);
        console.log('Prompt:', prompt);
        console.log('\nWaiting for Gemini response...\n');

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text || text.trim() === '') {
            throw new Error('Empty response from Gemini');
        }

        console.log('=== Gemini Response ===');
        console.log(text);
        console.log('=====================\n');

        const analysis = {
            summary: text || 'No analysis available',
            moves: pgn.split(' ').filter(move => move && !move.includes('.')),
            best_moves: [],
            depth: 0,
            nodes: 0,
            time: 0,
            current_move: 0
        };
        
        res.json(analysis);
    } catch (error) {
        console.error('Error in game analysis:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

app.post('/api/analyze-moves', async (req, res) => {
    try {
        const { pgn } = req.body;
        
        if (!pgn) {
            return res.status(400).json({ error: 'PGN is required' });
        }

        console.log('Analyzing moves for PGN:', pgn.substring(0, 100) + '...');
        
        const analysis = await moveAnalyzer.analyzeGame(pgn);
        
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
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

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