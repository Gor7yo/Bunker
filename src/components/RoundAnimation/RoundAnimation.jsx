import React from 'react';
import './RoundAnimation.css';

export const RoundAnimation = ({ show, currentRound, voting }) => {
  if (!show) return null;

  return (
    <div className="round-animation">
      <div className="round-text">
        {voting ? 'Голосование' : `Раунд ${currentRound}`}
      </div>
    </div>
  );
};

