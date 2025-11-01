// mediasoup-client.js
// Клиентская утилита для работы с Mediasoup

import * as mediasoupClient from 'mediasoup-client';

/**
 * Mediasoup WebRTC клиент для подключения к медиа-серверу
 */
export class MediasoupWebRtcPeer {
  constructor(ws, playerId) {
    this.ws = ws;
    this.playerId = playerId;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map(); // kind -> producer
    this.consumers = new Map(); // remotePlayerId -> {audio: consumer, video: consumer}
    this.localStream = null;
    this.remoteStreams = new Map(); // remotePlayerId -> stream
    this.onRemoteStream = null; // Callback: (remotePlayerId, stream) => void
    this.onConnectionStateChange = null; // Callback: (state) => void
    this.rtpCapabilities = null;
    this.isInitialized = false;
  }

  /**
   * Инициализация устройства Mediasoup
   */
  async initialize() {
    try {
      console.log('🎬 Инициализация Mediasoup устройства...');

      // Запрашиваем RTP capabilities у сервера
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Таймаут получения RTP capabilities'));
        }, 10000);

        const originalOnMessage = this.ws.onmessage;
        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'mediasoup_rtp_capabilities') {
              clearTimeout(timeout);
              this.rtpCapabilities = data.rtpCapabilities;
              
              // Создаем устройство Mediasoup
              this.device = new mediasoupClient.Device();
              
              // Загружаем RTP capabilities в устройство
              await this.device.load({ routerRtpCapabilities: this.rtpCapabilities });
              
              console.log('✅ Mediasoup устройство инициализировано');
              this.ws.onmessage = originalOnMessage;
              resolve();
            } else if (data.type === 'error') {
              clearTimeout(timeout);
              this.ws.onmessage = originalOnMessage;
              reject(new Error(data.message || 'Ошибка получения RTP capabilities'));
            } else if (originalOnMessage) {
              originalOnMessage(event);
            }
          } catch (error) {
            if (originalOnMessage) originalOnMessage(event);
          }
        };

        // Запрашиваем RTP capabilities
        this.ws.send(JSON.stringify({
          type: 'mediasoup_get_rtp_capabilities'
        }));
      });
    } catch (error) {
      console.error('❌ Ошибка инициализации Mediasoup устройства:', error);
      throw error;
    }
  }

  /**
   * Создание транспорта для отправки/получения медиа
   */
  async createTransport(direction = 'both') {
    if (!this.device) {
      throw new Error('Устройство не инициализировано');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Таймаут создания транспорта'));
      }, 10000);

      const originalOnMessage = this.ws.onmessage;
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'mediasoup_transport_created') {
            clearTimeout(timeout);
            const transportData = data.transport;
            
            // Создаем транспорт на клиенте
            const transport = this.device.createSendTransport({
              id: transportData.id,
              iceParameters: transportData.iceParameters,
              iceCandidates: transportData.iceCandidates,
              dtlsParameters: transportData.dtlsParameters,
              sctpParameters: undefined
            });

            // Обработчики транспорта
            transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
              try {
                console.log('🔗 Подключение транспорта...');
                this.ws.send(JSON.stringify({
                  type: 'mediasoup_connect_transport',
                  transportId: transport.id,
                  dtlsParameters,
                  direction: 'send'
                }));

                // Ждем подтверждения
                const originalOnMsg = this.ws.onmessage;
                this.ws.onmessage = (e) => {
                  const msg = JSON.parse(e.data);
                  if (msg.type === 'mediasoup_transport_connected' && msg.transportId === transport.id) {
                    console.log('✅ Транспорт подключен');
                    callback();
                    this.ws.onmessage = originalOnMsg;
                  }
                };
              } catch (error) {
                console.error('❌ Ошибка подключения транспорта:', error);
                errback(error);
              }
            });

            transport.on('produce', async (parameters, callback, errback) => {
              try {
                console.log('📤 Создание producer...');
                this.ws.send(JSON.stringify({
                  type: 'mediasoup_create_producer',
                  transportId: transport.id,
                  kind: parameters.kind,
                  rtpParameters: parameters.rtpParameters
                }));

                // Ждем подтверждения
                const originalOnMsg = this.ws.onmessage;
                this.ws.onmessage = (e) => {
                  const msg = JSON.parse(e.data);
                  if (msg.type === 'mediasoup_producer_created' && msg.producer) {
                    console.log(`✅ Producer создан: ${msg.producer.id}`);
                    callback({ id: msg.producer.id });
                    this.ws.onmessage = originalOnMsg;
                  }
                };
              } catch (error) {
                console.error('❌ Ошибка создания producer:', error);
                errback(error);
              }
            });

            if (direction === 'send' || direction === 'both') {
              this.sendTransport = transport;
            }

            this.ws.onmessage = originalOnMessage;
            resolve(transport);
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            this.ws.onmessage = originalOnMessage;
            reject(new Error(data.message || 'Ошибка создания транспорта'));
          } else if (originalOnMessage) {
            originalOnMessage(event);
          }
        } catch (error) {
          if (originalOnMessage) originalOnMessage(event);
        }
      };

      // Запрашиваем создание транспорта
      this.ws.send(JSON.stringify({
        type: 'mediasoup_create_transport',
        direction
      }));
    });
  }

  /**
   * Начало работы с Mediasoup
   */
  async start(localStream, onRemoteStream) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket не подключен');
    }

    this.localStream = localStream;
    this.onRemoteStream = onRemoteStream;

    console.log('🎬 Начало работы с Mediasoup...');

    // Инициализируем устройство
    if (!this.isInitialized) {
      await this.initialize();
      this.isInitialized = true;
    }

    // Создаем send transport
    await this.createTransport('send');

    // Добавляем локальные треки как producers
    if (localStream) {
      for (const track of localStream.getTracks()) {
        await this.produceTrack(track, localStream);
      }
    }

    // Запрашиваем список активных producers от других игроков
    await this.requestActiveProducers();

    console.log('✅ Mediasoup соединение установлено');
  }

  /**
   * Создание producer для трека
   */
  async produceTrack(track, stream) {
    if (!this.sendTransport) {
      throw new Error('Send transport не создан');
    }

    try {
      console.log(`📤 Создание producer для ${track.kind}...`);
      
      const producer = await this.sendTransport.produce({
        track,
        codecOptions: {
          videoGoogleStartBitrate: 1000
        }
      });

      this.producers.set(track.kind, producer);
      console.log(`✅ Producer создан для ${track.kind}:`, producer.id);

      return producer;
    } catch (error) {
      console.error(`❌ Ошибка создания producer для ${track.kind}:`, error);
      throw error;
    }
  }

  /**
   * Запрос списка активных producers
   */
  async requestActiveProducers() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Таймаут получения списка producers'));
      }, 5000);

      const originalOnMessage = this.ws.onmessage;
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'mediasoup_active_producers') {
            clearTimeout(timeout);
            
            // Создаем consumers для каждого producer
            if (data.producers && data.producers.length > 0) {
              data.producers.forEach(async (producerInfo) => {
                if (producerInfo.playerId !== this.playerId) {
                  await this.createConsumer(producerInfo.playerId, producerInfo.kind, producerInfo.producerId);
                }
              });
            }
            
            this.ws.onmessage = originalOnMessage;
            resolve(data.producers || []);
          } else if (data.type === 'mediasoup_new_producer') {
            // Новый producer появился - создаем consumer
            if (data.playerId !== this.playerId) {
              this.createConsumer(data.playerId, data.kind, data.producerId);
            }
            if (originalOnMessage) originalOnMessage(event);
          } else if (originalOnMessage) {
            originalOnMessage(event);
          }
        } catch (error) {
          if (originalOnMessage) originalOnMessage(event);
        }
      };

      // Запрашиваем активные producers
      this.ws.send(JSON.stringify({
        type: 'mediasoup_get_active_producers'
      }));
    });
  }

  /**
   * Создание consumer для получения потока от другого игрока
   */
  async createConsumer(remotePlayerId, kind, producerId) {
    if (!this.device) {
      console.warn('⚠️ Устройство не готово для consumer');
      return;
    }

    // Проверяем, не создали ли уже consumer для этого игрока
    if (this.consumers.has(remotePlayerId)) {
      const existing = this.consumers.get(remotePlayerId);
      if (existing[kind]) {
        console.log(`ℹ️ Consumer для ${remotePlayerId} (${kind}) уже существует`);
        return;
      }
    }

    try {
      console.log(`📥 Создание consumer для ${remotePlayerId} (${kind})...`);

      // Создаем recv transport если его нет
      if (!this.recvTransport) {
        await this.createRecvTransport();
      }

      // Запрашиваем создание consumer на сервере
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Таймаут создания consumer'));
        }, 10000);

        const originalOnMessage = this.ws.onmessage;
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'mediasoup_consumer_created' && 
                data.remotePlayerId === remotePlayerId &&
                data.consumer.kind === kind) {
              clearTimeout(timeout);
              
              // Создаем consumer на клиенте
              const consumer = this.recvTransport.consume({
                id: data.consumer.id,
                producerId: data.consumer.producerId,
                kind: data.consumer.kind,
                rtpParameters: data.consumer.rtpParameters
              });

              // Сохраняем consumer
              if (!this.consumers.has(remotePlayerId)) {
                this.consumers.set(remotePlayerId, {});
              }
              this.consumers.get(remotePlayerId)[kind] = consumer;

              // Создаем поток и добавляем трек
              if (!this.remoteStreams.has(remotePlayerId)) {
                const remoteStream = new MediaStream();
                this.remoteStreams.set(remotePlayerId, remoteStream);
              }
              
              const remoteStream = this.remoteStreams.get(remotePlayerId);
              remoteStream.addTrack(consumer.track);

              // Вызываем callback
              if (this.onRemoteStream) {
                this.onRemoteStream(remotePlayerId, remoteStream);
              }

              console.log(`✅ Consumer создан для ${remotePlayerId} (${kind}):`, consumer.id);
              
              this.ws.onmessage = originalOnMessage;
              resolve(consumer);
            } else if (data.type === 'error') {
              clearTimeout(timeout);
              this.ws.onmessage = originalOnMessage;
              reject(new Error(data.message || 'Ошибка создания consumer'));
            } else if (originalOnMessage) {
              originalOnMessage(event);
            }
          } catch (error) {
            if (originalOnMessage) originalOnMessage(event);
          }
        };

        // Запрашиваем создание consumer
        this.ws.send(JSON.stringify({
          type: 'mediasoup_create_consumer',
          remotePlayerId,
          kind,
          producerId
        }));
      });
    } catch (error) {
      console.error(`❌ Ошибка создания consumer для ${remotePlayerId}:`, error);
      throw error;
    }
  }

  /**
   * Создание recv транспорта
   */
  async createRecvTransport() {
    if (this.recvTransport) {
      return this.recvTransport;
    }

    const transport = await this.createTransport('recv');
    this.recvTransport = transport;

    // Обработчик подключения для recv транспорта
    transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        this.ws.send(JSON.stringify({
          type: 'mediasoup_connect_transport',
          transportId: transport.id,
          dtlsParameters,
          direction: 'recv'
        }));

        const originalOnMsg = this.ws.onmessage;
        this.ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'mediasoup_transport_connected' && msg.transportId === transport.id) {
            callback();
            this.ws.onmessage = originalOnMsg;
          }
        };
      } catch (error) {
        errback(error);
      }
    });

    return transport;
  }

  /**
   * Остановка соединения
   */
  async stop() {
    console.log(`🛑 Останавливаем Mediasoup соединение для ${this.playerId}`);

    // Закрываем producers
    for (const producer of this.producers.values()) {
      if (producer && !producer.closed) {
        producer.close();
      }
    }
    this.producers.clear();

    // Закрываем consumers
    for (const playerConsumers of this.consumers.values()) {
      for (const consumer of Object.values(playerConsumers)) {
        if (consumer && !consumer.closed) {
          consumer.close();
        }
      }
    }
    this.consumers.clear();

    // Закрываем transports
    if (this.sendTransport && !this.sendTransport.closed) {
      this.sendTransport.close();
    }
    if (this.recvTransport && !this.recvTransport.closed) {
      this.recvTransport.close();
    }

    this.localStream = null;
    this.remoteStreams.clear();
  }

  /**
   * Получение удаленного потока для игрока
   */
  getRemoteStream(remotePlayerId) {
    return this.remoteStreams.get(remotePlayerId);
  }
}
