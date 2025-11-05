import { useState, useEffect, useRef, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';

export const useMediasoup = (ws, playerId, players, roomId = 'default') => {
  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producerRef = useRef(null);
  const consumersRef = useRef(new Map()); // producerId -> consumer
  const videoRefs = useRef({});
  const isInitialized = useRef(false);
  const streamLockRef = useRef(false);
  const pageHiddenRef = useRef(false);
  const playersRef = useRef([]);

  useEffect(() => {
    playersRef.current = players || [];
  }, [players]);

  useEffect(() => {
    const onVisibilityChange = () => {
      pageHiddenRef.current = document.visibilityState === 'hidden';
      if (producerRef.current && pageHiddenRef.current) {
        // При скрытой вкладке - паузим producer для экономии
        producerRef.current.pause();
      } else if (producerRef.current && !pageHiddenRef.current) {
        producerRef.current.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Инициализация камеры
  useEffect(() => {
    if (streamLockRef.current || !playerId || !ws) return;
    
    let mounted = true;
    let streamObtained = false;

    async function initCamera() {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!mounted) return;
        
        console.log("Запуск инициализации камеры (SFU)");
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640, max: 640 }, 
            height: { ideal: 360, max: 360 },
            frameRate: { ideal: 24, max: 24 },
            aspectRatio: { ideal: 16/9 },
            facingMode: 'user'
          }
        });
        
        streamObtained = true;
        
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        // Hint encoder
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

        // Инициализируем Mediasoup после получения потока
        await initMediasoup(stream);
        
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
  }, [playerId, ws, roomId]);

  // Инициализация Mediasoup
  const initMediasoup = useCallback(async (stream) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket не подключен");
      return;
    }

    try {
      // 1. Создаем device
      const response = await sendRequest(ws, {
        type: 'getRouterRtpCapabilities',
        roomId
      });

      if (response.error) {
        throw new Error(response.error);
      }

      deviceRef.current = new mediasoupClient.Device();
      await deviceRef.current.load({ routerRtpCapabilities: response.rtpCapabilities });

      console.log("✅ Mediasoup device инициализирован");

      // 2. Создаем send transport
      const sendTransportResponse = await sendRequest(ws, {
        type: 'createTransport',
        roomId,
        direction: 'send'
      });

      sendTransportRef.current = deviceRef.current.createSendTransport({
        id: sendTransportResponse.id,
        iceParameters: sendTransportResponse.iceParameters,
        iceCandidates: sendTransportResponse.iceCandidates,
        dtlsParameters: sendTransportResponse.dtlsParameters,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await sendRequest(ws, {
            type: 'connectTransport',
            roomId,
            direction: 'send',
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const response = await sendRequest(ws, {
            type: 'createProducer',
            roomId,
            kind,
            rtpParameters
          });
          callback({ id: response.id });
        } catch (error) {
          errback(error);
        }
      });

      // 3. Создаем recv transport
      const recvTransportResponse = await sendRequest(ws, {
        type: 'createTransport',
        roomId,
        direction: 'recv'
      });

      recvTransportRef.current = deviceRef.current.createRecvTransport({
        id: recvTransportResponse.id,
        iceParameters: recvTransportResponse.iceParameters,
        iceCandidates: recvTransportResponse.iceCandidates,
        dtlsParameters: recvTransportResponse.dtlsParameters,
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await sendRequest(ws, {
            type: 'connectTransport',
            roomId,
            direction: 'recv',
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      // 4. Создаем producer (отправка видео)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        producerRef.current = await sendTransportRef.current.produce({
          track: videoTrack,
          encodings: [{
            maxBitrate: 800_000, // 0.8 Mbps для SFU
            maxFramerate: 24,
            scaleResolutionDownBy: 1
          }],
          codecOptions: {
            videoGoogleStartBitrate: 800
          }
        });

        console.log("✅ Producer создан:", producerRef.current.id);
      }

      // 5. Подписываемся на существующие producers
      const existingProducersResponse = await sendRequest(ws, {
        type: 'getExistingProducers',
        roomId
      });

      if (existingProducersResponse.producers) {
        for (const producerInfo of existingProducersResponse.producers) {
          await createConsumer(producerInfo.producerId, producerInfo.playerId);
        }
      }

    } catch (error) {
      console.error("❌ Ошибка инициализации Mediasoup:", error);
    }
  }, [ws, roomId]);

  // Создание consumer для получения видео от другого игрока
  const createConsumer = useCallback(async (producerId, remotePlayerId) => {
    if (!deviceRef.current || !recvTransportRef.current) {
      console.warn("Device или recv transport не готовы");
      return;
    }

    try {
      const response = await sendRequest(ws, {
        type: 'createConsumer',
        roomId,
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities
      });

      const consumer = await recvTransportRef.current.consume({
        id: response.id,
        producerId: response.producerId,
        kind: response.kind,
        rtpParameters: response.rtpParameters
      });

      consumersRef.current.set(producerId, consumer);

      // Обновляем video элемент
      if (videoRefs.current[remotePlayerId]) {
        const videoElement = videoRefs.current[remotePlayerId];
        const stream = new MediaStream([consumer.track]);
        videoElement.srcObject = stream;
        videoElement.playsInline = true;
        videoElement.muted = true;
        
        const remotePlayer = playersRef.current.find(p => p.id === remotePlayerId);
        if (remotePlayer && remotePlayer.mirrorCamera) {
          videoElement.style.transform = 'scaleX(-1)';
        } else {
          videoElement.style.transform = 'none';
        }
        
        await videoElement.play().catch(err => {
          console.warn(`Автоплей заблокирован для ${remotePlayerId}:`, err);
        });
      }

      // Отправляем сигнал о том, что consumer готов
      await sendRequest(ws, {
        type: 'resumeConsumer',
        roomId,
        consumerId: consumer.id
      });

      console.log(`✅ Consumer создан для producer ${producerId}`);
    } catch (error) {
      console.error(`❌ Ошибка создания consumer для ${producerId}:`, error);
    }
  }, [ws, roomId]);

  // Обработка новых producers от других игроков
  useEffect(() => {
    if (!ws) return;

    const handleNewProducer = async (data) => {
      if (data.type === 'newProducer' && data.playerId !== playerId) {
        await createConsumer(data.producerId, data.playerId);
      }
    };

    const originalHandler = window.__handleWebRTCSignal;
    window.__handleWebRTCSignal = async (data) => {
      if (data.type === 'newProducer') {
        await handleNewProducer(data);
      } else if (originalHandler) {
        originalHandler(data);
      }
    };

    return () => {
      window.__handleWebRTCSignal = originalHandler;
    };
  }, [ws, playerId, createConsumer]);

  // Вспомогательная функция для отправки запросов
  const sendRequest = (ws, data) => {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString() + Math.random().toString(36).slice(2);
      
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 10000);

      const handler = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.requestId === requestId) {
            clearTimeout(timeout);
            ws.removeEventListener('message', handler);
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          }
        } catch (e) {
          // Игнорируем не JSON сообщения
        }
      };

      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ ...data, requestId }));
    });
  };

  const toggleCamera = () => {
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
      console.log(`Камера ${videoTrack.enabled ? 'включена' : 'выключена'}`);
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      console.log("Очистка Mediasoup соединений");
      
      if (producerRef.current) {
        producerRef.current.close();
      }
      
      consumersRef.current.forEach(consumer => consumer.close());
      consumersRef.current.clear();
      
      if (sendTransportRef.current) {
        sendTransportRef.current.close();
      }
      
      if (recvTransportRef.current) {
        recvTransportRef.current.close();
      }
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  return {
    localStream,
    isCameraOn,
    toggleCamera,
    videoRefs,
    peersRef: { current: {} } // Для совместимости с существующим кодом
  };
};

