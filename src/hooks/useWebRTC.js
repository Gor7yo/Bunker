import { useState, useEffect, useRef } from 'react';

export const useWebRTC = (ws, playerId, players) => {
  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const peersRef = useRef({});
  const videoRefs = useRef({});
  const isInitialized = useRef(false);
  const streamLockRef = useRef(false);
  const pageHiddenRef = useRef(false);

  const getAdaptiveVideoParams = (peerCount, isHidden) => {
    // Mesh: total upstream ≈ per-sender bitrate × peers
    // Scale down as peers grow or when tab is hidden
    let maxBitrate = 800_000; // 800 kbps default
    let maxFramerate = 20;
    let scaleResolutionDownBy = 1;

    if (peerCount >= 3 && peerCount <= 4) {
      maxBitrate = 500_000;
      maxFramerate = 18;
    } else if (peerCount >= 5 && peerCount <= 6) {
      maxBitrate = 350_000;
      maxFramerate = 15;
      scaleResolutionDownBy = 1.25;
    } else if (peerCount >= 7) {
      maxBitrate = 250_000;
      maxFramerate = 12;
      scaleResolutionDownBy = 1.5;
    }

    if (isHidden) {
      // When tab is hidden, be extra conservative
      maxBitrate = Math.min(maxBitrate, 150_000);
      maxFramerate = Math.min(maxFramerate, 10);
      scaleResolutionDownBy = Math.max(scaleResolutionDownBy, 1.5);
    }

    return { maxBitrate, maxFramerate, scaleResolutionDownBy };
  };

  const applyParamsToAllVideoSenders = async () => {
    const peerIds = Object.keys(peersRef.current);
    const peerCount = peerIds.length;
    const { maxBitrate, maxFramerate, scaleResolutionDownBy } = getAdaptiveVideoParams(peerCount, pageHiddenRef.current);

    await Promise.all(peerIds.map(async (pid) => {
      const pc = peersRef.current[pid];
      if (!pc) return;
      const senders = pc.getSenders();
      await Promise.all(senders.map(async (sender) => {
        if (!sender.track || sender.track.kind !== 'video') return;
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings = [{
            maxBitrate,
            maxFramerate,
            scaleResolutionDownBy
          }];
          await sender.setParameters(params);
        } catch (e) {
          console.warn('Не удалось применить параметры видео к sender:', e);
        }
      }));
    }));
  };

  useEffect(() => {
    if (streamLockRef.current || !playerId) return;
    
    let mounted = true;
    let streamObtained = false;

    async function initCamera() {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!mounted) return;
        
        console.log("Запуск инициализации камеры");
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640, max: 960 }, 
            height: { ideal: 360, max: 540 },
            frameRate: { ideal: 20, max: 24 },
            aspectRatio: { ideal: 16/9 },
            facingMode: 'user'
          }
        });
        
        streamObtained = true;
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        console.log("Камера инициализирована, треки:", {
          video: stream.getVideoTracks().map(t => ({enabled: t.enabled, readyState: t.readyState}))
        });
        
        // Hint encoder for fast motion (camera)
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack && 'contentHint' in vTrack) {
          try { vTrack.contentHint = 'motion'; } catch (_) {}
        }

        streamLockRef.current = true;
        setLocalStream(stream);
        setIsCameraOn(true);
        
        if (videoRefs.current[playerId]) {
          const videoElement = videoRefs.current[playerId];
          videoElement.srcObject = stream;
          await videoElement.play().catch(err => {
            console.warn("Автоплей заблокирован:", err);
          });
        }
        
      } catch (err) {
        console.error("Ошибка доступа к камере:", err);
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
      if (!streamObtained) {
        streamLockRef.current = false;
      }
    };
  }, [playerId]);

  const createPeerConnection = async (remoteId) => {
    if (peersRef.current[remoteId]) {
      console.log(`Соединение с ${remoteId} уже существует`);
      return peersRef.current[remoteId];
    }

    console.log(`Создаем RTCPeerConnection для ${remoteId}`);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 2
    });

    if (localStream) {
      const tracks = localStream.getTracks();
      for (const track of tracks) {
        if (track.kind === 'audio') {
          continue;
        }
        
        console.log(`Добавляем локальный трек ${track.kind} для ${remoteId}`);
        const sender = pc.addTrack(track, localStream);
        
        if (track.kind === 'video') {
          try {
            const transceiver = pc.getTransceivers().find(t => t.sender === sender);
            if (transceiver && RTCRtpReceiver.getCapabilities) {
              const codecs = RTCRtpReceiver.getCapabilities('video').codecs;
              const vp8Codec = codecs.find(codec => codec.mimeType === 'video/VP8');
              if (vp8Codec) {
                transceiver.setCodecPreferences([vp8Codec]);
              }
            }
          } catch (e) {
            console.warn('Не удалось установить предпочтения кодека:', e);
          }
          
          setTimeout(async () => {
            const peerCount = Object.keys(peersRef.current).length;
            const { maxBitrate, maxFramerate, scaleResolutionDownBy } = getAdaptiveVideoParams(peerCount, pageHiddenRef.current);
            try {
              const params = sender.getParameters();
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              params.encodings = [{ maxBitrate, maxFramerate, scaleResolutionDownBy }];
              await sender.setParameters(params);
              console.log(`Параметры видео для ${remoteId}: ${(maxBitrate/1000)|0} кбит/с, ${maxFramerate} FPS, x${scaleResolutionDownBy}`);
            } catch (err) {
              console.warn('Не удалось установить параметры видео:', err);
            }
          }, 100);
        }
      }
    }

    pc.ontrack = (event) => {
      console.log(`Получен удаленный поток от ${remoteId}`, event.streams[0]);
      
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        
        const updateVideoElement = () => {
          if (videoRefs.current[remoteId]) {
            const videoElement = videoRefs.current[remoteId];
            
            const videoTracks = remoteStream.getVideoTracks();
            if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
              const videoOnlyStream = new MediaStream(videoTracks);
              
              if (videoElement.srcObject !== videoOnlyStream) {
                videoElement.srcObject = videoOnlyStream;
              }
              
              videoElement.playsInline = true;
              videoElement.muted = true;
              
              const remotePlayer = players.find(p => p.id === remoteId);
              if (remotePlayer && remotePlayer.mirrorCamera) {
                videoElement.style.transform = 'scaleX(-1)';
              } else {
                videoElement.style.transform = 'none';
              }
              
              if (videoElement.paused) {
                videoElement.play().catch(err => {
                  console.warn(`Автоплей заблокирован для ${remoteId}:`, err);
                });
              }
            }
          }
        };
        
        setTimeout(updateVideoElement, 100);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws) {
        console.log(`Отправляем ICE кандидат для ${remoteId}`);
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

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`${remoteId}: состояние ${state}`);
      
      if (state === 'failed' || state === 'disconnected') {
        console.warn(`Соединение с ${remoteId} потеряно, переподключаемся`);
        
        try {
          pc.close();
        } catch (e) {
          console.warn('Ошибка при закрытии соединения:', e);
        }
        
        delete peersRef.current[remoteId];
        
        setTimeout(async () => {
          if (localStream && ws && players.find(p => p.id === remoteId)) {
            console.log(`Переподключаемся к ${remoteId}`);
            await createPeerConnection(remoteId);
          }
        }, 3000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`${remoteId}: ICE состояние ${state}`);
      
      if (state === 'failed') {
        console.warn(`ICE соединение с ${remoteId} не удалось, перезапускаем`);
        try {
          pc.restartIce();
        } catch (e) {
          console.warn('Не удалось перезапустить ICE:', e);
        }
      }
    };

    if (remoteId > playerId) {
      console.log(`Инициируем offer для ${remoteId}`);
      
      const offerTimeout = setTimeout(async () => {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: true
          });
          
          try {
            await applyParamsToAllVideoSenders();
          } catch (e) {
            console.warn('Не удалось установить ограничения битрейта:', e);
          }
          
          await pc.setLocalDescription(offer);
          
          ws.send(JSON.stringify({
            type: "signal",
            targetId: remoteId,
            signal: offer
          }));
          
          console.log(`Offer отправлен для ${remoteId}`);
        } catch (error) {
          console.error(`Ошибка создания offer для ${remoteId}:`, error);
        }
      }, 500);
      
      pc._offerTimeout = offerTimeout;
    }

    peersRef.current[remoteId] = pc;
    return pc;
  };

  useEffect(() => {
    if (!ws || !localStream) {
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log("Обновление WebRTC соединений, игроков:", players.length);
      
      players.forEach(player => {
        if (player.id !== playerId && !peersRef.current[player.id]) {
          console.log(`Создаем соединение с ${player.name}`);
          createPeerConnection(player.id);
        }
      });

      Object.keys(peersRef.current).forEach(peerId => {
        if (!players.find(p => p.id === peerId)) {
          console.log(`Закрываем соединение с ${peerId}`);
          peersRef.current[peerId].close();
          delete peersRef.current[peerId];
          delete videoRefs.current[peerId];
        }
      });
      // Re-apply adaptive parameters after topology changes
      applyParamsToAllVideoSenders();
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [players, localStream, ws, playerId, createPeerConnection]);

  useEffect(() => {
    const onVisibilityChange = () => {
      pageHiddenRef.current = document.visibilityState === 'hidden';
      applyParamsToAllVideoSenders();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!ws) return;

    const handleSignal = async (data) => {
      if (data.type === "signal" && data.fromId && data.signal) {
        console.log(`Сигнал от ${data.fromId}: ${data.signal.type}`);
        
        let pc = peersRef.current[data.fromId];
        if (!pc) {
          console.log(`Создаем новое соединение для сигнала от ${data.fromId}`);
          pc = await createPeerConnection(data.fromId);
        }

        try {
          if (data.signal.type === "offer") {
            console.log(`Получен offer от ${data.fromId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            ws.send(JSON.stringify({
              type: "signal",
              targetId: data.fromId,
              signal: answer
            }));
            
            console.log(`Answer отправлен для ${data.fromId}`);
            
          } else if (data.signal.type === "answer") {
            console.log(`Получен answer от ${data.fromId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            
          } else if (data.signal.type === "ice-candidate" && data.signal.candidate) {
            console.log(`Получен ICE кандидат от ${data.fromId}`);
            await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
          }
        } catch (error) {
          console.error(`Ошибка обработки сигнала от ${data.fromId}:`, error);
        }
      }
    };

    window.__handleWebRTCSignal = handleSignal;

    return () => {
      delete window.__handleWebRTCSignal;
    };
  }, [ws, createPeerConnection]);

  const toggleCamera = () => {
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
      console.log(`Камера ${videoTrack.enabled ? 'включена' : 'выключена'}`);
    }
  };

  useEffect(() => {
    return () => {
      console.log("Очистка WebRTC соединений");
      Object.values(peersRef.current).forEach(pc => {
        if (pc && pc.connectionState !== 'closed') {
          pc.close();
        }
      });
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  return {
    localStream,
    isCameraOn,
    toggleCamera,
    peersRef,
    videoRefs,
    createPeerConnection
  };
};

