import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { getBotMove, getMoveSuggestions } from '../services/api';
import { FiGitBranch, FiAlertCircle, FiRefreshCw, FiPlay, FiSettings, FiHelpCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import logo from './logo.png';
import '../styles/BotMatch.css';
import MoveSuggestions from './MoveSuggestions';

const BotMatch = () => {
  const [game, setGame] = useState(new Chess());
  const [position, setPosition] = useState('start');
  const [isThinking, setIsThinking] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [gameStatus, setGameStatus] = useState('playing'); 
  const [pendingMove, setPendingMove] = useState(null);
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.log('State updated:', { 
      showConfirmButton, 
      pendingMove, 
      isThinking, 
      gameStatus 
    });
  }, [showConfirmButton, pendingMove, isThinking, gameStatus]);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const makeMove = (move) => {
    try {
      const result = game.move(move);
      if (result) {
        setPosition(game.fen());
        setMoveHistory([...moveHistory, move]);
        checkGameStatus();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error making move:', error);
      return false;
    }
  };

  const makeBotMove = async () => {
    console.log('makeBotMove called');
    setIsThinking(true);
    setErrorMessage(null);
    try {
      console.log('Sending request to get bot move with FEN:', game.fen());
      console.log('Difficulty setting:', difficulty);
      
      const data = await getBotMove(game.fen(), difficulty);
      console.log('Bot move response:', data);
      
      if (data && data.move) {
        console.log('Making bot move:', data.move);
        makeMove(data.move);
        setRetryCount(0); // Reset retry count on success
      } else {
        console.error('Invalid bot move response:', data);
        throw new Error('Invalid bot move response');
      }
    } catch (error) {
      console.error('Error getting bot move:', error);
      
      // Retry logic for network errors
      if (retryCount < 2) {
        setRetryCount(prev => prev + 1);
        setErrorMessage(`Connection issue. Retrying... (${retryCount + 1}/3)`);
        setTimeout(makeBotMove, 2000); // Retry after 2 seconds
      } else {
        setErrorMessage(`Failed to get bot move: ${error.message}`);
        setRetryCount(0);
      }
    } finally {
      if (retryCount === 0) {
        setIsThinking(false);
      }
    }
  };

  const checkGameStatus = () => {
    try {
      if (game.isGameOver()) {
        if (game.isCheckmate()) {
          setGameStatus('checkmate');
        } else if (game.isStalemate()) {
          setGameStatus('stalemate');
        } else if (game.isDraw()) {
          setGameStatus('draw');
        }
      }
    } catch (error) {
      console.error('Error checking game status:', error);
    }
  };

  const onDrop = (sourceSquare, targetSquare) => {
    console.log('onDrop called with:', sourceSquare, targetSquare);
    if (isThinking || gameStatus !== 'playing') {
      console.log('Move rejected: isThinking=', isThinking, 'gameStatus=', gameStatus);
      return false;
    }
    
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // always promote to queen for simplicity
      });

      if (move) {
        console.log('Move made successfully:', move);
        setPosition(game.fen());
        checkGameStatus();
        setPendingMove(move);
        setShowConfirmButton(true);
        return true;
      }
      console.log('Move was invalid');
      return false;
    } catch (error) {
      console.error('Invalid move:', error);
      return false;
    }
  };

  const confirmMove = () => {
    console.log('Confirm move clicked');
    if (pendingMove) {
      setShowConfirmButton(false);
      setPendingMove(null);
      setTimeout(makeBotMove, 300);
    }
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setPosition('start');
    setGameStatus('playing');
    setIsThinking(false);
    setPendingMove(null);
    setShowConfirmButton(false);
    setMoveHistory([]);
  };

  const onSquareClick = (square) => {
    if (isThinking || gameStatus !== 'playing') {
      return;
    }

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
        setPosition(game.fen());
        checkGameStatus();
        setPendingMove(move);
        setShowConfirmButton(true);
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
  };

  const fetchMoveSuggestions = async () => {
    if (isThinking || gameStatus !== 'playing') return;
    
    setLoadingSuggestions(true);
    try {
      const data = await getMoveSuggestions(game.fen());
      setSuggestions(data.suggestions);
    } catch (error) {
      console.error('Error fetching move suggestions:', error);
    }
    setLoadingSuggestions(false);
  };

  const handleMoveSelect = (move) => {
    if (isThinking || gameStatus !== 'playing') return;

    const moveObj = game.move(move);
    if (moveObj) {
      setPosition(game.fen());
      checkGameStatus();
      setPendingMove(moveObj);
      setShowConfirmButton(true);
      setSelectedSquare(null);
      setValidMoves([]);
      setSuggestions(null);
    }
  };

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
            <a href="https://github.com/yourrepo" className="nav-link">
              <FiGitBranch className="nav-icon" />
              <span>GitHub</span>
            </a>
          </div>
        </nav>
      </header>

      <main className="main-content">
        <div className="bot-match-container">
          <div className="game-info">
            <h2>Play vs Bot</h2>
            <div className="difficulty-selector">
              <label>Difficulty:</label>
              <select 
                value={difficulty} 
                onChange={(e) => setDifficulty(e.target.value)}
                disabled={gameStatus !== 'playing'}
                className="difficulty-select"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            {gameStatus !== 'playing' && (
              <div className="game-status">
                {gameStatus === 'checkmate' && 'Checkmate! You won!'}
                {gameStatus === 'stalemate' && 'Stalemate! The game is a draw.'}
                {gameStatus === 'draw' && 'The game is a draw.'}
              </div>
            )}
            {errorMessage && (
              <div className="error-message">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="game-board-section">
            <div className="chess-board-container">
              <Chessboard 
                position={position}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                boardOrientation="white"
                boardWidth={560}
                customBoardStyle={{
                  borderRadius: '12px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
                }}
                customSquareStyles={{
                  ...(pendingMove && {
                    [pendingMove.from]: { background: 'rgba(255, 215, 0, 0.4)' },
                    [pendingMove.to]: { background: 'rgba(255, 215, 0, 0.4)' }
                  }),
                  ...(selectedSquare && {
                    [selectedSquare]: { background: 'rgba(255, 255, 0, 0.4)' }
                  }),
                  ...(validMoves.reduce((acc, square) => {
                    acc[square] = { background: 'rgba(0, 255, 0, 0.4)' };
                    return acc;
                  }, {}))
                }}
              />
              {isThinking && (
                <div className="thinking-indicator">
                  <div className="thinking-spinner"></div>
                  <span>Bot is thinking...</span>
                </div>
              )}
            </div>

            <div className="game-sidebar">
              <div className="move-history">
                <h3>Move History</h3>
                <div className="moves-list">
                  {moveHistory.map((move, index) => (
                    <div key={index} className="move-item">
                      {index % 2 === 0 ? `${Math.floor(index/2) + 1}.` : ''} {move}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={fetchMoveSuggestions}
                className="control-button primary"
                disabled={isThinking || gameStatus !== 'playing' || loadingSuggestions}
              >
                <FiHelpCircle className="button-icon" />
                {loadingSuggestions ? 'Loading...' : 'Get Move Suggestions'}
              </button>

              <MoveSuggestions 
                suggestions={suggestions}
                onMoveSelect={handleMoveSelect}
              />
            </div>
          </div>

          <div className="game-controls">
            {showConfirmButton && (
              <button 
                onClick={confirmMove}
                className="control-button primary"
                disabled={isThinking || gameStatus !== 'playing'}
              >
                <FiPlay className="button-icon" />
                Confirm Move
              </button>
            )}
            <button 
              onClick={resetGame}
              className="control-button secondary"
            >
              <FiRefreshCw className="button-icon" />
              New Game
            </button>
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>© 2025 Chess Analyzer. Powered by Stockfish and chess.js</p>
      </footer>
    </div>
  );
};

export default BotMatch; 