import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PlayableChessboard from './PlayableChessboard';
import BotMatch from './components/BotMatch';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <main className="App-main">
          <Routes>
            <Route path="/" element={<PlayableChessboard />} />
            <Route path="/play" element={<BotMatch />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;