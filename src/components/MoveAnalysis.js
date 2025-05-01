import React, { useState } from 'react';
import '../styles/MoveAnalysis.css';
import { analyzeMoves } from '../services/api';

const MoveAnalysis = ({ pgn, onClose }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

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

    const handleAnalyzeMoves = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!pgn || pgn.trim() === '') {
                throw new Error('Please enter a PGN to analyze');
            }
            const formattedPGN = formatPGN(pgn);
            console.log('Analyzing moves with formatted PGN');
            const data = await analyzeMoves(formattedPGN);
            setAnalysis(data);
        } catch (error) {
            const errorMessage = error.message || 'Failed to analyze moves. Please check your PGN format.';
            setError(errorMessage);
            console.error('Analysis error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getQualityColor = (quality) => {
        switch (quality) {
            case 'Best':
                return '#1baaa0';
            case 'Excellent':
                return '#4CAF50';
            case 'Great':
                return '#8BC34A';
            case 'Good':
                return '#FFC107';
            case 'Inaccuracy':
                return '#FF9800';
            case 'Miss':
                return '#F44336';
            case 'Blunder':
                return '#D32F2F';
            default:
                return '#757575';
        }
    };

    return (
        <div className="move-analysis">
            <div className="analysis-header">
                <h2>Move Analysis</h2>
                <button onClick={onClose} className="close-button">×</button>
            </div>

            {!analysis && !loading && (
                <button 
                    onClick={handleAnalyzeMoves} 
                    className="analyze-button"
                    disabled={!pgn || pgn.trim() === ''}
                >
                    Analyze Moves
                </button>
            )}

            {loading && (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Analyzing moves...</p>
                </div>
            )}

            {error && (
                <div className="error">
                    <p>{error}</p>
                    <p className="error-hint">Make sure your PGN is in the correct format. Example:</p>
                    <pre className="pgn-example">
                        [Event "Live Chess"]
                        [Site "Chess.com"]
                        [Date "2025.03.12"]
                        [Round "-"]
                        [White "Player1"]
                        [Black "Player2"]
                        [Result "1-0"]
                        [TimeControl "600"]
                        [Termination "Player1 won by checkmate"]

                        1. e4 &#123;[%clk 0:09:59.1]&#125; 1... e5 &#123;[%clk 0:09:46.5]&#125; 2. Nf3 &#123;[%clk 0:09:52.3]&#125; 2... Nc6 &#123;[%clk 0:09:41.2]&#125; 3. Bb5 &#123;[%clk 0:09:49.2]&#125; 3... a6 &#123;[%clk 0:09:36.4]&#125; 1-0
                    </pre>
                </div>
            )}

            {analysis && (
                <>
                    <div className="analysis-summary">
                        <h3>Summary</h3>
                        <div className="summary-stats">
                            {Object.entries(analysis.summary).map(([quality, count]) => (
                                <div key={quality} className="stat-item" style={{ color: getQualityColor(quality) }}>
                                    <span className="quality">{quality}</span>
                                    <span className="count">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="moves-list">
                        {analysis.moves.map((move, index) => (
                            <div key={index} className="move-item" style={{ borderLeftColor: getQualityColor(move.quality) }}>
                                <span className="move-number">{move.moveNumber}.</span>
                                <span className="move-text">{move.move}</span>
                                <span className="move-quality" style={{ color: getQualityColor(move.quality) }}>
                                    {move.quality}
                                </span>
                                {move.bestMove && move.bestMove !== move.move && (
                                    <span className="best-move">
                                        Best: {move.bestMove}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default MoveAnalysis; 