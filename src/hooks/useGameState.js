import { useState, useEffect, useRef } from "react";

export const useGameState = (ws, isHost, playerId, totalRounds) => {
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedPlayerForAdmin, setSelectedPlayerForAdmin] = useState(null);
  const [actionCardModal, setActionCardModal] = useState(null);
  const [bannedPlayers, setBannedPlayers] = useState(new Set());
  const [myCharacteristicsModal, setMyCharacteristicsModal] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [descriptionTooltip, setDescriptionTooltip] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRoundsState, setTotalRoundsState] = useState(totalRounds);
  const [showRoundAnimation, setShowRoundAnimation] = useState(false);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(null);
  const [votingActive, setVotingActive] = useState(false);
  const [votingPhase, setVotingPhase] = useState(null);
  const [votingCandidates, setVotingCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState(new Set());
  const [votedPlayers, setVotedPlayers] = useState([]);
  const [votingResultsModal, setVotingResultsModal] = useState(null);
  const [votingHistory, setVotingHistory] = useState([]);
  const [votingTabOpen, setVotingTabOpen] = useState(false);
  const [showVotingAnimation, setShowVotingAnimation] = useState(false);
  
  const descriptionTimeoutRef = useRef(null);
  const roundAnimationTimeoutRef = useRef(null);

  useEffect(() => {
    setTotalRoundsState(totalRounds);
  }, [totalRounds]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = async (msg) => {
      try {
        const data = JSON.parse(msg.data);

        if (data.type === "kicked") {
          console.log("Вы были кикнуты администратором");
          window.location.reload();
          return;
        }

        if (data.type === "game_started") {
          console.log("Игра началась");
        } else if (data.type === "game_ready") {
          console.log("Игра готова");
        } else if (data.type === "game_reset") {
          console.log("Игра сброшена администратором");
          setGameStartTime(null);
          setElapsedTime(0);
          setCurrentRound(0);
          setHighlightedPlayerId(null);
        } else if (data.type === "round_changed") {
          console.log(`Раунд изменен на: ${data.round}`);
          setCurrentRound(data.round);
          setTotalRoundsState(data.totalRounds || totalRoundsState);
          setShowRoundAnimation(true);
          if (roundAnimationTimeoutRef.current) {
            clearTimeout(roundAnimationTimeoutRef.current);
          }
          roundAnimationTimeoutRef.current = setTimeout(() => {
            setShowRoundAnimation(false);
          }, 3500);
          setHighlightedPlayerId(null);
          setVotingActive(false);
          setVotingPhase(null);
          setVotingCandidates([]);
          setSelectedCandidates(new Set());
          setVotedPlayers([]);
          setShowVotingAnimation(false);
        } else if (data.type === "voting_started") {
          console.log("Голосование началось");
          setVotingActive(true);
          setVotingPhase("voting");
          setVotingCandidates(data.candidates || []);
          setVotedPlayers([]);
          setShowVotingAnimation(true);
          setTimeout(() => {
            setShowVotingAnimation(false);
          }, 3500);
        } else if (data.type === "voting_cancelled") {
          console.log("Голосование отменено");
          setVotingActive(false);
          setVotingPhase(null);
          setVotingCandidates([]);
          setSelectedCandidates(new Set());
          setVotedPlayers([]);
          setShowVotingAnimation(false);
        } else if (data.type === "voting_completed") {
          console.log("Голосование завершено:", data.candidates);
          setVotingActive(false);
          setVotingPhase(null);
          setVotingCandidates([]);
          setSelectedCandidates(new Set());
          setVotedPlayers([]);
          setShowVotingAnimation(false);
          if (isHost && data.allResults) {
            setVotingResultsModal({
              candidates: data.candidates || [],
              allResults: data.allResults
            });
            setVotingHistory(prev => {
              if (prev.length > 0 && prev[prev.length - 1].results.length === data.allResults.length) {
                const lastResults = prev[prev.length - 1].results;
                const isDuplicate = lastResults.every((r, i) => 
                  r.id === data.allResults[i].id && r.votes === data.allResults[i].votes
                );
                if (isDuplicate) {
                  return prev;
                }
              }
              return [{
                timestamp: Date.now(),
                results: data.allResults,
                candidates: data.candidates || []
              }, ...prev];
            });
          }
        } else if (data.type === "voting_results") {
          console.log("Получены результаты голосования:", data.allResults);
          if (isHost && data.allResults && !votingResultsModal) {
            setVotingResultsModal({
              candidates: data.candidates || [],
              allResults: data.allResults
            });
          }
        } else if (data.type === "voting_tie") {
          console.log("Ничья в голосовании, нужно выбрать:", data.candidates);
          if (isHost && data.allResults && !votingResultsModal) {
            setVotingResultsModal({
              candidates: data.candidates,
              allResults: data.allResults
            });
          }
        } else if (data.type === "players_update") {
          if (data.gameStartTime && data.gameStarted) {
            setGameStartTime(data.gameStartTime);
            setElapsedTime(data.gameElapsedTime || 0);
          } else if (!data.gameStarted) {
            setGameStartTime(null);
            setElapsedTime(0);
          }
          
          if (data.currentRound !== undefined) {
            setCurrentRound(data.currentRound);
          }
          if (data.totalRounds !== undefined) {
            setTotalRoundsState(data.totalRounds);
          }
          
          if (data.highlightedPlayerId !== undefined) {
            setHighlightedPlayerId(data.highlightedPlayerId);
          }
          
          if (data.votingActive !== undefined) {
            setVotingActive(data.votingActive);
          }
          if (data.votingPhase !== undefined) {
            setVotingPhase(data.votingPhase);
          }
          if (data.votingCandidates !== undefined) {
            setVotingCandidates(data.votingCandidates);
          }
          if (data.votedPlayers !== undefined) {
            setVotedPlayers(data.votedPlayers);
          }
          
        } else if (data.type === "characteristic_revealed") {
          console.log(`Характеристика раскрыта для игрока ${data.playerId}:`, data.characteristicType);
        } else if (data.type === "player_banned") {
          console.log(`Игрок ${data.playerId} ${data.banned ? 'изгнан' : 'возвращен'}`);
          setBannedPlayers(prev => {
            const newSet = new Set(prev);
            if (data.banned) {
              newSet.add(data.playerId);
            } else {
              newSet.delete(data.playerId);
            }
            return newSet;
          });
        } else if (data.type === "signal" && data.fromId && data.signal) {
          if (window.__handleWebRTCSignal) {
            await window.__handleWebRTCSignal(data);
          }
        }
      } catch (error) {
        console.error("Ошибка парсинга сообщения:", error);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
      if (roundAnimationTimeoutRef.current) {
        clearTimeout(roundAnimationTimeoutRef.current);
      }
    };
  }, [ws, isHost, totalRoundsState]);

  useEffect(() => {
    if (!gameStartTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - gameStartTime;
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStartTime]);

  return {
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
    totalRounds: totalRoundsState,
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
  };
};

