// Lobby.js - рефакторированная версия
import React, { useEffect, useContext } from "react";
import "./Lobby.css";
import { DataContext } from "../../context/DataContext";
import { useWebRTC } from "../../hooks/useWebRTC";
import { useGameState } from "../../hooks/useGameState";
import { GameTimer } from "../../components/GameTimer/GameTimer";
import { DropdownMenu } from "../../components/DropdownMenu/DropdownMenu";
import { PlayerVideoCard } from "../../components/PlayerVideoCard/PlayerVideoCard";
import { ControlsPanel } from "../../components/ControlsPanel/ControlsPanel";
import { AdminModal } from "../../components/AdminModal/AdminModal";
import { VotingResultsModal } from "../../components/VotingResultsModal/VotingResultsModal";
import { MyCharacteristicsModal } from "../../components/MyCharacteristicsModal/MyCharacteristicsModal";
import { PlayerCardsModal } from "../../components/PlayerCardsModal/PlayerCardsModal";
import { ActionCardModal } from "../../components/ActionCardModal/ActionCardModal";
import { Tooltip } from "../../components/Tooltip/Tooltip";
import { RoundAnimation } from "../../components/RoundAnimation/RoundAnimation";

export const Lobby = ({ ws, playerId, players }) => {
  const { mirrorCamera } = useContext(DataContext);
  
  const isHost = players.find(p => p.id === playerId)?.role === "host";
  
  // Используем хук для WebRTC логики
  const { localStream, isCameraOn, toggleCamera, peersRef, videoRefs } = useWebRTC(ws, playerId, players);
  
  // Используем хук для управления состоянием игры
  const gameState = useGameState(ws, isHost, playerId, 5);
  
  const {
    isAdminModalOpen,
    setIsAdminModalOpen,
    selectedPlayerForAdmin,
    setSelectedPlayerForAdmin,
    actionCardModal,
    setActionCardModal,
    bannedPlayers,
    myCharacteristicsModal,
    setMyCharacteristicsModal,
    gameStartTime,
    elapsedTime,
    descriptionTooltip,
    setDescriptionTooltip,
    currentRound,
    totalRounds,
    showRoundAnimation,
    eventsModalOpen,
    setEventsModalOpen,
    highlightedPlayerId,
    setHighlightedPlayerId,
    votingActive,
    votingPhase,
    votingCandidates,
    selectedCandidates,
    setSelectedCandidates,
    votedPlayers,
    votingResultsModal,
    setVotingResultsModal,
    votingHistory,
    votingTabOpen,
    setVotingTabOpen,
    showVotingAnimation,
    descriptionTimeoutRef
  } = gameState;

  // =========================
  // 🔄 Применение зеркалирования ко всем видео элементам
  // =========================
  useEffect(() => {
    players.forEach(player => {
      if (videoRefs.current[player.id]) {
        const videoElement = videoRefs.current[player.id];
        // Для локального игрока используем настройки из контекста
        if (player.id === playerId) {
          videoElement.style.transform = mirrorCamera ? 'scaleX(-1)' : 'none';
        } else {
          // Для удаленных игроков используем данные от сервера
          videoElement.style.transform = player.mirrorCamera ? 'scaleX(-1)' : 'none';
        }
      }
    });
  }, [players, mirrorCamera, playerId, videoRefs]);

  // Функция для получения названия категории
  const getCategoryName = (key) => {
    const categoryNames = {
      'proffesion': 'Профессия',
      'health': 'Здоровье',
      'hobbie': 'Хобби',
      'fobia': 'Фобия',
      'bandage': 'Багаж',
      'age': 'Возраст',
      'fact': 'Факт',
      'actions': 'Действие'
    };
    return categoryNames[key] || key;
  };

  // Функция для вычисления корректной позиции тултипа с учетом границ экрана
  const calculateTooltipPosition = (x, y, elementHeight, text) => {
    const maxWidth = 300; // Максимальная ширина из CSS
    const padding = 15; // Отступ от краев экрана
    const estimatedTooltipHeight = 80; // Примерная высота тултипа
    const arrowHeight = 8; // Высота стрелки
    const spacing = 10; // Отступ от элемента
    
    let finalX = x;
    let finalY = y;
    let position = 'top'; // 'top' или 'bottom'
    
    // Проверяем границы по горизонтали
    const halfWidth = maxWidth / 2;
    const windowWidth = window.innerWidth;
    
    // Если тултип выходит за левую границу
    if (x - halfWidth < padding) {
      finalX = halfWidth + padding;
    }
    // Если тултип выходит за правую границу
    else if (x + halfWidth > windowWidth - padding) {
      finalX = windowWidth - halfWidth - padding;
    }
    
    // Проверяем границы по вертикали
    const windowHeight = window.innerHeight;
    // Тултип изначально располагается сверху (transform: translate(-50%, -100%))
    const tooltipTopY = y - estimatedTooltipHeight - arrowHeight - spacing;
    
    // Если тултип выходит за верхнюю границу, показываем его снизу
    if (tooltipTopY < padding) {
      position = 'bottom';
      finalY = y + elementHeight + arrowHeight + spacing;
      // Проверяем, не выходит ли снизу
      if (finalY + estimatedTooltipHeight > windowHeight - padding) {
        // Если и снизу не влезает, возвращаемся наверх, но ближе к верху экрана
        position = 'top';
        finalY = padding + estimatedTooltipHeight / 2;
      }
    } else {
      position = 'top';
    }
    
    return { x: finalX, y: finalY, position };
  };

  // Обработчик наведения на характеристику с описанием
  const handleCharacteristicMouseEnter = (characteristic, event) => {
    // Проверяем наличие описания или experience поля
    const hasDescription = characteristic && characteristic.revealed && 
      (characteristic.description || characteristic.experience);
    
    if (!hasDescription) {
      return;
    }

    // Очищаем предыдущий таймер
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    // Используем description или experience и убеждаемся, что первая буква заглавная
    let tooltipText = characteristic.description || characteristic.experience;
    if (tooltipText && tooltipText.length > 0) {
      // Преобразуем первую букву в заглавную (работает с кириллицей и латиницей)
      const firstChar = tooltipText[0];
      if (firstChar && firstChar === firstChar.toLowerCase()) {
        tooltipText = firstChar.toUpperCase() + tooltipText.slice(1);
      }
    }

    // Рассчитываем корректную позицию с учетом границ экрана
    const { x: finalX, y: finalY, position } = calculateTooltipPosition(x, y, rect.height, tooltipText);

    // Устанавливаем таймер на 0.65 секунды
    descriptionTimeoutRef.current = setTimeout(() => {
      setDescriptionTooltip({
        text: tooltipText,
        x: finalX,
        y: finalY,
        position: position,
        visible: true
      });
    }, 650);
  };

  // Обработчик убирания курсора с характеристики
  const handleCharacteristicMouseLeave = () => {
    // Очищаем таймер
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
      descriptionTimeoutRef.current = null;
    }

    // Плавно скрываем тултип
    if (descriptionTooltip) {
      setDescriptionTooltip(prev => prev ? { ...prev, visible: false } : null);
      // Удаляем тултип после анимации исчезновения
      setTimeout(() => {
        setDescriptionTooltip(null);
      }, 300);
    }
  };

  // Функция для раскрытия характеристики
  const revealCharacteristic = (playerId, characteristicKey) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'reveal_characteristic',
        playerId: playerId,
        characteristicType: characteristicKey
      }));
    }
  };

  // Функция для активации карты действия
  const handleActivateActionCard = (playerId, card) => {
    setActionCardModal({ playerId, card });
  };

  // Функция для обработки действия карты
  const executeActionCard = (actionType, parameters) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'execute_action_card',
        actionType: actionType,
        parameters: parameters
      }));
    }
    setActionCardModal(null);
  };

  // Функция для изгнания/возврата игрока
  const toggleBanPlayer = (targetPlayerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'toggle_ban_player',
        playerId: targetPlayerId
      }));
    }
  };

  // Функция для установки количества раундов
  const handleSetTotalRounds = (rounds) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_total_rounds',
        totalRounds: rounds
      }));
    }
  };

  // Функция для переключения раунда
  const handleChangeRound = (round) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'change_round',
        round: round
      }));
    }
  };

  // Функция для переключения зеленой рамки игрока
  const handleTogglePlayerHighlight = (playerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'toggle_player_highlight',
        playerId: playerId
      }));
    }
  };

  // Функция для начала этапа выбора кандидатов (только для хоста)
  const handleStartVotingSelection = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'start_voting_selection'
      }));
      setSelectedCandidates(new Set());
    }
  };

  // Функция для переключения выбора кандидата
  const handleToggleCandidate = (playerId) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // Функция для отправки списка кандидатов на сервер
  const handleSetCandidates = () => {
    if (ws && ws.readyState === WebSocket.OPEN && selectedCandidates.size > 0) {
      ws.send(JSON.stringify({
        type: 'set_voting_candidates',
        candidates: Array.from(selectedCandidates)
      }));
    }
  };

  // Функция для подтверждения кандидатов и начала голосования (только для хоста)
  const handleConfirmVotingCandidates = () => {
    if (ws && ws.readyState === WebSocket.OPEN && selectedCandidates.size > 0) {
      // Сначала отправляем список кандидатов
      ws.send(JSON.stringify({
        type: 'set_voting_candidates',
        candidates: Array.from(selectedCandidates)
      }));
      // Затем подтверждаем и запускаем голосование
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'confirm_voting_candidates'
        }));
      }, 100);
    }
  };

  // Функция для отмены голосования (только для хоста)
  const handleCancelVoting = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'cancel_voting'
      }));
    }
  };

  // Функция для голосования за вылет игрока
  const handleVoteToKick = (targetPlayerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'vote_to_kick',
        targetPlayerId: targetPlayerId
      }));
    }
  };

  // Функция для выбора кандидата на вылет (только для хоста, при ничьей)
  const handleSelectCandidateToKick = (playerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      toggleBanPlayer(playerId);
      setVotingResultsModal(null);
    }
  };

  // Синхронизация выбранного игрока с актуальными данными
  useEffect(() => {
    if (selectedPlayerForAdmin) {
      const updatedPlayer = players.find(p => p.id === selectedPlayerForAdmin.id);
      if (updatedPlayer) {
        setSelectedPlayerForAdmin(updatedPlayer);
      }
    }
  }, [players, selectedPlayerForAdmin]);

  // =========================
  // 🎨 Рендер
  // =========================
  return (
    <div className="lobby-container">
      <GameTimer elapsedTime={gameStartTime ? elapsedTime : 0} />
      <DropdownMenu gameStartTime={gameStartTime} />
      
      <div className="lobby-grid">
        {players.filter(p => p.role !== "host").map((player, index) => {
          // Создаем ref для видео элемента
          const videoRef = (el) => {
            if (el && !videoRefs.current[player.id]) {
              console.log(`🎥 Создан видео элемент для ${player.id}`);
              videoRefs.current[player.id] = el;
              
              if (player.id === playerId && localStream) {
                el.srcObject = localStream;
                el.muted = true;
                el.play().catch(console.warn);
              }
              
              if (player.mirrorCamera) {
                el.style.transform = 'scaleX(-1)';
              }
            }
          };

          return (
            <div key={player.id}>
              <PlayerVideoCard
                player={player}
                index={index}
                playerId={playerId}
                isHost={isHost}
                localStream={localStream}
                videoRefs={videoRefs}
                videoRef={videoRef}
                bannedPlayers={bannedPlayers}
                highlightedPlayerId={highlightedPlayerId}
                votingPhase={votingPhase}
                selectedCandidates={selectedCandidates}
                votingCandidates={votingCandidates}
                votingActive={votingActive}
                votedPlayers={votedPlayers}
                isCameraOn={isCameraOn}
                onToggleBanPlayer={toggleBanPlayer}
                onTogglePlayerHighlight={handleTogglePlayerHighlight}
                onVoteToKick={handleVoteToKick}
                onCharacteristicMouseEnter={handleCharacteristicMouseEnter}
                onCharacteristicMouseLeave={handleCharacteristicMouseLeave}
                getCategoryName={getCategoryName}
              />
            </div>
          );
        })}
      </div>

      <VotingResultsModal
        votingResultsModal={votingResultsModal}
        onClose={() => setVotingResultsModal(null)}
        onSelectCandidateToKick={handleSelectCandidateToKick}
      />

      <Tooltip tooltip={descriptionTooltip} />

      <ControlsPanel
        isCameraOn={isCameraOn}
        isHost={isHost}
        peersRef={peersRef}
        onToggleCamera={toggleCamera}
        onOpenMyCharacteristics={() => setMyCharacteristicsModal(true)}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
      />

      {/* Компонент для работы с характеристиками игроков */}
      {/* <GameCharacteristics 
        ws={ws}
        players={players}
        playerId={playerId}
        isHost={players.find(p => p.id === playerId)?.role === "host"}
      /> */}

      <RoundAnimation show={showRoundAnimation} currentRound={currentRound} voting={false} />
      <RoundAnimation show={showVotingAnimation} currentRound={0} voting={true} />

      <AdminModal
        isOpen={isAdminModalOpen}
        players={players}
        eventsModalOpen={eventsModalOpen}
        votingTabOpen={votingTabOpen}
        totalRounds={totalRounds}
        currentRound={currentRound}
        gameStartTime={gameStartTime}
        isHost={isHost}
        votingPhase={votingPhase}
        selectedCandidates={selectedCandidates}
        votingCandidates={votingCandidates}
        bannedPlayers={bannedPlayers}
        votingHistory={votingHistory}
        onClose={() => {
          setIsAdminModalOpen(false);
          setEventsModalOpen(false);
          setVotingTabOpen(false);
        }}
        onSetEventsModalOpen={setEventsModalOpen}
        onSetVotingTabOpen={setVotingTabOpen}
        onSetSelectedPlayerForAdmin={setSelectedPlayerForAdmin}
        onSetTotalRounds={handleSetTotalRounds}
        onChangeRound={handleChangeRound}
        onStartVotingSelection={handleStartVotingSelection}
        onToggleCandidate={handleToggleCandidate}
        onConfirmVotingCandidates={handleConfirmVotingCandidates}
        onCancelVoting={handleCancelVoting}
      />

      {selectedPlayerForAdmin && (
        <PlayerCardsModal
          player={selectedPlayerForAdmin}
          onClose={() => setSelectedPlayerForAdmin(null)}
          onRevealCharacteristic={revealCharacteristic}
          onActivateActionCard={handleActivateActionCard}
          getCategoryName={getCategoryName}
        />
      )}

      {actionCardModal && (
        <ActionCardModal
          card={actionCardModal.card}
          players={players}
          onExecute={executeActionCard}
          onClose={() => setActionCardModal(null)}
        />
      )}

      {myCharacteristicsModal && (
        <MyCharacteristicsModal
          player={players.find(p => p.id === playerId)}
          onClose={() => setMyCharacteristicsModal(false)}
          getCategoryName={getCategoryName}
        />
      )}

    </div>
  );
};