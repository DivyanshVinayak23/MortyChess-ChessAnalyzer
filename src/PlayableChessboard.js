import React, { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { analyzePosition, analyzeGame } from './services/api';
import { FiGitBranch, FiAlertCircle, FiRefreshCw, FiChevronLeft, FiChevronRight, FiPlay } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import logo from './components/logo.png';
import './styles/PlayableChessboard.css';
import ChessComGames from './components/ChessComGames';
import MoveAnalysis from './components/MoveAnalysis';


function PlayableChessboard() {
    const [game, setGame] = useState(new Chess());
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [validMoves, setValidMoves] = useState([]);
    const [pgn, setPgn] = useState('');
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    const [moves, setMoves] = useState([]);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showMoveAnalysis, setShowMoveAnalysis] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Analyzing Position...');
    const [usingFallback, setUsingFallback] = useState(false);
    
    function safeGameMutate(modify) {
        setGame((g) => {
            const update = { ...g };
            modify(update);
            return update;
        });
    }

    // Format PGN to ensure it has the required headers
    const formatPGN = (pgnText) => {
        // Check if the PGN already has headers
        if (pgnText.includes('[Event') || pgnText.includes('[Site')) {
            return pgnText;
        }
        
        // Add basic headers if they're missing
        const formattedPGN = `[Event "Casual Game"]
[Site "Chess Analyzer"]
[Date "${new Date().toISOString().split('T')[0].replace(/-/g, '.')}"]
[White "Player1"]
[Black "Player2"]
[Result "*"]

${pgnText}`;
        
        return formattedPGN;
    };

    async function handleAnalyzePosition() {
        setLoading(true);
        setLoadingMessage('Analyzing Position...');
        setUsingFallback(false);
        
        try {
            const formattedPGN = formatPGN(pgn);
            const data = await analyzePosition(formattedPGN, currentMoveIndex + 1);
            setAnalysis(data);
            
            // Check if we got fallback data
            if (data.source && data.source.includes('fallback')) {
                setUsingFallback(true);
            }
        } catch (error) {
            console.error('Error analyzing position:', error);
            setUsingFallback(true);
        }
        setLoading(false);
    }

    async function handleAnalyzeGame() {
        setLoading(true);
        setLoadingMessage('Analyzing Full Game...');
        setUsingFallback(false);
        
        // Set up timers to update loading message for better UX
        const messageTimer = setTimeout(() => {
            setLoadingMessage('This may take up to a minute for complex games...');
        }, 5000);
        
        const longWaitTimer = setTimeout(() => {
            setLoadingMessage('Still working on your analysis. Thank you for your patience...');
        }, 20000);
        
        try {
            const formattedPGN = formatPGN(pgn);
            const data = await analyzeGame(formattedPGN);
            setAnalysis(data);
            
            // Check if we got fallback data
            if (data.source && data.source.includes('fallback')) {
                setUsingFallback(true);
            }
        } catch (error) {
            console.error('Error analyzing game:', error);
            setUsingFallback(true);
        } finally {
            clearTimeout(messageTimer);
            clearTimeout(longWaitTimer);
            setLoading(false);
        }
    }

    function onDrop(sourceSquare, targetSquare) {
        let move = null;
        safeGameMutate((game) => {
            move = game.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q',
            });
        });

        if (move === null) return false;
        setSelectedSquare(null);
        setValidMoves([]);
        return true;
    }

    function onSquareClick(square) {
        const piece = game.get(square);
        
        if (!selectedSquare && piece) {
            if (piece.color === game.turn()) {
                setSelectedSquare(square);
                const moves = game.moves({ square, verbose: true });
                setValidMoves(moves.map(move => move.to));
            }
        }
        else if (selectedSquare && validMoves.includes(square)) {
            const move = game.move({
                from: selectedSquare,
                to: square,
                promotion: 'q'
            });
            if (move) {
                safeGameMutate((game) => {
                    game.move(move);
                });
                setSelectedSquare(null);
                setValidMoves([]);
            }
        }
        else if (piece && piece.color === game.turn()) {
            setSelectedSquare(square);
            const moves = game.moves({ square, verbose: true });
            setValidMoves(moves.map(move => move.to));
        }
        else {
            setSelectedSquare(null);
            setValidMoves([]);
        }
    }

    function loadPGN() {
        const newGame = new Chess();
        const formattedPGN = formatPGN(pgn);
        if (newGame.load_pgn(formattedPGN)) {
            setGame(newGame);
            setMoves(newGame.history({ verbose: true }));
            setCurrentMoveIndex(-1);
        } else {
            alert('Invalid PGN format. Please check the format and try again.');
        }
    }

    function goToMove(index) {
        const newGame = new Chess();
        for (let i = 0; i <= index; i++) {
            newGame.move(moves[i]);
        }
        setGame(newGame);
        setCurrentMoveIndex(index);
    }

    return (
        <div className="app-container">
            <header className="App-header">
                <nav className="main-nav">
                    <div className="nav-logo">
                        <img src={logo} alt="Chess Analyzer Logo" className="logo-image" />
                    </div>
                    <div className="nav-links">
                        <Link to="/" className="nav-link">Analyze Game</Link>
                        <Link to="/play" className="nav-link">Play vs Bot</Link>
                        <Link to="/practice" className="nav-link">Practice Notation</Link>
                        <a href="#features" className="nav-link">
                        <FiAlertCircle className="nav-icon" />
                        <span>Features</span>
                        </a>
                        <a href="https://github.com/DivyanshVinayak23/MortyChess-ChessAnalyzer" className="nav-link">
                        <FiGitBranch className="nav-icon" />
                        <span>GitHub</span>
                        </a>
                    </div>
                </nav>
            </header>

            <main className="main-content">
                <aside className="analysis-panel">
                    <h2 className="panel-title">Analysis Controls</h2>
                    <div className="panel-section">
                    <ChessComGames onGameSelect={setPgn} />
                        <textarea
                            value={pgn}
                            onChange={(e) => setPgn(e.target.value)}
                            placeholder="Paste PGN here..."
                            className="pgn-input"
                            rows="6"
                        />
                        <div className="button-group">
                            <button onClick={loadPGN} className="control-button">
                                <FiRefreshCw className="button-icon" />
                                Load PGN
                            </button>
                            <button 
                                onClick={() => setShowMoveAnalysis(true)} 
                                className="control-button primary"
                                disabled={!pgn}
                            >
                                <FiPlay className="button-icon" />
                                Analyze Moves
                            </button>
                        </div>
                    </div>

                    {showMoveAnalysis && (
                        <div className="move-analysis-panel">
                            <MoveAnalysis 
                                pgn={pgn} 
                                onClose={() => setShowMoveAnalysis(false)} 
                            />
                        </div>
                    )}

                    {analysis && (
                        <div className="panel-section">
                            <h3 className="section-title">Analysis Results</h3>
                            {usingFallback && (
                                <div className="fallback-notice">
                                    Network issues detected. Showing basic analysis only.
                                </div>
                            )}
                            <div className="analysis-grid">
                                {analysis.best_move && (
                                    <div className="analysis-card">
                                        <label>Recommended Move</label>
                                        <div className="analysis-value">{analysis.best_move}</div>
                                    </div>
                                )}
                                {analysis.evaluation && (
                                    <div className="analysis-card">
                                        <label>Position Evaluation</label>
                                        <div className="analysis-value">{analysis.evaluation}</div>
                                    </div>
                                )}
                                {analysis.summary && (
                                    <div className="analysis-summary">
                                        <h4>Game Summary</h4>
                                        <p>{analysis.summary}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </aside>

                <section className="chess-section">
                    <div className="board-header">
                        <h2 className="section-title">
                            {game.turn() === 'w' ? 'White' : 'Black'} to Move
                        </h2>
                        <div className="move-counter">
                            Move {currentMoveIndex + 1} of {moves.length}
                        </div>
                    </div>

                    <div className="chessboard-wrapper">
                        <Chessboard
                            position={game.fen()}
                            onPieceDrop={onDrop}
                            onSquareClick={onSquareClick}
                            boardWidth={560}
                            customSquareStyles={{
                                ...(selectedSquare && {
                                    [selectedSquare]: {
                                        background: 'rgba(255, 255, 0, 0.4)',
                                    },
                                }),
                                ...(validMoves.reduce((acc, square) => {
                                    acc[square] = {
                                        background: 'rgba(0, 255, 0, 0.4)',
                                    };
                                    return acc;
                                }, {})),
                            }}
                        />
                    </div>

                    <div className="controls-wrapper">
                        <div className="button-group">
                            <button
                                onClick={() => goToMove(currentMoveIndex - 1)}
                                disabled={currentMoveIndex < 0}
                                className="control-button"
                            >
                                <FiChevronLeft className="button-icon" />
                                Previous
                            </button>
                            <button
                                onClick={() => goToMove(currentMoveIndex + 1)}
                                disabled={currentMoveIndex >= moves.length - 1}
                                className="control-button"
                            >
                                Next
                                <FiChevronRight className="button-icon" />
                            </button>
                        </div>
                        
                        <div className="button-group">
                            <button
                                onClick={handleAnalyzePosition}
                                disabled={loading || !pgn}
                                className="control-button primary"
                            >
                                Analyze Position
                            </button>
                            <button
                                onClick={handleAnalyzeGame}
                                disabled={loading}
                                className="control-button secondary"
                            >
                                Full Game Analysis
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="app-footer">
                <p>© 2025 Chess Analyzer. Powered by Stockfish and chess.js</p>
            </footer>

            {loading && (
                <div className="loading-overlay">
                    <div className="loading-content">
                        <div className="spinner"></div>
                        <h3>{loadingMessage}</h3>
                        <p>The AI is analyzing your chess position</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PlayableChessboard;