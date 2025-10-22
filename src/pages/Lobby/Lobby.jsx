// Lobby.js - исправленная версия
import React, { useState, useEffect, useRef } from "react";
import "./Lobby.css";

export const Lobby = ({ ws, playerId, players }) => {
  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const peersRef = useRef({});
  const videoRefs = useRef({});
  const isInitialized = useRef(false);
  const streamLockRef = useRef(false); // Защита от дублирования потоков

  // =========================
  // 📹 Инициализация локальной камеры (УПРОЩЕННАЯ)
  // =========================
  useEffect(() => {
    if (streamLockRef.current) return;
    streamLockRef.current = true;

    async function initCamera() {
      try {
        console.log("🎥 Запуск инициализации камеры...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        
        console.log("✅ Камера инициализирована, треки:", {
          video: stream.getVideoTracks().map(t => ({enabled: t.enabled, readyState: t.readyState})),
          audio: false
        });
        
        setLocalStream(stream);
        
        // Сразу подключаем к своему видео элементу
        if (videoRefs.current[playerId]) {
          const videoElement = videoRefs.current[playerId];
          videoElement.srcObject = stream;
          videoElement.muted = true;
          
          videoElement.play().catch(err => {
            console.warn("⚠️ Автоплей заблокирован, но поток подключен:", err);
          });
        }
        
      } catch (err) {
        console.error("❌ Ошибка доступа к камере/микрофону:", err);
        setIsCameraOn(false);
        streamLockRef.current = false;
      }
    }

    if (!isInitialized.current) {
      initCamera();
      isInitialized.current = true;
    }

    return () => {
      // Не останавливаем поток при размонтировании, только при полном выходе
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
  const createPeerConnection = (remoteId) => {
    if (peersRef.current[remoteId]) {
      console.log(`⚠️ Соединение с ${remoteId} уже существует`);
      return peersRef.current[remoteId];
    }

    console.log(`🎯 Создаем RTCPeerConnection для ${remoteId}`);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    // 🔥 ВАЖНО: Добавляем локальные треки
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`📤 Добавляем локальный трек ${track.kind} для ${remoteId}`);
        pc.addTrack(track, localStream);
      });
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
            
            videoElement.play().then(() => {
              console.log(`✅ Видео воспроизводится для ${remoteId}`);
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

    // 📊 Мониторинг состояния
    pc.onconnectionstatechange = () => {
      console.log(`🔗 ${remoteId}: состояние ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ${remoteId}: ICE состояние ${pc.iceConnectionState}`);
    };

    // 🚀 Инициируем соединение (только если наш ID больше)
    if (remoteId > playerId) {
      console.log(`🚀 Инициируем offer для ${remoteId}`);
      
      setTimeout(async () => {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: true
          });
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

        if (data.type === "signal" && data.fromId && data.signal) {
          console.log(`📡 Сигнал от ${data.fromId}: ${data.signal.type}`);
          
          let pc = peersRef.current[data.fromId];
          if (!pc) {
            console.log(`🔗 Создаем новое соединение для входящего сигнала от ${data.fromId}`);
            pc = createPeerConnection(data.fromId);
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
    };
  }, []);

  // =========================
  // 🎨 Рендер
  // =========================
  return (
    <div className="lobby-container">
      <div className="lobby-grid">
        {players.filter(p => p.role !== "host").map((player) => (
          <div key={player.id} className="player-video-card">
            <video
              ref={(el) => {
                if (el && !videoRefs.current[player.id]) {
                  console.log(`🎥 Создан видео элемент для ${player.id}`);
                  videoRefs.current[player.id] = el;
                  
                  // Если это локальный игрок и есть поток - сразу подключаем
                  if (player.id === playerId && localStream) {
                    el.srcObject = localStream;
                    el.muted = true;
                    el.play().catch(console.warn);
                  }
                }
              }}
              autoPlay
              playsInline
              muted={player.id === playerId}
              className="player-video"
            />
            <div className="player-info">
              <div className="player-name">{player.name}</div>
              <div className="player-status">
                {peersRef.current[player.id]?.connectionState === 'connected' ? '🟢' : '🟡'}
                {player.ready ? ' ✅' : ' ⏳'}
              </div>
            </div>
            
            {player.id === playerId && !isCameraOn && (
              <div className="camera-off-overlay">
                <div className="camera-off-text">Камера выключена</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="controls-panel">
        <button 
          onClick={toggleCamera}
          className={`control-btn ${isCameraOn ? 'active' : 'inactive'}`}
        >
          {isCameraOn ? "📹 Выкл" : "📹❌ Вкл"}
        </button>
        
        <div className="status-info">
          <span>Соединения: {Object.values(peersRef.current).filter(pc => pc.connectionState === 'connected').length}</span>
        </div>
      </div>
    </div>
  );
};