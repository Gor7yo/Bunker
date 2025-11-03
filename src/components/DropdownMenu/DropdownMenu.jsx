import React, { useState } from 'react';
import './DropdownMenu.css';
import { GameTimer } from '../GameTimer/GameTimer';

export const DropdownMenu = ({ gameStartTime, elapsedTime }) => {
  const [dropdownMenuOpen, setDropdownMenuOpen] = useState(true);

  if (!gameStartTime) return null;

  return (
    <div className={`dropdown-menu-wrapper ${dropdownMenuOpen ? 'open' : ''}`}>
      <div className="dropdown-menu-content">
        <div className="dropdown-blocks-container">
          <div className="dropdown-block dropdown-block-1">
            <div className="bunker-story">
              <p className="story-text">
                Зона снова сожрала сама себя. После последнего выброса половина территории покрылась сияющим туманом, из которого доносятся странные звуки — будто сама Земля поёт караоке с контролёрами.
              </p>
              <p className="story-text">
                Все выходы перекрыты, мутанты лезут отовсюду, а единственное безопасное место поблизости — старый подземный бункер времён Сталкрафта.
              </p>
              <p className="story-text">
                Но тут есть один нюанс: этот бункер стал ареной самого важного отбора в клан.
                Теперь именно здесь решается, кто попадёт в элиту, будет получать лучшие артефакты и патроны, и кто будет гордо носить нашивку клана.
                А кто… останется в подклане, где твой главный лут — лопата и три дырявых противогаза.
              </p>
              <p className="story-text">
                Снаружи бушует аномальный ад, но настоящее сражение происходит здесь, в бетонных стенах.
                Здесь решается: кто — будущая легенда Зоны, а кто — вечный «подклановец», чья судьба — чистить ботинки тем, кто умнее соврал у костра.
              </p>
            </div>
          </div>
          <div className="dropdown-block-title dropdown-block-2">
            <GameTimer elapsedTime={elapsedTime || 0} />
            <span className="bunker-title">БУНКЕР</span>
          </div>
          <div className="dropdown-block dropdown-block-3">
            <div className="bunker-rules">
              <h3 className="rules-title">Правила просты:</h3>
              <ul className="story-rules">
                <li>Мест мало. Не все смогут войти в состав клана.</li>
                <li>Каждый должен убедить остальных, что он полезнее, хитрее и нужнее.</li>
                <li>Слабое звено будет отправлено в подклан, где жизнь — это бесконечные побегушки за тушёнкой для старших.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <button 
        className="dropdown-menu-toggle"
        onClick={() => setDropdownMenuOpen(!dropdownMenuOpen)}
        title={dropdownMenuOpen ? "Свернуть меню" : "Развернуть меню"}
      >
        <span className={`dropdown-arrow ${dropdownMenuOpen ? 'rotated' : ''}`}>&gt;</span>
      </button>
    </div>
  );
};

