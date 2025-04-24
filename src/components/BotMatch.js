import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { getBotMove } from '../services/api';
import { FiGitBranch, FiAlertCircle, FiRefreshCw, FiPlay, FiSettings } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import logo from './logo.png';
import '../styles/BotMatch.css';

const BotMatch = () => {
  const [game, setGame] = useState(new Chess());
  const [position, setPosition] = useState('start');
  const [isThinking, setIsThinking] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [gameStatus, setGameStatus] = useState('playing'); 
  const [pendingMove, setPendingMove] = useState(null);
  const [showConfirmButton, setShowConfirmButton] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);

  useEffect(() => {
    console.log('State updated:', { 
      showConfirmButton, 
      pendingMove, 
      isThinking, 
      gameStatus 
    });
  }, [showConfirmButton, pendingMove, isThinking, gameStatus]);

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
    try {
      console.log('Sending request to get bot move with FEN:', game.fen());
      const data = await getBotMove(game.fen(), difficulty);
      console.log('Bot move response:', data);
      if (data.move) {
        makeMove(data.move);
      }
    } catch (error) {
      console.error('Error getting bot move:', error);
    }
    setIsThinking(false);
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
          </div>

          <div className="game-board-section">
            <div className="chess-board-container">
              <Chessboard 
                position={position}
                onPieceDrop={onDrop}
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
                  })
                }}
              />
              {isThinking && (
                <div className="thinking-indicator">
                  <div className="thinking-spinner"></div>
                  <span>Bot is thinking...</span>
                </div>
              )}
            </div>

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