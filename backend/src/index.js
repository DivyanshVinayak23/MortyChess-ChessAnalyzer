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
    'http://localhost:3000'  // Only allow local frontend during development
];

// Development CORS configuration
app.use(cors({
    origin: 'http://localhost:3000',  // Explicitly set to frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
        const { fen, difficulty } = req.body;
        
        let move;
        let game;
        
        try {
            game = new Chess(fen);
        } catch (error) {
            console.error('Error creating Chess instance:', error);
            return res.status(400).json({ error: 'Invalid FEN position' });
        }
        
        if (difficulty === 'easy') {
            const moves = game.moves();
            if (moves.length > 0) {
                move = moves[Math.floor(Math.random() * moves.length)];
            }
        } else if (difficulty === 'medium') {
            const moves = game.moves();
            const captures = moves.filter(m => m.includes('x'));
            const checks = moves.filter(m => m.includes('+'));
            
            if (checks.length > 0) {
                move = checks[Math.floor(Math.random() * checks.length)];
            } else if (captures.length > 0) {
                move = captures[Math.floor(Math.random() * captures.length)];
            } else if (moves.length > 0) {
                move = moves[Math.floor(Math.random() * moves.length)];
            }
        } else {
            const moves = game.moves();
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
            } else if (moves.length > 0) {
                move = moves[Math.floor(Math.random() * moves.length)];
            }
        }
        
        if (!move) {
            return res.status(400).json({ error: 'No valid moves found' });
        }
        
        res.json({ move });
    } catch (error) {
        console.error('Error in bot move:', error);
        res.status(500).json({ error: error.message });
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});