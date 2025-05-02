const { Chess } = require('chess.js');

class MoveAnalyzer {
    constructor() {
        // No need for Stockfish initialization
    }

    async analyzeMove(fen, move) {
        try {
            const game = new Chess(fen);
            const moves = game.moves();
            
            if (!moves.includes(move)) {
                throw new Error('Invalid move');
            }

            // Make the move
            game.move(move);
            
            // Get all legal moves after the move
            const legalMoves = game.moves();
            
            // Simple evaluation based on material
            const evaluation = this.evaluatePosition(game);
            
            // Find the best move based on material
            let bestMove = '';
            let bestEval = -Infinity;
            
            for (const legalMove of legalMoves) {
                game.move(legalMove);
                const moveEval = this.evaluatePosition(game);
                game.undo();
                
                if (moveEval > bestEval) {
                    bestEval = moveEval;
                    bestMove = legalMove;
                }
            }
            
            const moveQuality = this.categorizeMove(move, bestMove, evaluation);
            
            return {
                move,
                bestMove,
                evaluation,
                quality: moveQuality
            };
        } catch (error) {
            throw error;
        }
    }

    evaluatePosition(game) {
        // Simple material evaluation
        const pieceValues = {
            'p': -1, 'n': -3, 'b': -3, 'r': -5, 'q': -9, 'k': 0,
            'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0
        };
        
        let evaluation = 0;
        const fen = game.fen();
        const pieces = fen.split(' ')[0];
        
        for (const piece of pieces) {
            if (pieceValues[piece]) {
                evaluation += pieceValues[piece];
            }
        }
        
        return evaluation;
    }

    categorizeMove(move, bestMove, evaluation) {
        if (move === bestMove) {
            return 'Best';
        }

        const evalDiff = Math.abs(evaluation);
        
        if (evalDiff <= 50) {
            return 'Excellent';
        } else if (evalDiff <= 200) {
            return 'Great';
        } else if (evalDiff <= 500) {
            return 'Good';
        } else if (evalDiff <= 1000) {
            return 'Inaccuracy';
        } else if (evalDiff <= 2000) {
            return 'Miss';
        } else {
            return 'Blunder';
        }
    }

    async analyzeGame(pgn) {
        try {
            if (!pgn || typeof pgn !== 'string') {
                throw new Error('Invalid PGN: PGN must be a non-empty string');
            }

            const game = new Chess();
            const moves = pgn.split(' ').filter(move => move && !move.includes('.'));
            const analysis = [];

            for (const move of moves) {
                const fen = game.fen();
                const moveAnalysis = await this.analyzeMove(fen, move);
                analysis.push(moveAnalysis);
                game.move(move);
            }

            return analysis;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new MoveAnalyzer(); 