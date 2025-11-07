import React, { useEffect, useContext } from "react";
import "./Lobby.css";
import { DataContext } from "../../context/DataContext";
import { useMediasoup } from "../../hooks/useMediasoup";
import { useGameState } from "../../hooks/useGameState";
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
  const gameState = useGameState(ws, isHost, playerId, 5);
  
  // Проверяем что игра началась через gameStartTime
  const gameStarted = !!gameState.gameStartTime;
  const { localStream, isCameraOn, toggleCamera, videoRefs } = useMediasoup(ws, playerId, players, gameStarted);
  const peersRef = React.useRef({}); // Заглушка для совместимости (не используется в mediasoup)
  
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

  useEffect(() => {
    players.forEach(player => {
      if (videoRefs.current[player.id]) {
        const videoElement = videoRefs.current[player.id];
        if (player.id === playerId) {
          videoElement.style.transform = mirrorCamera ? 'scaleX(-1)' : 'none';
          } else {
          videoElement.style.transform = player.mirrorCamera ? 'scaleX(-1)' : 'none';
        }
      }
    });
  }, [players, mirrorCamera, playerId, videoRefs]);

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

  const calculateTooltipPosition = (x, y, elementHeight, text) => {
    const maxWidth = 300;
    const padding = 15;
    const estimatedTooltipHeight = 80;
    const arrowHeight = 8;
    const spacing = 10;
    
    let finalX = x;
    let finalY = y;
    let position = 'top';
    
    const halfWidth = maxWidth / 2;
    const windowWidth = window.innerWidth;
    
    if (x - halfWidth < padding) {
      finalX = halfWidth + padding;
    } else if (x + halfWidth > windowWidth - padding) {
      finalX = windowWidth - halfWidth - padding;
    }
    
    const windowHeight = window.innerHeight;
    const tooltipTopY = y - estimatedTooltipHeight - arrowHeight - spacing;
    
    if (tooltipTopY < padding) {
      position = 'bottom';
      finalY = y + elementHeight + arrowHeight + spacing;
      if (finalY + estimatedTooltipHeight > windowHeight - padding) {
        position = 'top';
        finalY = padding + estimatedTooltipHeight / 2;
      }
    } else {
      position = 'top';
    }
    
    return { x: finalX, y: finalY, position };
  };

  const handleCharacteristicMouseEnter = (characteristic, event) => {
    const hasDescription = characteristic && characteristic.revealed && 
      (characteristic.description || characteristic.experience);
    
    if (!hasDescription) {
      return;
    }

    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;

    let tooltipText = characteristic.description || characteristic.experience;
    if (tooltipText && tooltipText.length > 0) {
      const firstChar = tooltipText[0];
      if (firstChar && firstChar === firstChar.toLowerCase()) {
        tooltipText = firstChar.toUpperCase() + tooltipText.slice(1);
      }
    }

    const { x: finalX, y: finalY, position } = calculateTooltipPosition(x, y, rect.height, tooltipText);

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

  const handleCharacteristicMouseLeave = () => {
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
      descriptionTimeoutRef.current = null;
    }

    if (descriptionTooltip) {
      setDescriptionTooltip(prev => prev ? { ...prev, visible: false } : null);
      setTimeout(() => {
        setDescriptionTooltip(null);
      }, 300);
    }
  };

  const revealCharacteristic = (playerId, characteristicKey) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'reveal_characteristic',
        playerId: playerId,
        characteristicType: characteristicKey
      }));
    }
  };

  const handleActivateActionCard = (playerId, card) => {
    setActionCardModal({ playerId, card });
  };

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

  const toggleBanPlayer = (targetPlayerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'toggle_ban_player',
        playerId: targetPlayerId
      }));
    }
  };

  const handleSetTotalRounds = (rounds) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set_total_rounds',
        totalRounds: rounds
      }));
    }
  };

  const handleChangeRound = (round) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'change_round',
        round: round
      }));
    }
  };

  const handleTogglePlayerHighlight = (playerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'toggle_player_highlight',
        playerId: playerId
      }));
    }
  };

  const handleStartVotingSelection = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'start_voting_selection'
      }));
      setSelectedCandidates(new Set());
    }
  };

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

  const handleSetCandidates = () => {
    if (ws && ws.readyState === WebSocket.OPEN && selectedCandidates.size > 0) {
      ws.send(JSON.stringify({
        type: 'set_voting_candidates',
        candidates: Array.from(selectedCandidates)
      }));
    }
  };

  const handleConfirmVotingCandidates = () => {
    if (ws && ws.readyState === WebSocket.OPEN && selectedCandidates.size > 0) {
      ws.send(JSON.stringify({
        type: 'set_voting_candidates',
        candidates: Array.from(selectedCandidates)
      }));
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'confirm_voting_candidates'
        }));
      }, 100);
    }
  };

  const handleCancelVoting = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'cancel_voting'
      }));
    }
  };

  const handleVoteToKick = (targetPlayerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'vote_to_kick',
        targetPlayerId: targetPlayerId
      }));
    }
  };

  const handleSelectCandidateToKick = (playerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      toggleBanPlayer(playerId);
      setVotingResultsModal(null);
    }
  };

  useEffect(() => {
    if (selectedPlayerForAdmin) {
      const updatedPlayer = players.find(p => p.id === selectedPlayerForAdmin.id);
      if (updatedPlayer) {
        setSelectedPlayerForAdmin(updatedPlayer);
      }
    }
  }, [players, selectedPlayerForAdmin]);

  return (
    <div className="lobby-container">
      <DropdownMenu gameStartTime={gameStartTime} elapsedTime={gameStartTime ? elapsedTime : 0} />
      
      <div className="lobby-grid">
        {players.filter(p => p.role !== "host").map((player, index) => {
          const videoRef = (el) => {
                if (el && !videoRefs.current[player.id]) {
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