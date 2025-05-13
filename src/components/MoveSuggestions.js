import React from 'react';
import '../styles/MoveSuggestions.css';

const MoveSuggestions = ({ suggestions, onMoveSelect }) => {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="move-suggestions">
      <h3>Suggested Moves</h3>
      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => (
          <div key={index} className="suggestion-card">
            <div className="suggestion-header">
              <span className="move-number">{index + 1}.</span>
              <button 
                className="move-button"
                onClick={() => onMoveSelect(suggestion.move)}
              >
                {suggestion.move}
              </button>
            </div>
            <div className="suggestion-details">
              <p className="explanation">
                <strong>Why it's good:</strong> {suggestion.explanation}
              </p>
              <p className="risks">
                <strong>Risks:</strong> {suggestion.risks}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MoveSuggestions; 