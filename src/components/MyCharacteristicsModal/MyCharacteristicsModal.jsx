import React from 'react';
import './MyCharacteristicsModal.css';

export const MyCharacteristicsModal = ({ player, onClose, getCategoryName }) => {
  if (!player?.characteristics) return null;

  return (
    <div className="my-characteristics-modal-overlay" onClick={onClose}>
      <div className="my-characteristics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="my-characteristics-header">
          <h2>Мои характеристики</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="my-characteristics-grid">
          {Object.entries(player.characteristics).map(([key, characteristic]) => (
            <div key={key} className={`my-characteristic-card ${key} ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
              <div className="characteristic-header">
                <h4>{getCategoryName(key)}</h4>
                <span className={`status ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
                  {characteristic.revealed ? '✅ Раскрыто' : '❌ Скрыто'}
                </span>
              </div>
              <div className="characteristic-content">
                <h3>{characteristic.value}</h3>
                {characteristic.description && (
                  <p className="characteristic-description"><em>{characteristic.description}</em></p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

