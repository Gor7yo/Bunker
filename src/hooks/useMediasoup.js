import { useState, useEffect, useRef, useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';

export const useMediasoup = (ws, playerId, players, gameStarted = false) => {
  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [permissionError, setPermissionError] = useState(null); // Ошибка разрешений
  const videoRefs = useRef({});
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef({});
  const consumersRef = useRef(new Map());
  const isInitializedRef = useRef(false);
  const gameStartedRef = useRef(false); // Флаг что игра началась
  const playersRef = useRef([]);

  useEffect(() => {
    playersRef.current = players || [];
    
    // Проверяем наличие характеристик у игроков - это признак что игра началась
    const hasCharacteristics = players && players.some(p => p.characteristics && Object.keys(p.characteristics).length > 0);
    if (hasCharacteristics && !gameStartedRef.current) {
      console.log('🎮 Обнаружены характеристики у игроков - игра началась');
      gameStartedRef.current = true;
    }
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
      // Проверяем доступность mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia не поддерживается в этом браузере');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      setLocalStream(stream);
      setIsCameraOn(true);
      setPermissionError(null); // Очищаем ошибку при успехе
      console.log('✅ Доступ к камере получен');
      return stream;
    } catch (error) {
      console.error('❌ Ошибка получения локального потока:', error);
      setIsCameraOn(false);
      
      // Показываем понятное сообщение пользователю
      let errorMessage = 'Не удалось получить доступ к камере';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Разрешение на доступ к камере отклонено. Нажмите кнопку "Разрешить доступ" для повторного запроса.';
        setPermissionError('NotAllowedError'); // Устанавливаем ошибку для показа кнопки
        console.warn('💡 Подсказка: Проверьте настройки разрешений браузера для камеры');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = '⚠️ Камера не найдена. Убедитесь, что устройство подключено.';
        setPermissionError('NotFoundError');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = '⚠️ Камера уже используется другим приложением.';
        setPermissionError('NotReadableError');
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        errorMessage = '⚠️ Запрошенные настройки камеры не поддерживаются.';
        setPermissionError('OverconstrainedError');
      } else {
        setPermissionError('UnknownError');
      }
      
      // Не показываем alert - покажем кнопку вместо этого
      return null;
    }
  }, []);

  // Отправить медиа (produce) - только видео
  const produceMedia = useCallback(async (kind) => {
    if (!sendTransportRef.current || !localStream) {
      console.warn('⚠️ Transport или stream не готовы');
      return;
    }

    // Поддерживаем только видео
    if (kind !== 'video') {
      console.warn(`⚠️ Аудио не поддерживается. Пропускаем ${kind}`);
      return;
    }

    try {
      const track = localStream.getVideoTracks()[0];

      if (!track) {
        console.warn(`⚠️ Видео трек не найден`);
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
              // Игнорируем аудио consumers
              if (consumer.kind === 'audio') {
                console.warn(`⚠️ Получен аудио consumer для ${producerId} - игнорируем`);
                resolve(null);
                return;
              }

              consumersRef.current.set(producerId, consumer);
              
              // Получаем трек
              const { track } = consumer;
              
              // Создаем video элемент если его нет
              if (!videoRefs.current[producerId]) {
                const video = document.createElement('video');
                video.autoplay = true;
                video.playsInline = true;
                video.muted = true; // Обязательно отключаем звук
                video.srcObject = new MediaStream([track]);
                videoRefs.current[producerId] = video;
              } else {
                const video = videoRefs.current[producerId];
                video.muted = true; // Обязательно отключаем звук
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

  // Подписка на game_started и players_update ДО инициализации (только для установки флага)
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Проверяем game_started - только устанавливаем флаг, НЕ запрашиваем медиа
        if (data.type === 'game_started') {
          console.log('🎮 Получено сообщение game_started (ранняя подписка)');
          gameStartedRef.current = true;
          console.log('✅ Флаг gameStartedRef установлен в true');
          // НЕ запрашиваем медиа автоматически - только по клику пользователя
        }
        
        // Также проверяем players_update - там может быть gameStarted
        if (data.type === 'players_update' && data.gameStarted) {
          console.log('🎮 Обнаружено gameStarted в players_update');
          if (!gameStartedRef.current) {
            gameStartedRef.current = true;
            console.log('✅ Флаг gameStartedRef установлен в true из players_update');
            // НЕ запрашиваем медиа автоматически - только по клику пользователя
          }
        }
      } catch (error) {
        // Игнорируем ошибки парсинга
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws]);

  // Инициализация mediasoup
  useEffect(() => {
    if (!ws || !playerId || isInitializedRef.current) return;
    
    // Проверяем, что WebSocket открыт и игрок зарегистрирован
    if (ws.readyState !== WebSocket.OPEN) {
      console.log('⏳ Ожидание открытия WebSocket...');
      return;
    }

    const initializeMediasoup = async () => {
      try {
        // 1. Получаем RTP capabilities
        const rtpCapabilities = await Promise.race([
          new Promise((resolve, reject) => {
            const messageHandler = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.type === 'router_rtp_capabilities') {
                  ws.removeEventListener('message', messageHandler);
                  clearTimeout(timeoutId);
                  resolve(data.rtpCapabilities);
                } else if (data.type === 'error') {
                  ws.removeEventListener('message', messageHandler);
                  clearTimeout(timeoutId);
                  reject(new Error(data.message));
                }
              } catch (err) {
                // Игнорируем ошибки парсинга других сообщений
              }
            };
            ws.addEventListener('message', messageHandler);
            
            const timeoutId = setTimeout(() => {
              ws.removeEventListener('message', messageHandler);
              reject(new Error('Timeout waiting for router_rtp_capabilities'));
            }, 10000);
            
            // Отправляем запрос
            ws.send(JSON.stringify({ type: 'get_router_rtp_capabilities' }));
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        // 2. Инициализируем device
        const deviceReady = await initDevice(rtpCapabilities);
        if (!deviceReady) return;

        // 3. Создаем send transport
        const sendTransportData = await Promise.race([
          new Promise((resolve, reject) => {
            const messageHandler = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.type === 'transport_created' && data.direction === 'send') {
                  ws.removeEventListener('message', messageHandler);
                  clearTimeout(timeoutId);
                  resolve(data.transportData);
                } else if (data.type === 'error') {
                  ws.removeEventListener('message', messageHandler);
                  clearTimeout(timeoutId);
                  reject(new Error(data.message));
                }
              } catch (err) {
                // Игнорируем ошибки парсинга других сообщений
              }
            };
            ws.addEventListener('message', messageHandler);
            
            const timeoutId = setTimeout(() => {
              ws.removeEventListener('message', messageHandler);
              reject(new Error('Timeout waiting for transport_created'));
            }, 10000);
            
            // Отправляем запрос
            ws.send(JSON.stringify({ type: 'create_transport', direction: 'send' }));
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        await createTransport('send', sendTransportData);

        // 4. Создаем recv transport
        const recvTransportData = await Promise.race([
          new Promise((resolve, reject) => {
            const messageHandler = (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.type === 'transport_created' && data.direction === 'recv') {
                  ws.removeEventListener('message', messageHandler);
                  clearTimeout(timeoutId);
                  resolve(data.transportData);
                } else if (data.type === 'error') {
                  ws.removeEventListener('message', messageHandler);
                  clearTimeout(timeoutId);
                  reject(new Error(data.message));
                }
              } catch (err) {
                // Игнорируем ошибки парсинга других сообщений
              }
            };
            ws.addEventListener('message', messageHandler);
            
            const timeoutId = setTimeout(() => {
              ws.removeEventListener('message', messageHandler);
              reject(new Error('Timeout waiting for transport_created'));
            }, 10000);
            
            // Отправляем запрос
            ws.send(JSON.stringify({ type: 'create_transport', direction: 'recv' }));
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        await createTransport('recv', recvTransportData);

        // 5. Если игра уже началась, запрашиваем медиа сразу
        // getUserMedia требует user interaction, но к моменту начала игры пользователь уже взаимодействовал
        isInitializedRef.current = true;
        console.log('✅ Mediasoup инициализирован (готов к запросу медиа)');
        console.log('🔍 Проверка: gameStartedRef.current =', gameStartedRef.current);
        console.log('🔍 Проверка: gameStarted prop =', gameStarted);
        console.log('🔍 Проверка: localStream =', localStream);
        
        // Проверяем все источники: ref, prop, и наличие характеристик
        const hasCharacteristics = players && players.some(p => p.characteristics && Object.keys(p.characteristics).length > 0);
        const shouldRequestMedia = gameStartedRef.current || gameStarted || hasCharacteristics;
        
        console.log('🔍 Финальная проверка перед запросом медиа:', {
          gameStartedRef: gameStartedRef.current,
          gameStartedProp: gameStarted,
          hasCharacteristics,
          playersCount: players?.length,
          playersWithChars: players?.filter(p => p.characteristics && Object.keys(p.characteristics).length > 0).length,
          shouldRequestMedia,
          localStream: !!localStream,
          sendTransportReady: !!sendTransportRef.current
        });
        
        // НЕ запрашиваем медиа автоматически - только по клику пользователя
        // Браузер требует явного user interaction для getUserMedia
        if (hasCharacteristics && !localStream && sendTransportRef.current) {
          console.log('💡 Игра началась, но медиа не запрошено. Нажмите кнопку "Разрешить доступ к камере" для активации.');
          setPermissionError('NotAllowedError'); // Показываем кнопку
        } else {
          console.log('⏳ Игра еще не началась или transport не готов');
        }
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

  // Отслеживаем изменение gameStarted prop, players или запрашиваем медиа
  useEffect(() => {
    // Проверяем все индикаторы начала игры
    const hasCharacteristics = players && players.some(p => p.characteristics && Object.keys(p.characteristics).length > 0);
    const playersWithChars = players ? players.filter(p => p.characteristics && Object.keys(p.characteristics).length > 0) : [];
    
    console.log('🔍 Проверка начала игры (useEffect):', {
      gameStarted,
      hasCharacteristics,
      playersCount: players?.length,
      playersWithCharsCount: playersWithChars.length,
      playersWithChars: playersWithChars.map(p => ({ id: p.id, name: p.name, charsCount: Object.keys(p.characteristics || {}).length })),
      isInitialized: isInitializedRef.current,
      hasTransport: !!sendTransportRef.current,
      hasStream: !!localStream
    });
    
    // НЕ запрашиваем медиа автоматически - только по клику пользователя
    const shouldShowButton = (gameStarted || hasCharacteristics) && isInitializedRef.current && sendTransportRef.current && !localStream;
    
    if (shouldShowButton && !permissionError) {
      console.log('💡 Игра началась, но медиа не запрошено. Нажмите кнопку для активации.');
      setPermissionError('NotAllowedError'); // Показываем кнопку запроса разрешений
    }
  }, [gameStarted, players, localStream, getLocalStream, produceMedia]);

  // Отслеживаем game_started только для установки флага, НЕ запрашиваем медиа автоматически
  useEffect(() => {
    if (!ws) return;

    const handleGameStarted = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'game_started') {
          console.log('🎮 Получено сообщение game_started');
          gameStartedRef.current = true; // Сохраняем флаг
          // НЕ запрашиваем медиа автоматически - только по клику пользователя
        }
      } catch (error) {
        // Игнорируем ошибки парсинга других сообщений
      }
    };

    ws.addEventListener('message', handleGameStarted);
    return () => {
      ws.removeEventListener('message', handleGameStarted);
    };
  }, [ws]);

  // Обработка новых producers от других игроков
  useEffect(() => {
    if (!ws || !deviceRef.current) return;

    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'new_producer') {
        const { playerId: producerPlayerId, producerId, kind } = data;
        
        // Создаем consumer только для видео producers
        if (producerPlayerId !== playerId && kind === 'video') {
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
    } else {
      // Если потока нет, попробуем запросить разрешения заново
      console.log('💡 Поток не найден, запрашиваем разрешения...');
      getLocalStream().then(async (stream) => {
        if (stream && sendTransportRef.current) {
          // Отправляем видео если transport готов
          try {
            await produceMedia('video');
          } catch (error) {
            console.error('❌ Ошибка отправки медиа после получения потока:', error);
          }
        }
      });
    }
  }, [localStream, getLocalStream, produceMedia]);

  // Функция для повторного запроса разрешений (вызывается по клику пользователя)
  const requestPermissions = useCallback(async () => {
    console.log('💡 Запрашиваем разрешения на камеру (по клику пользователя)...');
    setPermissionError(null); // Очищаем предыдущую ошибку
    try {
      const stream = await getLocalStream();
      if (stream && sendTransportRef.current) {
        try {
          await produceMedia('video');
          console.log('✅ Видео успешно отправлено');
          setPermissionError(null); // Успех - очищаем ошибку
        } catch (error) {
          console.error('❌ Ошибка отправки видео:', error);
        }
      } else if (!stream) {
        // Если stream не получен, ошибка уже установлена в getLocalStream
        console.warn('⚠️ Stream не получен, проверьте разрешения');
      }
    } catch (error) {
      console.error('❌ Ошибка при запросе разрешений:', error);
    }
  }, [getLocalStream, produceMedia]);

  return {
    localStream,
    isCameraOn,
    toggleCamera,
    videoRefs,
    requestPermissions, // Экспортируем функцию для повторного запроса
    permissionError, // Экспортируем состояние ошибки для показа кнопки
  };
};
