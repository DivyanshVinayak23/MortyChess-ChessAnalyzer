import React from 'react';

function DarkModeToggle({ isDarkMode, onToggle }) {
  return (
    <button 
      onClick={onToggle}
      className={`dark-mode-toggle ${isDarkMode ? 'dark' : 'light'}`}
    >
      {isDarkMode ? '🌙' : '☀️'}
    </button>
  );
}

export default DarkModeToggle;