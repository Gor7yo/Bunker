// Lobby.js - исправленная версия
import React, { useState, useEffect, useRef, useContext } from "react";
import "./Lobby.css";
import { GameCharacteristics } from "../../components/GameCharacteristics/GameCharacteristics";
import { DataContext } from "../../context/DataContext";
import { FaBan } from "react-icons/fa6";
import { GiHolyGrail } from "react-icons/gi";
import { TbMicrophone2Off } from "react-icons/tb";
import { TbMicrophone2 } from "react-icons/tb";

export const Lobby = ({ ws, playerId, players }) => {
  const { mirrorCamera } = useContext(DataContext);
  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [selectedPlayerForAdmin, setSelectedPlayerForAdmin] = useState(null);
  const [actionCardModal, setActionCardModal] = useState(null); // {playerId, card}
  const [bannedPlayers, setBannedPlayers] = useState(new Set()); // Set из ID изгнанных игроков
  const [myCharacteristicsModal, setMyCharacteristicsModal] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [dropdownMenuOpen, setDropdownMenuOpen] = useState(true);
  const [descriptionTooltip, setDescriptionTooltip] = useState(null); // {text, x, y, position, visible}
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [showRoundAnimation, setShowRoundAnimation] = useState(false);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(null);
  const [votingActive, setVotingActive] = useState(false);
  const [votingPhase, setVotingPhase] = useState(null); // null | "selection" | "voting"
  const [votingCandidates, setVotingCandidates] = useState([]); // Массив ID кандидатов
  const [selectedCandidates, setSelectedCandidates] = useState(new Set()); // Выбранные кандидаты хоста для выставления
  const [votedPlayers, setVotedPlayers] = useState([]);
  const [votingResultsModal, setVotingResultsModal] = useState(null); // {candidates: [], allResults: []}
  const [votingHistory, setVotingHistory] = useState([]); // История голосований
  const [votingTabOpen, setVotingTabOpen] = useState(false); // Вкладка "Голосование"
  const [showVotingAnimation, setShowVotingAnimation] = useState(false); // Анимация "Голосование"
  const descriptionTimeoutRef = useRef(null);
  const roundAnimationTimeoutRef = useRef(null);
  const peersRef = useRef({});
  const videoRefs = useRef({});
  const isInitialized = useRef(false);
  const streamLockRef = useRef(false); // Защита от дублирования потоков

  // =========================
  // 📹 Инициализация локальной камеры (УПРОЩЕННАЯ)
  // =========================
  useEffect(() => {
    if (streamLockRef.current || !playerId) return;
    
    let mounted = true;
    let streamObtained = false;

    async function initCamera() {
      try {
        // Небольшая задержка, чтобы дать время MyCamera освободить камеру при переходе
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!mounted) return;
        
        console.log("🎥 Запуск инициализации камеры в Lobby...");
        
        // ⚡ ОПТИМИЗИРОВАННЫЕ НАСТРОЙКИ ДЛЯ 8 ИГРОКОВ: минимальное разрешение и FPS
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 480, max: 640 }, 
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 20, max: 24 }, // Снижаем до 20 fps для экономии ресурсов
            aspectRatio: { ideal: 4/3 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: { ideal: 16000 }, // Снижаем качество аудио для экономии трафика
            channelCount: { ideal: 1 }, // Моно вместо стерео
            bitrate: { ideal: 24000, max: 32000 } // Ограничиваем битрейт аудио
          }
        });
        
        streamObtained = true;
        
        if (!mounted) {
          // Если компонент размонтирован, останавливаем поток
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log("✅ Камера и микрофон инициализированы в Lobby, треки:", {
          video: stream.getVideoTracks().map(t => ({enabled: t.enabled, readyState: t.readyState})),
          audio: stream.getAudioTracks().map(t => ({enabled: t.enabled, readyState: t.readyState}))
        });
        
        streamLockRef.current = true;
        setLocalStream(stream);
        setIsCameraOn(true);
        
        // Сразу подключаем к своему видео элементу
        if (videoRefs.current[playerId]) {
          const videoElement = videoRefs.current[playerId];
          videoElement.srcObject = stream;
          // Не мутируем локальное видео, чтобы слышать свой звук (если нужно)
          
          await videoElement.play().catch(err => {
            console.warn("⚠️ Автоплей заблокирован, но поток подключен:", err);
          });
        }
        
      } catch (err) {
        console.error("❌ Ошибка доступа к камере в Lobby:", err);
        if (mounted) {
          setIsCameraOn(false);
          streamLockRef.current = false;
        }
      }
    }

    if (!isInitialized.current) {
      initCamera();
      isInitialized.current = true;
    }

    return () => {
      mounted = false;
      // Не останавливаем поток при размонтировании, только при полном выходе
      if (!streamObtained) {
        streamLockRef.current = false;
      }
    };
  }, [playerId]);

  // =========================
  // 🔄 Управление WebRTC соединениями (УПРОЩЕННОЕ)
  // =========================
  useEffect(() => {
    if (!ws || !localStream) {
      console.log("⏳ Ожидаем WebSocket и локальный поток...");
      return;
    }

    console.log("🔄 Обновление WebRTC соединений. Игроков:", players.length);
    
    // Создаем соединения с новыми игроками
    players.forEach(player => {
      if (player.id !== playerId && !peersRef.current[player.id]) {
        console.log(`🔗 Создаем соединение с ${player.name} (${player.id})`);
        createPeerConnection(player.id);
      }
    });

    // Удаляем старые соединения
    Object.keys(peersRef.current).forEach(peerId => {
      if (!players.find(p => p.id === peerId)) {
        console.log(`🗑️ Закрываем соединение с ${peerId}`);
        peersRef.current[peerId].close();
        delete peersRef.current[peerId];
        delete videoRefs.current[peerId];
      }
    });
  }, [players, localStream, ws, playerId]);

  // =========================
  // 🔗 Создание PeerConnection (ИСПРАВЛЕННОЕ)
  // =========================
  const createPeerConnection = async (remoteId) => {
    if (peersRef.current[remoteId]) {
      console.log(`⚠️ Соединение с ${remoteId} уже существует`);
      return peersRef.current[remoteId];
    }

    console.log(`🎯 Создаем RTCPeerConnection для ${remoteId}`);
    
    // ⚡ ОПТИМИЗАЦИЯ: настройка ICE серверов для 8 игроков
    // ВАЖНО: Для продакшена добавьте TURN сервер для работы за NAT/файрволом
    // Пример: { urls: 'turn:your-turn-server.com:3478', username: 'user', credential: 'pass' }
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
        // TODO: Добавьте TURN сервер для продакшена (см. WEBCAM_OPTIMIZATION_GUIDE.md)
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      // Оптимизация для множественных соединений
      iceCandidatePoolSize: 0 // Не предзагружаем кандидаты (экономия ресурсов)
    });

    // 🔥 Добавляем все треки (видео и аудио) с приоритизацией
    if (localStream) {
      // Используем for...of вместо forEach для поддержки async/await
      const tracks = localStream.getTracks();
      for (const track of tracks) {
        console.log(`📤 Добавляем локальный трек ${track.kind} для ${remoteId}`);
        const sender = pc.addTrack(track, localStream);
        
        // ⚡ ОПТИМИЗАЦИЯ ДЛЯ 8 ИГРОКОВ: Приоритизируем аудио, снижаем битрейт видео
        if (track.kind === 'audio') {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].priority = 'high';
          params.encodings[0].maxBitrate = 24000; // 24 kbps для аудио (было 32)
          try {
            await sender.setParameters(params);
          } catch (e) {
            console.warn('Не удалось установить параметры аудио:', e);
          }
        } else if (track.kind === 'video') {
          // Проверяем поддержку Simulcast для адаптивного качества
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          
          // Пытаемся включить Simulcast (3 уровня качества)
          try {
            params.encodings = [
              { rid: 'high', active: true, maxBitrate: 350000, scaleResolutionDownBy: 1, maxFramerate: 20 },
              { rid: 'medium', active: true, maxBitrate: 200000, scaleResolutionDownBy: 2, maxFramerate: 15 },
              { rid: 'low', active: true, maxBitrate: 100000, scaleResolutionDownBy: 4, maxFramerate: 10 }
            ];
            await sender.setParameters(params);
            console.log(`✅ Simulcast включен для ${remoteId}`);
          } catch (e) {
            // Если Simulcast не поддерживается, используем один поток с низким битрейтом
            console.log(`⚠️ Simulcast не поддерживается, используем один поток для ${remoteId}`);
            params.encodings = [{
              priority: 'low',
              maxBitrate: 300000, // 300 kbps максимум (было 500)
              maxFramerate: 20,
              scaleResolutionDownBy: 1
            }];
            try {
              await sender.setParameters(params);
            } catch (err) {
              console.warn('Не удалось установить параметры видео:', err);
            }
          }
        }
      }
    }

    // 📹 Обработка входящих потоков
    pc.ontrack = (event) => {
      console.log(`📹 Получен удаленный поток от ${remoteId}`, event.streams[0]);
      
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        
        // Создаем видео элемент если его нет
        if (!videoRefs.current[remoteId]) {
          console.log(`🎥 Создаем видео элемент для ${remoteId}`);
          // Элемент будет создан в render
        }
        
        // Ждем немного чтобы элемент успел создаться в DOM
        setTimeout(() => {
          if (videoRefs.current[remoteId]) {
            const videoElement = videoRefs.current[remoteId];
            
            videoElement.srcObject = remoteStream;
            videoElement.playsInline = true;
            // Звук включен для удаленных игроков
            
            // Применяем зеркалирование к удаленному видео, если оно включено у этого игрока
            // Находим информацию об игроке из списка players
            const remotePlayer = players.find(p => p.id === remoteId);
            if (remotePlayer && remotePlayer.mirrorCamera) {
              videoElement.style.transform = 'scaleX(-1)';
            }
            
            videoElement.play().then(() => {
              console.log(`✅ Видео и аудио воспроизводятся для ${remoteId}`);
            }).catch(err => {
              console.warn(`⚠️ Автоплей заблокирован для ${remoteId}:`, err);
            });
          }
        }, 100);
      }
    };

    // 🧊 ICE кандидаты
    pc.onicecandidate = (event) => {
      if (event.candidate && ws) {
        console.log(`🧊 Отправляем ICE кандидат для ${remoteId}`);
        ws.send(JSON.stringify({
          type: "signal",
          targetId: remoteId,
          signal: {
            type: "ice-candidate",
            candidate: event.candidate
          }
        }));
      }
    };

    // 📊 Мониторинг состояния с авто-переподключением
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`🔗 ${remoteId}: состояние ${state}`);
      
      // ⚡ ОПТИМИЗАЦИЯ: Автоматическое переподключение при потере соединения
      if (state === 'failed' || state === 'disconnected') {
        console.warn(`⚠️ Соединение с ${remoteId} потеряно, переподключаемся...`);
        
        // Закрываем старое соединение
        try {
          pc.close();
        } catch (e) {
          console.warn('Ошибка при закрытии соединения:', e);
        }
        
        delete peersRef.current[remoteId];
        
        // Переподключаемся через 3 секунды (увеличено для стабильности)
        setTimeout(async () => {
          if (localStream && ws && players.find(p => p.id === remoteId)) {
            console.log(`🔄 Переподключаемся к ${remoteId}...`);
            await createPeerConnection(remoteId);
          }
        }, 3000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`🧊 ${remoteId}: ICE состояние ${state}`);
      
      // ⚡ ОПТИМИЗАЦИЯ: Перезапуск ICE при неудаче
      if (state === 'failed') {
        console.warn(`⚠️ ICE соединение с ${remoteId} не удалось, перезапускаем ICE...`);
        try {
          pc.restartIce();
        } catch (e) {
          console.warn('Не удалось перезапустить ICE:', e);
        }
      }
    };

    // 🚀 Инициируем соединение (только если наш ID больше)
    if (remoteId > playerId) {
      console.log(`🚀 Инициируем offer для ${remoteId}`);
      
      setTimeout(async () => {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          // ⚡ ОПТИМИЗАЦИЯ ДЛЯ 8 ИГРОКОВ: Устанавливаем ограничения битрейта перед setLocalDescription
          try {
            const senders = pc.getSenders();
            for (const sender of senders) {
              if (sender.track) {
                if (sender.track.kind === 'video') {
                  const params = sender.getParameters();
                  // Пытаемся включить Simulcast
                  try {
                    params.encodings = [
                      { rid: 'high', active: true, maxBitrate: 350000, scaleResolutionDownBy: 1, maxFramerate: 20 },
                      { rid: 'medium', active: true, maxBitrate: 200000, scaleResolutionDownBy: 2, maxFramerate: 15 },
                      { rid: 'low', active: true, maxBitrate: 100000, scaleResolutionDownBy: 4, maxFramerate: 10 }
                    ];
                    await sender.setParameters(params);
                  } catch (e) {
                    // Fallback: один поток с низким битрейтом
                    if (!params.encodings || params.encodings.length === 0) {
                      params.encodings = [{}];
                    }
                    params.encodings[0].maxBitrate = 300000; // 300 kbps для видео (было 500)
                    params.encodings[0].maxFramerate = 20;
                    await sender.setParameters(params);
                  }
                } else if (sender.track.kind === 'audio') {
                  const params = sender.getParameters();
                  if (!params.encodings) params.encodings = [{}];
                  params.encodings[0].maxBitrate = 24000; // 24 kbps для аудио (было 32)
                  await sender.setParameters(params);
                }
              }
            }
          } catch (e) {
            console.warn('Не удалось установить ограничения битрейта:', e);
          }
          
          await pc.setLocalDescription(offer);
          
          ws.send(JSON.stringify({
            type: "signal",
            targetId: remoteId,
            signal: offer
          }));
          
          console.log(`📤 Offer отправлен для ${remoteId}`);
        } catch (error) {
          console.error(`❌ Ошибка создания offer для ${remoteId}:`, error);
        }
      }, 1000); // Небольшая задержка для стабильности
    }

    peersRef.current[remoteId] = pc;
    return pc;
  };

  // =========================
  // 📡 Обработка WebRTC сигналов (ИСПРАВЛЕННАЯ)
  // =========================
  useEffect(() => {
    if (!ws) return;

    const handleMessage = async (msg) => {
      try {
        const data = JSON.parse(msg.data);

        // Если нас кикнули — мгновенно перезагружаем страницу
        if (data.type === "kicked") {
          console.log("🚪 Вы были кикнуты администратором. Перезагрузка страницы...");
          window.location.reload();
          return;
        }

        if (data.type === "game_started") {
          console.log("🎮 Игра началась!");
        } else if (data.type === "game_reset") {
          console.log("🔄 Игра сброшена администратором");
          setGameStartTime(null);
          setElapsedTime(0);
          setCurrentRound(0);
          setHighlightedPlayerId(null); // Сбрасываем зеленую рамку при сбросе игры
        } else if (data.type === "round_changed") {
          console.log(`🔄 Раунд изменен на: ${data.round}`);
          setCurrentRound(data.round);
          setTotalRounds(data.totalRounds || totalRounds);
          // Показываем анимацию раунда
          console.log(`🎬 Показываем анимацию раунда ${data.round}`);
          setShowRoundAnimation(true);
          // Скрываем анимацию через 3.5 секунды
          if (roundAnimationTimeoutRef.current) {
            clearTimeout(roundAnimationTimeoutRef.current);
          }
          roundAnimationTimeoutRef.current = setTimeout(() => {
            console.log(`🎬 Скрываем анимацию раунда`);
            setShowRoundAnimation(false);
          }, 3500);
          // Сбрасываем зеленую рамку при смене раунда
          setHighlightedPlayerId(null);
          // Сбрасываем голосование при смене раунда
          setVotingActive(false);
          setVotingPhase(null);
          setVotingCandidates([]);
          setSelectedCandidates(new Set());
          setVotedPlayers([]);
          setShowVotingAnimation(false);
        } else if (data.type === "voting_started") {
          console.log("🗳️ Голосование началось");
          setVotingActive(true);
          setVotingPhase("voting");
          setVotingCandidates(data.candidates || []);
          setVotedPlayers([]);
          // Показываем анимацию "Голосование"
          setShowVotingAnimation(true);
          setTimeout(() => {
            setShowVotingAnimation(false);
          }, 3500);
        } else if (data.type === "voting_cancelled") {
          console.log("🗳️ Голосование отменено");
          setVotingActive(false);
          setVotingPhase(null);
          setVotingCandidates([]);
          setSelectedCandidates(new Set());
          setVotedPlayers([]);
          setShowVotingAnimation(false);
        } else if (data.type === "voting_completed") {
          console.log("🗳️ Голосование завершено:", data.candidates);
          setVotingActive(false);
          setVotingPhase(null);
          setVotingCandidates([]);
          setSelectedCandidates(new Set());
          setVotedPlayers([]);
          setShowVotingAnimation(false);
          // Показываем модальное окно с результатами хосту
          if (isHost && data.allResults) {
            setVotingResultsModal({
              candidates: data.candidates || [],
              allResults: data.allResults
            });
            // Добавляем в историю только один раз
            setVotingHistory(prev => {
              // Проверяем, нет ли уже такого голосования (по timestamp последнего)
              if (prev.length > 0 && prev[prev.length - 1].results.length === data.allResults.length) {
                // Сравниваем результаты - если одинаковые, не добавляем
                const lastResults = prev[prev.length - 1].results;
                const isDuplicate = lastResults.every((r, i) => 
                  r.id === data.allResults[i].id && r.votes === data.allResults[i].votes
                );
                if (isDuplicate) {
                  return prev;
                }
              }
              // Добавляем новое голосование в начало истории (сверху)
              return [{
                timestamp: Date.now(),
                results: data.allResults,
                candidates: data.candidates || []
              }, ...prev];
            });
          }
        } else if (data.type === "voting_results") {
          console.log("🗳️ Получены результаты голосования:", data.allResults);
          // Показываем модальное окно с результатами хосту (только если еще не показано)
          if (isHost && data.allResults && !votingResultsModal) {
            setVotingResultsModal({
              candidates: data.candidates || [],
              allResults: data.allResults
            });
            // Не добавляем в историю здесь, т.к. это дубликат voting_completed
          }
        } else if (data.type === "voting_tie") {
          console.log("🗳️ Ничья в голосовании, нужно выбрать:", data.candidates);
          // Показываем модальное окно, если еще не показано
          if (isHost && data.allResults && !votingResultsModal) {
            setVotingResultsModal({
              candidates: data.candidates,
              allResults: data.allResults
            });
          }
        } else if (data.type === "players_update") {
          // Обновляем время игры
          if (data.gameStartTime && data.gameStarted) {
            setGameStartTime(data.gameStartTime);
            setElapsedTime(data.gameElapsedTime || 0);
          } else if (!data.gameStarted) {
            setGameStartTime(null);
            setElapsedTime(0);
          }
          
          // Обновляем информацию о раундах
          if (data.currentRound !== undefined) {
            setCurrentRound(data.currentRound);
          }
          if (data.totalRounds !== undefined) {
            setTotalRounds(data.totalRounds);
          }
          
          // Обновляем информацию о выделенном игроке
          if (data.highlightedPlayerId !== undefined) {
            setHighlightedPlayerId(data.highlightedPlayerId);
          }
          
          // Обновляем информацию о голосовании
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
          
          // Применяем зеркалирование к видео элементам на основе данных игроков
          data.players?.forEach(playerData => {
            if (videoRefs.current[playerData.id]) {
              const videoElement = videoRefs.current[playerData.id];
              // Применяем зеркалирование только к удаленным игрокам (не к себе)
              if (playerData.id !== playerId && playerData.mirrorCamera) {
                videoElement.style.transform = 'scaleX(-1)';
              } else if (playerData.id !== playerId && !playerData.mirrorCamera) {
                videoElement.style.transform = 'none';
              }
            }
          });
        } else if (data.type === "characteristic_revealed") {
          console.log(`🎴 Характеристика раскрыта для игрока ${data.playerId}:`, data.characteristicType);
          // Игроки обновятся автоматически через props
        } else if (data.type === "player_banned") {
          console.log(`🚫 Игрок ${data.playerId} ${data.banned ? 'изгнан' : 'возвращен'}`);
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
          console.log(`📡 Сигнал от ${data.fromId}: ${data.signal.type}`);
          
          let pc = peersRef.current[data.fromId];
          if (!pc) {
            console.log(`🔗 Создаем новое соединение для входящего сигнала от ${data.fromId}`);
            pc = await createPeerConnection(data.fromId);
          }

          try {
            if (data.signal.type === "offer") {
              console.log(`📥 Получен offer от ${data.fromId}`);
              await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
              
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              
              ws.send(JSON.stringify({
                type: "signal",
                targetId: data.fromId,
                signal: answer
              }));
              
              console.log(`📤 Answer отправлен для ${data.fromId}`);
              
            } else if (data.signal.type === "answer") {
              console.log(`📥 Получен answer от ${data.fromId}`);
              await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
              
            } else if (data.signal.type === "ice-candidate" && data.signal.candidate) {
              console.log(`🧊 Получен ICE кандидат от ${data.fromId}`);
              await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            }
          } catch (error) {
            console.error(`❌ Ошибка обработки сигнала от ${data.fromId}:`, error);
          }
        }
      } catch (error) {
        console.error("❌ Ошибка парсинга сообщения:", error);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, localStream]);

  // =========================
  // 🎛️ Управление камерой
  // =========================
  const toggleCamera = () => {
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
      console.log(`📹 Камера ${videoTrack.enabled ? 'включена' : 'выключена'}`);
    }
  };

  // =========================
  // ⏱️ Таймер игры
  // =========================
  useEffect(() => {
    if (!gameStartTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - gameStartTime;
      setElapsedTime(elapsed);
    }, 1000); // Обновляем каждую секунду

    return () => clearInterval(interval);
  }, [gameStartTime]);

  // =========================
  // 🔄 Применение зеркалирования к локальному видео
  // =========================
  useEffect(() => {
    if (videoRefs.current[playerId]) {
      const localVideo = videoRefs.current[playerId];
      // Применяем зеркалирование только если оно включено в настройках
      if (mirrorCamera) {
        localVideo.style.transform = 'scaleX(-1)';
      } else {
        localVideo.style.transform = 'none';
      }
    }
  }, [mirrorCamera, playerId]);

  // =========================
  // 🔄 Применение зеркалирования ко всем видео элементам при изменении players
  // =========================
  useEffect(() => {
    players.forEach(player => {
      if (videoRefs.current[player.id]) {
        const videoElement = videoRefs.current[player.id];
        // Для локального игрока используем настройки из контекста
        if (player.id === playerId) {
          if (mirrorCamera) {
            videoElement.style.transform = 'scaleX(-1)';
          } else {
            videoElement.style.transform = 'none';
          }
        } else {
          // Для удаленных игроков используем данные от сервера
          if (player.mirrorCamera) {
            videoElement.style.transform = 'scaleX(-1)';
          } else {
            videoElement.style.transform = 'none';
          }
        }
      }
    });
  }, [players, mirrorCamera, playerId]);

  // =========================
  // 🧹 Очистка
  // =========================
  useEffect(() => {
    return () => {
      console.log("🧹 Очистка WebRTC соединений");
      Object.values(peersRef.current).forEach(pc => {
        if (pc && pc.connectionState !== 'closed') {
          pc.close();
        }
      });
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // Очищаем таймер тултипа при размонтировании
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
      
      // Очищаем таймер анимации раунда
      if (roundAnimationTimeoutRef.current) {
        clearTimeout(roundAnimationTimeoutRef.current);
      }
    };
  }, []);

  // Функция для форматирования времени
  const formatTime = (ms) => {
    if (!ms || ms === 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

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
  const toggleBanPlayer = (playerId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'toggle_ban_player',
        playerId: playerId
      }));
    }
  };

  const isHost = players.find(p => p.id === playerId)?.role === "host";

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
      {/* Таймер игры */}
      {gameStartTime && (
        <div className="game-timer">
          <span className="timer-icon">⏱️</span>
          <span className="timer-text">{formatTime(elapsedTime)}</span>
        </div>
      )}

      {/* Выдвижное меню */}
      {gameStartTime && (
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
      )}
      
      <div className="lobby-grid">
        {players.filter(p => p.role !== "host").map((player, index) => (
          <div 
            key={player.id} 
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
              ref={(el) => {
                if (el && !videoRefs.current[player.id]) {
                  console.log(`🎥 Создан видео элемент для ${player.id}`);
                  videoRefs.current[player.id] = el;
                  
                  // Если это локальный игрок и есть поток - сразу подключаем
                  if (player.id === playerId && localStream) {
                    el.srcObject = localStream;
                    el.muted = true; // Мутим локальное видео, чтобы игрок не слышал сам себя
                    el.play().catch(console.warn);
                  }
                  
                  // Применяем зеркалирование, если оно включено у этого игрока
                  if (player.mirrorCamera) {
                    el.style.transform = 'scaleX(-1)';
                  }
                }
              }}
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
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.proffesion, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
                  >
                    {player.characteristics.proffesion?.revealed ? (
                      <span className="characteristic-value">{player.characteristics.proffesion.value}</span>
                    ) : (
                      <span className="characteristic-label characteristic-profession">Профессия</span>
                    )}
                  </div>
                  <div 
                    className="characteristic-item characteristic-health"
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.health, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
                  >
                    {player.characteristics.health?.revealed ? (
                      <span className="characteristic-value">{player.characteristics.health.value}</span>
                    ) : (
                      <span className="characteristic-label characteristic-health">Здоровье</span>
                    )}
                  </div>
                  <div 
                    className="characteristic-item characteristic-hobby"
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.hobbie, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
                  >
                    {player.characteristics.hobbie?.revealed ? (
                      <span className="characteristic-value">{player.characteristics.hobbie.value}</span>
                    ) : (
                      <span className="characteristic-label characteristic-hobby">Хобби</span>
                    )}
                  </div>
                  <div 
                    className="characteristic-item characteristic-phobia"
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.fobia, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
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
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.bandage, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
                  >
                    {player.characteristics.bandage?.revealed ? (
                      <span className="characteristic-value">{player.characteristics.bandage.value}</span>
                    ) : (
                      <span className="characteristic-label characteristic-baggage">Багаж</span>
                    )}
                  </div>
                  <div 
                    className="characteristic-item characteristic-fact"
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.fact, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
                  >
                    {player.characteristics.fact?.revealed ? (
                      <span className="characteristic-value">{player.characteristics.fact.value}</span>
                    ) : (
                      <span className="characteristic-label characteristic-fact">Факт</span>
                    )}
                  </div>
                  <div 
                    className="characteristic-item characteristic-age"
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.age, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
                  >
                    {player.characteristics.age?.revealed ? (
                      <span className="characteristic-value">{player.characteristics.age.value}</span>
                    ) : (
                      <span className="characteristic-label">Возраст</span>
                    )}
                  </div>
                  <div 
                    className="characteristic-item characteristic-action"
                    onMouseEnter={(e) => handleCharacteristicMouseEnter(player.characteristics.actions, e)}
                    onMouseLeave={handleCharacteristicMouseLeave}
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
                onClick={() => toggleBanPlayer(player.id)}
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
            
            {player.id === playerId && !isCameraOn && (
              <div className="camera-off-overlay">
                <div className="camera-off-text">Камера выключена</div>
              </div>
            )}

            {/* Зеленая кнопка выделения (только для хоста) */}
            {isHost && !bannedPlayers.has(player.id) && (
              <button
                className={`highlight-btn ${highlightedPlayerId === player.id ? 'active' : ''}`}
                onClick={() => handleTogglePlayerHighlight(player.id)}
                title={highlightedPlayerId === player.id ? 'Снять выделение' : 'Выделить игрока'}
              >
                {highlightedPlayerId === player.id ?  <TbMicrophone2Off className="highlight-btn-icon" /> : <TbMicrophone2 className="highlight-btn-icon" />}
              </button>
            )}

            {/* Кнопка выставить на голосование (для всех игроков, кроме себя и хоста, только во время голосования, если игрок не изгнан и является кандидатом) */}
            {votingActive && player.id !== playerId && !isHost && !bannedPlayers.has(player.id) && !bannedPlayers.has(playerId) && votingCandidates.includes(player.id) && (
              <button
                className={`vote-kick-btn ${votedPlayers.includes(playerId) ? 'disabled' : ''}`}
                onClick={() => handleVoteToKick(player.id)}
                disabled={votedPlayers.includes(playerId)}
                title={votedPlayers.includes(playerId) ? 'Вы уже проголосовали' : 'Выставить на вылет'}
              >
                🚪
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Модальное окно результатов голосования */}
      {votingResultsModal && votingResultsModal.allResults && (
        <div className="voting-results-modal-overlay" onClick={() => setVotingResultsModal(null)}>
          <div className="voting-results-modal" onClick={(e) => e.stopPropagation()}>
            <div className="voting-results-header">
              <h2>🗳️ Результаты голосования</h2>
              <button 
                className="close-btn"
                onClick={() => setVotingResultsModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="voting-results-content">
              {/* Полные результаты всех игроков */}
              <div className="all-voting-results">
                <h4>Результаты по всем игрокам:</h4>
                <div className="results-list">
                  {votingResultsModal.allResults.map((result) => (
                    <div 
                      key={result.id} 
                      className={`result-item ${votingResultsModal.candidates.some(c => c.id === result.id) ? 'candidate-highlight' : ''}`}
                    >
                      <span className="result-name">{result.name}</span>
                      <span className="result-votes">{result.votes} голос(ов)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Если несколько кандидатов с одинаковым количеством голосов */}
              {votingResultsModal.candidates && votingResultsModal.candidates.length > 1 && (
                <div className="candidates-selection">
                  <p className="tie-message">Несколько игроков получили одинаковое количество голосов. Выберите, кого исключить:</p>
                  <div className="candidates-list">
                    {votingResultsModal.candidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        className="candidate-btn"
                        onClick={() => handleSelectCandidateToKick(candidate.id)}
                      >
                        <span className="candidate-name">{candidate.name}</span>
                        <span className="candidate-votes">{candidate.votes} голос(ов)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Если один кандидат - автоматически изгнан */}
              {votingResultsModal.candidates && votingResultsModal.candidates.length === 1 && (
                <div className="single-candidate-info">
                  <p className="candidate-message">
                    Игрок <strong>{votingResultsModal.candidates[0].name}</strong> получил наибольшее количество голосов и был исключен из игры.
                  </p>
                </div>
              )}

              {/* Если нет кандидатов */}
              {(!votingResultsModal.candidates || votingResultsModal.candidates.length === 0) && (
                <div className="no-candidates-info">
                  <p>Никто не получил голосов.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Тултип с описанием характеристики */}
      {descriptionTooltip && (
        <div 
          className={`description-tooltip ${descriptionTooltip.visible ? 'visible' : ''} ${descriptionTooltip.position === 'bottom' ? 'tooltip-bottom' : ''}`}
          style={{
            left: `${descriptionTooltip.x}px`,
            top: descriptionTooltip.position === 'bottom' 
              ? `${descriptionTooltip.y + 10}px` 
              : `${descriptionTooltip.y - 10}px`,
            transform: descriptionTooltip.position === 'bottom' 
              ? 'translate(-50%, 0%)' 
              : 'translate(-50%, -100%)'
          }}
        >
          <div className="tooltip-content">
            {descriptionTooltip.text}
          </div>
          <div className={`tooltip-arrow ${descriptionTooltip.position === 'bottom' ? 'arrow-bottom' : ''}`}></div>
        </div>
      )}

      <div className="controls-panel">
        <button 
          onClick={toggleCamera}
          className={`control-btn ${isCameraOn ? 'active' : 'inactive'}`}
        >
          {isCameraOn ? "📹 Выкл" : "📹❌ Вкл"}
        </button>
        
        {/* Кнопка для просмотра своих характеристик (только для игроков) */}
        {!isHost && (
          <button 
            onClick={() => setMyCharacteristicsModal(true)}
            className="control-btn my-characteristics-btn"
          >
            🎴 Мои карты
          </button>
        )}
        
        {/* Кнопка для админа */}
        {isHost && (
          <button 
            onClick={() => setIsAdminModalOpen(true)}
            className="control-btn admin-btn"
          >
            Управление карточками
          </button>
        )}
        
        {/* Кнопка выхода (для всех) */}
        <button 
          onClick={() => window.location.reload()}
          className="control-btn exit-btn"
          title="Выйти"
        >
          Выйти
        </button>

        <div className="status-info">
          <span>Соединения: {Object.values(peersRef.current).filter(pc => pc.connectionState === 'connected').length}</span>
        </div>
      </div>

      {/* Компонент для работы с характеристиками игроков */}
      {/* <GameCharacteristics 
        ws={ws}
        players={players}
        playerId={playerId}
        isHost={players.find(p => p.id === playerId)?.role === "host"}
      /> */}

      {/* Анимация раунда - всегда поверх всего */}
      {showRoundAnimation && currentRound > 0 && (
        <div className="round-animation">
          <div className="round-text">Раунд {currentRound}</div>
        </div>
      )}

      {/* Анимация начала голосования */}
      {showVotingAnimation && (
        <div className="round-animation">
          <div className="round-text voting-text">Голосование</div>
        </div>
      )}

      {/* Модальное окно для админа */}
      {isAdminModalOpen && (
        <div className="admin-modal-overlay" onClick={() => {
          setIsAdminModalOpen(false);
          setEventsModalOpen(false);
        }}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Управление игрой</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  setIsAdminModalOpen(false);
                  setEventsModalOpen(false);
                  setVotingTabOpen(false);
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Вкладки */}
            <div className="admin-modal-tabs">
              <button 
                className={`admin-tab ${!eventsModalOpen && !votingTabOpen ? 'active' : ''}`}
                onClick={() => {
                  setEventsModalOpen(false);
                  setVotingTabOpen(false);
                }}
              >
                Карточки игроков
              </button>
              <button 
                className={`admin-tab ${eventsModalOpen && !votingTabOpen ? 'active' : ''}`}
                onClick={() => {
                  setEventsModalOpen(true);
                  setVotingTabOpen(false);
                }}
              >
                Ивенты
              </button>
              <button 
                className={`admin-tab ${votingTabOpen ? 'active' : ''}`}
                onClick={() => {
                  setEventsModalOpen(false);
                  setVotingTabOpen(true);
                }}
              >
                Голосование
              </button>
            </div>

            {/* Содержимое вкладки "Карточки игроков" */}
            {!eventsModalOpen && !votingTabOpen && (
              <div className="admin-players-list">
              {players.filter(p => p.role !== 'host').map(player => (
                <div key={player.id} className="admin-player-card">
                  <div className="admin-player-info">
                    <h3>{player.name}</h3>
                  </div>
                  
                  <div className="admin-player-actions">
                    <button 
                      className="view-btn"
                      onClick={() => setSelectedPlayerForAdmin(player)}
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              ))}
              </div>
            )}

            {/* Содержимое вкладки "Ивенты" */}
            {eventsModalOpen && (
              <div className="events-tab-content">
                <div className="rounds-control-section">
                  <h3>🎯 Управление раундами</h3>
                  
                  <div className="rounds-config">
                    <label htmlFor="total-rounds">Количество раундов:</label>
                    <input
                      id="total-rounds"
                      type="number"
                      min="1"
                      max="20"
                      value={totalRounds}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        setTotalRounds(value);
                        handleSetTotalRounds(value);
                      }}
                      className="rounds-input"
                    />
                  </div>

                  <div className="current-round-info">
                    <p>Текущий раунд: <span className="round-number">{currentRound || 0}</span> / {totalRounds}</p>
                  </div>

                  <div className="rounds-buttons">
                    <h4>Переключить раунд:</h4>
                    <div className="round-buttons-grid">
                      {Array.from({ length: totalRounds }, (_, i) => i + 1).map((round) => (
                        <button
                          key={round}
                          className={`round-btn ${currentRound === round ? 'active' : ''}`}
                          onClick={() => handleChangeRound(round)}
                          disabled={currentRound === round}
                        >
                          {round}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Содержимое вкладки "Голосование" */}
            {votingTabOpen && (
              <div className="voting-tab-content">
                <div className="voting-control-section">
                  <h3>🗳️ Голосование на вылет</h3>
                  {votingPhase === null ? (
                    <div className="voting-control">
                      <p>Начните процесс голосования: сначала выберите кандидатов, затем запустите голосование.</p>
                      <button
                        className="start-voting-btn"
                        onClick={handleStartVotingSelection}
                        disabled={!gameStartTime || !isHost}
                      >
                        Начать выбор кандидатов
                      </button>
                    </div>
                  ) : votingPhase === "selection" ? (
                    <div className="voting-selection-section">
                      <h4>Выберите кандидатов для голосования:</h4>
                      <div className="candidates-selection-list">
                        {players
                          .filter(p => p.role !== "host" && !bannedPlayers.has(p.id))
                          .map(player => (
                            <label key={player.id} className="candidate-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedCandidates.has(player.id)}
                                onChange={() => handleToggleCandidate(player.id)}
                              />
                              <span>{player.name}</span>
                            </label>
                          ))}
                      </div>
                      <div className="candidates-actions">
                        <button
                          className="confirm-candidates-btn"
                          onClick={handleConfirmVotingCandidates}
                          disabled={selectedCandidates.size === 0}
                        >
                          Подтвердить и начать голосование ({selectedCandidates.size})
                        </button>
                        <button
                          className="cancel-voting-btn"
                          onClick={handleCancelVoting}
                          title="Отменить"
                        >
                          Отменить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="voting-status">
                      <p className="voting-active-text">🗳️ Голосование активно</p>
                      <p className="voting-info">Игроки выбирают из кандидатов, кого исключить из игры</p>
                      <div className="voting-candidates-list">
                        <p>Кандидаты:</p>
                        <ul>
                          {votingCandidates.map(candidateId => {
                            const candidate = players.find(p => p.id === candidateId);
                            return candidate ? <li key={candidateId}>{candidate.name}</li> : null;
                          })}
                        </ul>
                      </div>
                      {isHost && (
                        <button
                          className="cancel-voting-btn"
                          onClick={handleCancelVoting}
                          title="Отменить голосование"
                        >
                          Отменить голосование
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* История голосований */}
                {votingHistory.length > 0 && (
                  <div className="voting-history-section">
                    <h3>📋 История голосований</h3>
                    <div className="voting-history-list">
                      {votingHistory.map((entry, index) => {
                        const date = new Date(entry.timestamp);
                        const timeString = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div key={index} className="voting-history-item">
                            <div className="voting-history-header">
                              <span className="voting-history-time">Голосование #{index + 1} - {timeString}</span>
                            </div>
                            <div className="voting-history-results">
                              {entry.results.map((result, resultIndex) => (
                                <div key={resultIndex} className={`voting-history-result ${entry.candidates.some(c => c.id === result.id) ? 'candidate' : ''}`}>
                                  <span className="result-name">{result.name}</span>
                                  <span className="result-votes">{result.votes} голос(ов)</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно просмотра карточек игрока */}
      {selectedPlayerForAdmin && (
        <div className="player-cards-modal-overlay">
          <div className="player-cards-modal">
            <div className="player-cards-header">
              <h2>Карточки игрока: {selectedPlayerForAdmin.name}</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedPlayerForAdmin(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="player-cards-grid">
              {selectedPlayerForAdmin.characteristics && Object.entries(selectedPlayerForAdmin.characteristics).map(([key, characteristic]) => (
                <div key={key} className={`admin-characteristic-card ${key} ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
                  <div className="characteristic-header">
                    <h4>{getCategoryName(key)}</h4>
                    <span className={`status ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
                      {characteristic.revealed ? '✅ Раскрыто' : '❌ Скрыто'}
                    </span>
                  </div>
                  <div className="characteristic-content">
                    <p><strong>Значение:</strong> {characteristic.value}</p>
                    {!characteristic.revealed && (
                      <button 
                        className="reveal-btn"
                        onClick={() => revealCharacteristic(selectedPlayerForAdmin.id, key)}
                      >
                        🔓 Раскрыть
                      </button>
                    )}
                    {/* Кнопка активации карты действия */}
                    {key === 'actions' && characteristic.revealed && (
                      <button 
                        className="activate-action-btn"
                        onClick={() => handleActivateActionCard(selectedPlayerForAdmin.id, characteristic)}
                      >
                        ⚡ Активировать
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для активации карты действия */}
      {actionCardModal && (
        <ActionCardModal
          card={actionCardModal.card}
          players={players}
          onExecute={(actionType, parameters) => executeActionCard(actionType, parameters)}
          onClose={() => setActionCardModal(null)}
        />
      )}

      {/* Модальное окно для просмотра своих характеристик */}
      {myCharacteristicsModal && (
        <div className="my-characteristics-modal-overlay" onClick={() => setMyCharacteristicsModal(false)}>
          <div className="my-characteristics-modal" onClick={(e) => e.stopPropagation()}>
            <div className="my-characteristics-header">
              <h2>Мои характеристики</h2>
              <button className="close-btn" onClick={() => setMyCharacteristicsModal(false)}>
                ✕
              </button>
            </div>
            
            <div className="my-characteristics-grid">
              {players.find(p => p.id === playerId)?.characteristics && Object.entries(players.find(p => p.id === playerId).characteristics).map(([key, characteristic]) => (
                <div key={key} className={`my-characteristic-card ${key} ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
                  <div className="characteristic-header">
                    <h4>{getCategoryName(key)}</h4>
                    <span className={`status ${characteristic.revealed ? 'revealed' : 'hidden'}`}>
                      {characteristic.revealed ? '✅ Раскрыто' : '❌ Скрыто'}
                    </span>
                  </div>
                  <div className="characteristic-content">
                    <h3>{characteristic.value}</h3>
                    {characteristic.description && (
                      <p className="characteristic-description"><em>{characteristic.description}</em></p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Компонент модального окна для карт действий
const ActionCardModal = ({ card, players, onExecute, onClose }) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [selectedCharacteristics, setSelectedCharacteristics] = useState(null);
  
  const handleSubmit = () => {
    // Логика в зависимости от типа карты
    const cardName = card.value;
    
    // Вызываем базовую функцию выполнения
    onExecute(cardName, {
      selectedPlayers,
      selectedCharacteristics
    });
  };

  const renderCardUI = () => {
    const cardName = card.value;
    
    // Карты, требующие выбора одного игрока
    if (card.description.includes("выбери одного игрока") || 
        card.description.includes("Выбери одного игрока")) {
      return (
        <div>
          <p className="card-description">{card.description}</p>
          <div className="player-selection">
            <h4>Выберите игрока:</h4>
            <select 
              value={selectedPlayers[0] || ""} 
              onChange={(e) => setSelectedPlayers([e.target.value])}
              className="player-select"
            >
              <option value="">-- Выберите игрока --</option>
              {players.filter(p => p.role !== 'host').map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    // Карты, требующие выбора двух игроков
    if (card.description.includes("выбери двух игроков")) {
      return (
        <div>
          <p className="card-description">{card.description}</p>
          <div className="player-selection">
            <h4>Выберите двух игроков:</h4>
            <select 
              value={selectedPlayers[0] || ""} 
              onChange={(e) => setSelectedPlayers([e.target.value, selectedPlayers[1]])}
              className="player-select"
            >
              <option value="">-- Игрок 1 --</option>
              {players.filter(p => p.role !== 'host').map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
            <select 
              value={selectedPlayers[1] || ""} 
              onChange={(e) => setSelectedPlayers([selectedPlayers[0], e.target.value])}
              className="player-select"
            >
              <option value="">-- Игрок 2 --</option>
              {players.filter(p => p.role !== 'host').map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    // Карты без дополнительных параметров (просто подтверждение)
    return (
      <div>
        <p className="card-description">{card.description}</p>
        <p className="card-warning">Вы уверены, что хотите активировать эту карту?</p>
      </div>
    );
  };

  return (
    <div className="action-card-modal-overlay" onClick={onClose}>
      <div className="action-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="action-card-header">
          <h2>❗Карта действия: {card.value}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="action-card-content">
          {renderCardUI()}
        </div>

        <div className="action-card-actions">
          <button className="cancel-btn" onClick={onClose}>Отмена</button>
          <button className="execute-btn" onClick={handleSubmit}>Выполнить</button>
        </div>
      </div>
    </div>
  );
};