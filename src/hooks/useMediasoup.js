import { useState, useEffect, useRef, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';

export const useMediasoup = (ws, playerId, players) => {
  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const videoRefs = useRef({});
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({});
  const consumersRef = useRef(new Map());
  const isInitializedRef = useRef(false);
  const playersRef = useRef([]);

  useEffect(() => {
    playersRef.current = players || [];
  }, [players]);

  // Инициализация устройства mediasoup
  const initDevice = useCallback(async (rtpCapabilities) => {
    try {
      deviceRef.current = new mediasoupClient.Device();
      await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities });
      console.log('✅ Mediasoup device инициализирован');
      return true;
    } catch (error) {
      console.error('❌ Ошибка инициализации device:', error);
      return false;
    }
  }, []);

  // Создание транспорта
  const createTransport = useCallback(async (direction, transportData) => {
    try {
      const transport = sendTransportRef.current || recvTransportRef.current;
      
      if (direction === 'send') {
        sendTransportRef.current = deviceRef.current.createSendTransport({
          id: transportData.id,
          iceParameters: transportData.iceParameters,
          iceCandidates: transportData.iceCandidates,
          dtlsParameters: transportData.dtlsParameters,
          sctpParameters: transportData.sctpParameters,
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });

        sendTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            ws.send(JSON.stringify({
              type: 'connect_transport',
              transportId: sendTransportRef.current.id,
              dtlsParameters,
              direction: 'send',
            }));
            callback();
          } catch (error) {
            errback(error);
          }
        });

        sendTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            const producePromise = new Promise((resolve, reject) => {
              const messageHandler = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'produced') {
                  ws.removeEventListener('message', messageHandler);
                  resolve(data.producerData);
                } else if (data.type === 'error' && data.message.includes('produce')) {
                  ws.removeEventListener('message', messageHandler);
                  reject(new Error(data.message));
                }
              };
              ws.addEventListener('message', messageHandler);
              
              // Отправляем запрос
              ws.send(JSON.stringify({
                type: 'produce',
                transportId: sendTransportRef.current.id,
                kind,
                rtpParameters,
              }));
            });

            const producerData = await producePromise;
            callback({ id: producerData.id });
          } catch (error) {
            errback(error);
          }
        });

        return sendTransportRef.current;
      } else {
        recvTransportRef.current = deviceRef.current.createRecvTransport({
          id: transportData.id,
          iceParameters: transportData.iceParameters,
          iceCandidates: transportData.iceCandidates,
          dtlsParameters: transportData.dtlsParameters,
          sctpParameters: transportData.sctpParameters,
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });

        recvTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            ws.send(JSON.stringify({
              type: 'connect_transport',
              transportId: recvTransportRef.current.id,
              dtlsParameters,
              direction: 'recv',
            }));
            callback();
          } catch (error) {
            errback(error);
          }
        });

        return recvTransportRef.current;
      }
    } catch (error) {
      console.error(`❌ Ошибка создания транспорта (${direction}):`, error);
      throw error;
    }
  }, [ws]);

  // Получить локальный поток
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setLocalStream(stream);
      setIsCameraOn(true);
      return stream;
    } catch (error) {
      console.error('❌ Ошибка получения локального потока:', error);
      setIsCameraOn(false);
      return null;
    }
  }, []);

  // Отправить медиа (produce)
  const produceMedia = useCallback(async (kind) => {
    if (!sendTransportRef.current || !localStream) {
      console.warn('⚠️ Transport или stream не готовы');
      return;
    }

    try {
      let track;
      if (kind === 'video') {
        track = localStream.getVideoTracks()[0];
      } else {
        track = localStream.getAudioTracks()[0];
      }

      if (!track) {
        console.warn(`⚠️ Трек ${kind} не найден`);
        return;
      }

      const producer = await sendTransportRef.current.produce({
        track,
        codecOptions: {
          videoGoogleStartBitrate: 1000000,
        },
      });

      producersRef.current[kind] = producer;

      producer.on('transportclose', () => {
        console.log(`📹 Producer закрыт: ${kind}`);
        delete producersRef.current[kind];
      });

      console.log(`📹 Producer создан: ${kind}`);
      return producer;
    } catch (error) {
      console.error(`❌ Ошибка создания producer (${kind}):`, error);
      throw error;
    }
  }, [localStream]);

  // Создать consumer для получения медиа
  const consumeMedia = useCallback(async (producerId) => {
    if (!recvTransportRef.current || !deviceRef.current) {
      console.warn('⚠️ Recv transport или device не готовы');
      return;
    }

    try {
      // Ждем ответа от сервера
      return new Promise((resolve, reject) => {
        const messageHandler = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'consumed') {
            ws.removeEventListener('message', messageHandler);
            const { consumerData } = data;
            
            recvTransportRef.current.consume({
              id: consumerData.id,
              producerId: consumerData.producerId,
              kind: consumerData.kind,
              rtpParameters: consumerData.rtpParameters,
            }).then((consumer) => {
              consumersRef.current.set(producerId, consumer);
              
              // Получаем трек
              const { track } = consumer;
              
              // Создаем video элемент если его нет
              if (!videoRefs.current[producerId]) {
                const video = document.createElement('video');
                video.autoplay = true;
                video.playsInline = true;
                video.srcObject = new MediaStream([track]);
                videoRefs.current[producerId] = video;
              } else {
                const video = videoRefs.current[producerId];
                const stream = new MediaStream([track]);
                video.srcObject = stream;
              }

              // Resume consumer
              ws.send(JSON.stringify({
                type: 'resume_consumer',
                consumerId: consumer.id,
              }));

              console.log(`📺 Consumer создан: ${producerId}`);
              resolve(consumer);
            }).catch(reject);
          } else if (data.type === 'error' && data.message.includes('consume')) {
            ws.removeEventListener('message', messageHandler);
            reject(new Error(data.message));
          }
        };
        
        ws.addEventListener('message', messageHandler);
        
        // Отправляем запрос
        ws.send(JSON.stringify({
          type: 'consume',
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        }));
      });
    } catch (error) {
      console.error(`❌ Ошибка создания consumer:`, error);
      throw error;
    }
  }, [ws]);

  // Инициализация mediasoup
  useEffect(() => {
    if (!ws || !playerId || isInitializedRef.current) return;

    const initializeMediasoup = async () => {
      try {
        // 1. Получаем RTP capabilities
        ws.send(JSON.stringify({ type: 'get_router_rtp_capabilities' }));

        const rtpCapabilities = await new Promise((resolve, reject) => {
          const originalOnMessage = ws.onmessage;
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'router_rtp_capabilities') {
              resolve(data.rtpCapabilities);
              ws.onmessage = originalOnMessage;
            } else if (data.type === 'error') {
              reject(new Error(data.message));
              ws.onmessage = originalOnMessage;
            } else {
              originalOnMessage(event);
            }
          };
        });

        // 2. Инициализируем device
        const deviceReady = await initDevice(rtpCapabilities);
        if (!deviceReady) return;

        // 3. Создаем send transport
        ws.send(JSON.stringify({ type: 'create_transport', direction: 'send' }));
        const sendTransportData = await new Promise((resolve, reject) => {
          const originalOnMessage = ws.onmessage;
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'transport_created' && data.direction === 'send') {
              resolve(data.transportData);
              ws.onmessage = originalOnMessage;
            } else if (data.type === 'error') {
              reject(new Error(data.message));
              ws.onmessage = originalOnMessage;
            } else {
              originalOnMessage(event);
            }
          };
        });
        await createTransport('send', sendTransportData);

        // 4. Создаем recv transport
        ws.send(JSON.stringify({ type: 'create_transport', direction: 'recv' }));
        const recvTransportData = await new Promise((resolve, reject) => {
          const originalOnMessage = ws.onmessage;
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'transport_created' && data.direction === 'recv') {
              resolve(data.transportData);
              ws.onmessage = originalOnMessage;
            } else if (data.type === 'error') {
              reject(new Error(data.message));
              ws.onmessage = originalOnMessage;
            } else {
              originalOnMessage(event);
            }
          };
        });
        await createTransport('recv', recvTransportData);

        // 5. Получаем локальный поток и отправляем
        const stream = await getLocalStream();
        if (stream) {
          await produceMedia('video');
          await produceMedia('audio');
        }

        isInitializedRef.current = true;
        console.log('✅ Mediasoup инициализирован');
      } catch (error) {
        console.error('❌ Ошибка инициализации mediasoup:', error);
      }
    };

    if (ws.readyState === WebSocket.OPEN) {
      initializeMediasoup();
    } else {
      ws.addEventListener('open', initializeMediasoup);
    }
  }, [ws, playerId, initDevice, createTransport, getLocalStream, produceMedia]);

  // Обработка новых producers от других игроков
  useEffect(() => {
    if (!ws || !deviceRef.current) return;

    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_producer') {
        const { playerId: producerPlayerId, producerId, kind } = data;
        
        // Создаем consumer для нового producer
        if (producerPlayerId !== playerId) {
          consumeMedia(producerId).catch(error => {
            console.error('❌ Ошибка создания consumer:', error);
          });
        }
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws, playerId, consumeMedia]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      // Закрываем producers
      Object.values(producersRef.current).forEach(producer => {
        if (producer && !producer.closed) {
          producer.close();
        }
      });

      // Закрываем consumers
      consumersRef.current.forEach(consumer => {
        if (consumer && !consumer.closed) {
          consumer.close();
        }
      });

      // Закрываем transports
      if (sendTransportRef.current && !sendTransportRef.current.closed) {
        sendTransportRef.current.close();
      }
      if (recvTransportRef.current && !recvTransportRef.current.closed) {
        recvTransportRef.current.close();
      }

      // Останавливаем локальный поток
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, [localStream]);

  return {
    localStream,
    isCameraOn,
    toggleCamera,
    videoRefs,
  };
};
