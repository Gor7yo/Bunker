import React from 'react';
import './ControlsPanel.css';

export const ControlsPanel = ({
  isCameraOn,
  isHost,
  peersRef,
  onToggleCamera,
  onOpenMyCharacteristics,
  onOpenAdminModal
}) => {
  const connectedCount = Object.values(peersRef.current || {}).filter(
    pc => pc.connectionState === 'connected'
  ).length;

  return (
    <div className="controls-panel">
      <button 
        onClick={onToggleCamera}
        className={`control-btn ${isCameraOn ? 'active' : 'inactive'}`}
      >
        {isCameraOn ? "📹 Выкл" : "📹❌ Вкл"}
      </button>
      
      {!isHost && (
        <button 
          onClick={onOpenMyCharacteristics}
          className="control-btn my-characteristics-btn"
        >
          🎴 Мои карты
        </button>
      )}
      
      {isHost && (
        <button 
          onClick={onOpenAdminModal}
          className="control-btn admin-btn"
        >
          Управление карточками
        </button>
      )}
      
      <button 
        onClick={() => window.location.reload()}
        className="control-btn exit-btn"
        title="Выйти"
      >
        Выйти
      </button>

      <div className="status-info">
        <span>Соединения: {connectedCount}</span>
      </div>
    </div>
  );
};

