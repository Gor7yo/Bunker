import React from 'react';
import './VotingResultsModal.css';

export const VotingResultsModal = ({ votingResultsModal, onClose, onSelectCandidateToKick }) => {
  if (!votingResultsModal || !votingResultsModal.allResults) return null;

  return (
    <div className="voting-results-modal-overlay" onClick={onClose}>
      <div className="voting-results-modal" onClick={(e) => e.stopPropagation()}>
        <div className="voting-results-header">
          <h2>🗳️ Результаты голосования</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="voting-results-content">
          <div className="all-voting-results">
            <h4>Результаты по всем игрокам:</h4>
            <div className="results-list">
              {votingResultsModal.allResults.map((result) => (
                <div 
                  key={result.id} 
                  className={`result-item ${votingResultsModal.candidates.some(c => c.id === result.id) ? 'candidate-highlight' : ''}`}
                >
                  <span className="result-name">{result.name}</span>
                  <span className="result-votes">{result.votes} голос(ов)</span>
                </div>
              ))}
            </div>
          </div>

          {votingResultsModal.candidates && votingResultsModal.candidates.length > 1 && (
            <div className="candidates-selection">
              <p className="tie-message">Несколько игроков получили одинаковое количество голосов. Выберите, кого исключить:</p>
              <div className="candidates-list">
                {votingResultsModal.candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    className="candidate-btn"
                    onClick={() => onSelectCandidateToKick(candidate.id)}
                  >
                    <span className="candidate-name">{candidate.name}</span>
                    <span className="candidate-votes">{candidate.votes} голос(ов)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {votingResultsModal.candidates && votingResultsModal.candidates.length === 1 && (
            <div className="single-candidate-info">
              <p className="candidate-message">
                Игрок <strong>{votingResultsModal.candidates[0].name}</strong> получил наибольшее количество голосов и был исключен из игры.
              </p>
            </div>
          )}

          {(!votingResultsModal.candidates || votingResultsModal.candidates.length === 0) && (
            <div className="no-candidates-info">
              <p>Никто не получил голосов.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

