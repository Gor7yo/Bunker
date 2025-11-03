import React from 'react';
import './GameTimer.css';

export const GameTimer = ({ elapsedTime }) => {
  const formatTime = (ms) => {
    if (!ms || ms === 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  if (!elapsedTime && elapsedTime !== 0) return null;

  return (
    <div className="game-timer">
      <span className="timer-icon">⏱️</span>
      <span className="timer-text">{formatTime(elapsedTime)}</span>
    </div>
  );
};

