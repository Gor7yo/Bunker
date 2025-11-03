import React, { useState } from 'react';
import './ActionCardModal.css';

export const ActionCardModal = ({ card, players, onExecute, onClose }) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState(null);
  
  const handleSubmit = () => {
    const cardName = card.value;
    
    onExecute(cardName, {
      selectedPlayers,
      selectedCharacteristics
    });
  };

  const renderCardUI = () => {
    const cardName = card.value;
    
    if (card.description.includes("выбери одного игрока") || 
        card.description.includes("Выбери одного игрока")) {
      return (
        <div>
          <p className="card-description">{card.description}</p>
          <div className="player-selection">
            <h4>Выберите игрока:</h4>
            <select 
              value={selectedPlayers[0] || ""} 
              onChange={(e) => setSelectedPlayers([e.target.value])}
              className="player-select"
            >
              <option value="">-- Выберите игрока --</option>
              {players.filter(p => p.role !== 'host').map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    if (card.description.includes("выбери двух игроков")) {
      return (
        <div>
          <p className="card-description">{card.description}</p>
          <div className="player-selection">
            <h4>Выберите двух игроков:</h4>
            <select 
              value={selectedPlayers[0] || ""} 
              onChange={(e) => setSelectedPlayers([e.target.value, selectedPlayers[1]])}
              className="player-select"
            >
              <option value="">-- Игрок 1 --</option>
              {players.filter(p => p.role !== 'host').map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
            <select 
              value={selectedPlayers[1] || ""} 
              onChange={(e) => setSelectedPlayers([selectedPlayers[0], e.target.value])}
              className="player-select"
            >
              <option value="">-- Игрок 2 --</option>
              {players.filter(p => p.role !== 'host').map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    return (
      <div>
        <p className="card-description">{card.description}</p>
        <p className="card-warning">Вы уверены, что хотите активировать эту карту?</p>
      </div>
    );
  };

  return (
    <div className="action-card-modal-overlay" onClick={onClose}>
      <div className="action-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="action-card-header">
          <h2>❗Карта действия: {card.value}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="action-card-content">
          {renderCardUI()}
        </div>

        <div className="action-card-actions">
          <button className="cancel-btn" onClick={onClose}>Отмена</button>
          <button className="execute-btn" onClick={handleSubmit}>Выполнить</button>
        </div>
      </div>
    </div>
  );
};

