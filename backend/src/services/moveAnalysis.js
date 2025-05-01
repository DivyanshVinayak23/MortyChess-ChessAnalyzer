const { Chess } = require('chess.js');
const { spawn } = require('child_process');

class MoveAnalyzer {
    constructor() {
        this.stockfish = spawn('stockfish');
        this.stockfish.stderr.on('data', (data) => {
            console.error('Stockfish error:', data.toString());
        });
        this.stockfish.onerror = (error) => {
            console.error('Stockfish error:', error);
        };
    }

    async analyzeMove(fen, move) {
        return new Promise((resolve, reject) => {
            try {
                const game = new Chess(fen);
                const moves = game.moves();
                
                if (!moves.includes(move)) {
                    reject(new Error('Invalid move'));
                    return;
                }

                let evaluation = 0;
                let bestMove = '';
                let analysisComplete = false;

                const timeout = setTimeout(() => {
                    if (!analysisComplete) {
                        this.stockfish.kill();
                        resolve({
                            move,
                            bestMove: move,
                            evaluation: 0,
                            quality: 'Unknown'
                        });
                    }
                }, 5000);

                this.stockfish.stdout.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('bestmove')) {
                        bestMove = output.split('bestmove ')[1].split(' ')[0];
                    }
                    if (output.includes('score cp')) {
                        evaluation = parseInt(output.split('score cp ')[1].split(' ')[0]);
                    }
                    if (output.includes('bestmove') && output.includes('score cp')) {
                        analysisComplete = true;
                        clearTimeout(timeout);
                        const moveQuality = this.categorizeMove(move, bestMove, evaluation);
                        resolve({
                            move,
                            bestMove,
                            evaluation,
                            quality: moveQuality
                        });
                    }
                });

                this.stockfish.stdin.write('position fen ' + fen + '\n');
                this.stockfish.stdin.write('go depth 20\n');
            } catch (error) {
                reject(error);
            }
        });
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

            // Extract moves from PGN by removing headers and cleaning
            const movesText = pgn
                .replace(/\[.*?\]/g, '')     // Remove headers
                .replace(/\{[^}]*\}/g, '')   // Remove comments
                .replace(/\d+\./g, '')       // Remove move numbers
                .replace(/\s+/g, ' ')        // Normalize whitespace
                .trim();

            const game = new Chess();
            
            // Try to load the PGN
            try {
                game.loadPgn(pgn);
            } catch (error) {
                throw new Error(`Invalid PGN format: ${error.message}`);
            }

            const moves = game.history();
            if (moves.length === 0) {
                throw new Error('Invalid PGN: No moves found in the game');
            }

            const analysis = [];
            for (let i = 0; i < moves.length; i++) {
                const fen = game.fen();
                const move = moves[i];
                try {
                    const moveAnalysis = await this.analyzeMove(fen, move);
                    analysis.push({
                        moveNumber: Math.floor(i / 2) + 1,
                        move,
                        ...moveAnalysis
                    });
                } catch (error) {
                    console.error(`Error analyzing move ${move}:`, error);
                    analysis.push({
                        moveNumber: Math.floor(i / 2) + 1,
                        move,
                        bestMove: move,
                        evaluation: 0,
                        quality: 'Error'
                    });
                }
                game.move(move);
            }

            return analysis;
        } catch (error) {
            console.error('Error analyzing game:', error);
            throw error;
        }
    }
}

module.exports = new MoveAnalyzer(); 