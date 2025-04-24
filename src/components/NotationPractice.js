import React, { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { FiGitBranch, FiAlertCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import logo from './logo.png';
import '../styles/NotationPractice.css';

function NotationPractice() {
    const [game] = useState(new Chess());
    const [currentSquare, setCurrentSquare] = useState('');
    const [selectedSquare, setSelectedSquare] = useState(null);
    const [isCorrect, setIsCorrect] = useState(null);
    
    const generateRandomSquare = () => {
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
      const file = files[Math.floor(Math.random() * files.length)];
      const rank = ranks[Math.floor(Math.random() * ranks.length)];
      return file + rank;
    };
  
    const onSquareClick = (square) => {
      setSelectedSquare(square);
      if (square.toLowerCase() === currentSquare.toLowerCase()) {
        setIsCorrect(true);
      } else {
        setIsCorrect(false);
      }
    };
  
    const getNextPuzzle = () => {
      setSelectedSquare(null);
      setIsCorrect(null);
      setCurrentSquare(generateRandomSquare());
    };
  
    // Initialize first puzzle
    React.useEffect(() => {
      getNextPuzzle();
    }, []);
  
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
          <div className="practice-container">
            <div className="practice-info">
              <h2>Practice Chess Notation</h2>
              <div className="current-square">
                Find square: <span className="target-square">{currentSquare}</span>
              </div>
            </div>
  
            <div className="board-container">
              <Chessboard
                position={game.fen()}
                onSquareClick={onSquareClick}
                boardWidth={560}
                customSquareStyles={{
                  ...(selectedSquare && {
                    [selectedSquare]: {
                      background: isCorrect ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)',
                    },
                  }),
                  ...(isCorrect === false && {
                    [currentSquare]: {
                      background: 'rgba(0, 255, 0, 0.4)',
                    },
                  }),
                }}
              />
            </div>
  
            <div className="practice-controls">
              <button
                onClick={getNextPuzzle}
                className="control-button primary"
              >
                Next Square
              </button>
            </div>
          </div>
        </main>
  
        <footer className="app-footer">
          <p>© 2025 Chess Analyzer. Powered by Stockfish and chess.js</p>
        </footer>
      </div>
    );
  }
  
  export default NotationPractice;