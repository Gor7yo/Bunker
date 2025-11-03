import React from 'react';
import { FaBan } from "react-icons/fa6";
import { GiHolyGrail } from "react-icons/gi";
import { TbMicrophone2Off, TbMicrophone2 } from "react-icons/tb";
import { LuVote } from "react-icons/lu";
import './PlayerVideoCard.css';

export const PlayerVideoCard = ({
  player,
  index,
  playerId,
  isHost,
  localStream,
  videoRefs,
  videoRef,
  bannedPlayers,
  highlightedPlayerId,
  votingPhase,
  selectedCandidates,
  votingCandidates,
  votingActive,
  votedPlayers,
  isCameraOn,
  onToggleBanPlayer,
  onTogglePlayerHighlight,
  onVoteToKick,
  onCharacteristicMouseEnter,
  onCharacteristicMouseLeave,
  getCategoryName
}) => {
  return (
    <div 
      className={`player-video-card ${highlightedPlayerId === player.id ? 'highlighted' : ''} ${
        (votingPhase === "selection" && selectedCandidates.has(player.id)) || 
        (votingPhase === "voting" && votingCandidates.includes(player.id)) 
          ? 'candidate-selected' : ''
      }`}
    >
      {/* Верхняя панель */}
      <div className="player-top-bar">
        <div className="player-number">{index + 1}</div>
        <div className="player-nickname">{player.name}</div>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={player.id === playerId}
        className={`player-video ${bannedPlayers.has(player.id) ? 'banned' : ''}`}
      />

      {/* Панель характеристик */}
      {player.characteristics && (
        <>
          <div className="characteristics-block-left">
            <div 
              className="characteristic-item characteristic-profession"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.proffesion, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.proffesion?.revealed ? (
                <span className="characteristic-value">{player.characteristics.proffesion.value}</span>
              ) : (
                <span className="characteristic-label characteristic-profession">Профессия</span>
              )}
            </div>
            <div 
              className="characteristic-item characteristic-health"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.health, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.health?.revealed ? (
                <span className="characteristic-value">{player.characteristics.health.value}</span>
              ) : (
                <span className="characteristic-label characteristic-health">Здоровье</span>
              )}
            </div>
            <div 
              className="characteristic-item characteristic-hobby"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.hobbie, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.hobbie?.revealed ? (
                <span className="characteristic-value">{player.characteristics.hobbie.value}</span>
              ) : (
                <span className="characteristic-label characteristic-hobby">Хобби</span>
              )}
            </div>
            <div 
              className="characteristic-item characteristic-phobia"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.fobia, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.fobia?.revealed ? (
                <span className="characteristic-value">{player.characteristics.fobia.value}</span>
              ) : (
                <span className="characteristic-label characteristic-phobia">Фобия</span>
              )}
            </div>
          </div>

          <div className="characteristics-block-right">
            <div 
              className="characteristic-item characteristic-baggage"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.bandage, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.bandage?.revealed ? (
                <span className="characteristic-value">{player.characteristics.bandage.value}</span>
              ) : (
                <span className="characteristic-label characteristic-baggage">Багаж</span>
              )}
            </div>
            <div 
              className="characteristic-item characteristic-fact"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.fact, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.fact?.revealed ? (
                <span className="characteristic-value">{player.characteristics.fact.value}</span>
              ) : (
                <span className="characteristic-label characteristic-fact">Факт</span>
              )}
            </div>
            <div 
              className="characteristic-item characteristic-age"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.age, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.age?.revealed ? (
                <span className="characteristic-value">{player.characteristics.age.value}</span>
              ) : (
                <span className="characteristic-label">Возраст</span>
              )}
            </div>
            <div 
              className="characteristic-item characteristic-action"
              onMouseEnter={(e) => onCharacteristicMouseEnter(player.characteristics.actions, e)}
              onMouseLeave={onCharacteristicMouseLeave}
            >
              {player.characteristics.actions?.revealed ? (
                <span className="characteristic-value">{player.characteristics.actions.value}</span>
              ) : (
                <span className="characteristic-label characteristic-action">Действие</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Кнопка изгнания (только для админа) */}
      {isHost && (
        <button 
          className={`ban-btn ${bannedPlayers.has(player.id) ? 'unban' : 'ban'}`}
          onClick={() => onToggleBanPlayer(player.id)}
          title={bannedPlayers.has(player.id) ? 'Вернуть игрока' : 'Изгнать игрока'}
        >
          {bannedPlayers.has(player.id) ? <GiHolyGrail className="reload-player" /> : <FaBan className="ban-player" />}
        </button>
      )}

      {/* Надпись ИЗГНАН */}
      {bannedPlayers.has(player.id) && (
        <div className="banned-overlay">
          <div className="banned-text">ИЗГНАН</div>
        </div>
      )}

      {/* Камера выключена */}
      {player.id === playerId && !isCameraOn && (
        <div className="camera-off-overlay">
          <div className="camera-off-text">Камера выключена</div>
        </div>
      )}

      {/* Зеленая кнопка выделения (только для хоста) */}
      {isHost && !bannedPlayers.has(player.id) && (
        <button
          className={`highlight-btn ${highlightedPlayerId === player.id ? 'active' : ''}`}
          onClick={() => onTogglePlayerHighlight(player.id)}
          title={highlightedPlayerId === player.id ? 'Снять выделение' : 'Выделить игрока'}
        >
          {highlightedPlayerId === player.id ? <TbMicrophone2Off className="highlight-btn-icon" /> : <TbMicrophone2 className="highlight-btn-icon" />}
        </button>
      )}

      {/* Кнопка выставить на голосование */}
      {votingActive && player.id !== playerId && !isHost && !bannedPlayers.has(player.id) && !bannedPlayers.has(playerId) && votingCandidates.includes(player.id) && (
        <button
          className={`vote-kick-btn ${votedPlayers.includes(playerId) ? 'disabled' : ''}`}
          onClick={() => onVoteToKick(player.id)}
          disabled={votedPlayers.includes(playerId)}
          title={votedPlayers.includes(playerId) ? 'Вы уже проголосовали' : 'Проголосовать'}
        >
          <LuVote className="vote-icon" />
        </button>
      )}
    </div>
  );
};

