import React from 'react';
import './ControlsPanel.css';

export const ControlsPanel = ({
  isCameraOn,
  isHost,
  peersRef,
  onToggleCamera,
  onOpenMyCharacteristics,
  onOpenAdminModal,
  onRequestPermissions,
  permissionError
}) => {
  const connectedCount = Object.values(peersRef.current || {}).filter(
    pc => pc.connectionState === 'connected'
  ).length;

  return (
    <div className="controls-panel">
      {permissionError === 'NotAllowedError' && (
        <button 
          onClick={onRequestPermissions}
          className="control-btn permission-btn"
          style={{ backgroundColor: '#ff6b6b', color: 'white' }}
        >
          🔓 Разрешить доступ к камере
        </button>
      )}
      <button 
        onClick={onToggleCamera}
        className={`control-btn ${isCameraOn ? 'active' : 'inactive'}`}
        disabled={permissionError === 'NotAllowedError'}
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

