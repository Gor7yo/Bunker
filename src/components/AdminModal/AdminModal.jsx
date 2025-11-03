import React from 'react';
import './AdminModal.css';

export const AdminModal = ({
  isOpen,
  players,
  eventsModalOpen,
  votingTabOpen,
  totalRounds,
  currentRound,
  gameStartTime,
  isHost,
  votingPhase,
  selectedCandidates,
  votingCandidates,
  bannedPlayers,
  votingHistory,
  onClose,
  onSetEventsModalOpen,
  onSetVotingTabOpen,
  onSetSelectedPlayerForAdmin,
  onSetTotalRounds,
  onChangeRound,
  onStartVotingSelection,
  onToggleCandidate,
  onConfirmVotingCandidates,
  onCancelVoting
}) => {
  const [localTotalRounds, setLocalTotalRounds] = React.useState(totalRounds);

  React.useEffect(() => {
    setLocalTotalRounds(totalRounds);
  }, [totalRounds]);
  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>Управление игрой</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="admin-modal-tabs">
          <button 
            className={`admin-tab ${!eventsModalOpen && !votingTabOpen ? 'active' : ''}`}
            onClick={() => {
              onSetEventsModalOpen(false);
              onSetVotingTabOpen(false);
            }}
          >
            Карточки игроков
          </button>
          <button 
            className={`admin-tab ${eventsModalOpen && !votingTabOpen ? 'active' : ''}`}
            onClick={() => {
              onSetEventsModalOpen(true);
              onSetVotingTabOpen(false);
            }}
          >
            Ивенты
          </button>
          <button 
            className={`admin-tab ${votingTabOpen ? 'active' : ''}`}
            onClick={() => {
              onSetEventsModalOpen(false);
              onSetVotingTabOpen(true);
            }}
          >
            Голосование
          </button>
        </div>

        {!eventsModalOpen && !votingTabOpen && (
          <div className="admin-players-list">
            {players.filter(p => p.role !== 'host').map(player => (
              <div key={player.id} className="admin-player-card">
                <div className="admin-player-info">
                  <h3>{player.name}</h3>
                </div>
                <div className="admin-player-actions">
                  <button 
                    className="view-btn"
                    onClick={() => onSetSelectedPlayerForAdmin(player)}
                  >
                    ✏️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {eventsModalOpen && (
          <div className="events-tab-content">
            <div className="rounds-control-section">
              <h3>🎯 Управление раундами</h3>
              
              <div className="rounds-config">
                <label htmlFor="total-rounds">Количество раундов:</label>
                <input
                  id="total-rounds"
                  type="number"
                  min="1"
                  max="20"
                  value={localTotalRounds}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setLocalTotalRounds(value);
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    onSetTotalRounds(value);
                  }}
                  className="rounds-input"
                />
              </div>

              <div className="current-round-info">
                <p>Текущий раунд: <span className="round-number">{currentRound || 0}</span> / {localTotalRounds}</p>
              </div>

              <div className="rounds-buttons">
                <h4>Переключить раунд:</h4>
                <div className="round-buttons-grid">
                  {Array.from({ length: localTotalRounds }, (_, i) => i + 1).map((round) => (
                    <button
                      key={round}
                      className={`round-btn ${currentRound === round ? 'active' : ''}`}
                      onClick={() => onChangeRound(round)}
                      disabled={currentRound === round}
                    >
                      {round}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {votingTabOpen && (
          <div className="voting-tab-content">
            <div className="voting-control-section">
              <h3>🗳️ Голосование на вылет</h3>
              {votingPhase === null ? (
                <div className="voting-control">
                  <p>Начните процесс голосования: сначала выберите кандидатов, затем запустите голосование.</p>
                  <button
                    className="start-voting-btn"
                    onClick={onStartVotingSelection}
                    disabled={!gameStartTime || !isHost}
                  >
                    Начать выбор кандидатов
                  </button>
                </div>
              ) : votingPhase === "selection" ? (
                <div className="voting-selection-section">
                  <h4>Выберите кандидатов для голосования:</h4>
                  <div className="candidates-selection-list">
                    {players
                      .filter(p => p.role !== "host" && !bannedPlayers.has(p.id))
                      .map(player => (
                        <label key={player.id} className="candidate-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedCandidates.has(player.id)}
                            onChange={() => onToggleCandidate(player.id)}
                          />
                          <span>{player.name}</span>
                        </label>
                      ))}
                  </div>
                  <div className="candidates-actions">
                    <button
                      className="confirm-candidates-btn"
                      onClick={onConfirmVotingCandidates}
                      disabled={selectedCandidates.size === 0}
                    >
                      Подтвердить и начать голосование ({selectedCandidates.size})
                    </button>
                    <button
                      className="cancel-voting-btn"
                      onClick={onCancelVoting}
                      title="Отменить"
                    >
                      Отменить
                    </button>
                  </div>
                </div>
              ) : (
                <div className="voting-status">
                  <p className="voting-active-text">🗳️ Голосование активно</p>
                  <p className="voting-info">Игроки выбирают из кандидатов, кого исключить из игры</p>
                  <div className="voting-candidates-list">
                    <p>Кандидаты:</p>
                    <ul>
                      {votingCandidates.map(candidateId => {
                        const candidate = players.find(p => p.id === candidateId);
                        return candidate ? <li key={candidateId}>{candidate.name}</li> : null;
                      })}
                    </ul>
                  </div>
                  {isHost && (
                    <button
                      className="cancel-voting-btn"
                      onClick={onCancelVoting}
                      title="Отменить голосование"
                    >
                      Отменить голосование
                    </button>
                  )}
                </div>
              )}
            </div>

            {votingHistory.length > 0 && (
              <div className="voting-history-section">
                <h3>📋 История голосований</h3>
                <div className="voting-history-list">
                  {votingHistory.map((entry, index) => {
                    const date = new Date(entry.timestamp);
                    const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={index} className="voting-history-item">
                        <div className="voting-history-header">
                          <span className="voting-history-time">Голосование #{index + 1} - {timeString}</span>
                        </div>
                        <div className="voting-history-results">
                          {entry.results.map((result, resultIndex) => (
                            <div key={resultIndex} className={`voting-history-result ${entry.candidates.some(c => c.id === result.id) ? 'candidate' : ''}`}>
                              <span className="result-name">{result.name}</span>
                              <span className="result-votes">{result.votes} голос(ов)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

