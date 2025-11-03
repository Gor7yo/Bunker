import React from 'react';
import './Tooltip.css';

export const Tooltip = ({ tooltip }) => {
  if (!tooltip) return null;

  return (
    <div 
      className={`description-tooltip ${tooltip.visible ? 'visible' : ''} ${tooltip.position === 'bottom' ? 'tooltip-bottom' : ''}`}
      style={{
        left: `${tooltip.x}px`,
        top: tooltip.position === 'bottom' 
          ? `${tooltip.y + 10}px` 
          : `${tooltip.y - 10}px`,
        transform: tooltip.position === 'bottom' 
          ? 'translate(-50%, 0%)' 
          : 'translate(-50%, -100%)'
      }}
    >
      <div className="tooltip-content">
        {tooltip.text}
      </div>
      <div className={`tooltip-arrow ${tooltip.position === 'bottom' ? 'arrow-bottom' : ''}`}></div>
    </div>
  );
};

