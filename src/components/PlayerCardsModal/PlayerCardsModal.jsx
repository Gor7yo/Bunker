import React from 'react';
import './PlayerCardsModal.css';

export const PlayerCardsModal = ({ player, onClose, onRevealCharacteristic, onActivateActionCard, getCategoryName }) => {
  if (!player?.characteristics) return null;

  return (
    <div className="player-cards-modal-overlay">
      <div className="player-cards-modal">
        <div className="player-cards-header">
          <h2>Карточки игрока: {player.name}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="player-cards-grid">
          {Object.entries(player.characteristics).map(([key, characteristic]) => (
            <div key={key} className={`admin-characteristic-card ${key} ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
              <div className="characteristic-header">
                <h4>{getCategoryName(key)}</h4>
                <span className={`status ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
                  {characteristic.revealed ? '✅ Раскрыто' : '❌ Скрыто'}
                </span>
              </div>
              <div className="characteristic-content">
                <p><strong>Значение:</strong> {characteristic.value}</p>
                {!characteristic.revealed && (
                  <button 
                    className="reveal-btn"
                    onClick={() => onRevealCharacteristic(player.id, key)}
                  >
                    🔓 Раскрыть
                  </button>
                )}
                {key === 'actions' && characteristic.revealed && (
                  <button 
                    className="activate-action-btn"
                    onClick={() => onActivateActionCard(player.id, characteristic)}
                  >
                    ⚡ Активировать
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

