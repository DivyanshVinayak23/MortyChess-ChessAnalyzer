import React, { useState } from 'react';
import { fetchChessComGames } from '../services/api';
import '../styles/ChessComGames.css';

function ChessComGames({ onGameSelect }) {
  const [username, setUsername] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFetchGames = async () => {
    if (!username) return;
    setLoading(true);
    setError('');
    try {
      const fetchedGames = await fetchChessComGames(username);
      setGames(fetchedGames);
    } catch (error) {
      setError('Failed to fetch games. Please check the username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chess-com-games">
      <div className="games-header">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter chess.com username"
          className="username-input"
        />
        <button onClick={handleFetchGames} disabled={loading} className="fetch-button">
          {loading ? 'Loading...' : 'Fetch Games'}
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="games-list">
        {games.map((game, index) => (
          <div key={index} className="game-item" onClick={() => onGameSelect(game.pgn)}>
            <div className="game-players">
              {game.white} vs {game.black}
            </div>
            <div className="game-info">
              <span>{game.date}</span>
              <span>{game.result}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChessComGames;