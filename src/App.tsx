import React,{useState,useEffect} from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import PlayableChessboard from './PlayableChessboard';
import BotMatch from './components/BotMatch';
import NotationPractice from './components/NotationPractice';
import './App.css';
import DarkModeToggle from './components/DarkModeToggle';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    document.body.classList.toggle('dark-mode', isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };
  return (
    <Router>
      <div className="`App ${isDarkMode ? 'dark-mode' : ''}`">
        <main className="App-main">
          <div className="top-bar">
            <DarkModeToggle isDarkMode={isDarkMode} onToggle={toggleDarkMode} />
          </div>
          <Routes>
            <Route path="/" element={<PlayableChessboard />} />
            <Route path="/play" element={<BotMatch />} />
            <Route path="/practice" element={<NotationPractice/>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;