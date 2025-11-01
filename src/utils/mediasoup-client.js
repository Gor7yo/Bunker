// Mediasoup клиент для подключения к SFU серверу

export class MediasoupClient {
  constructor(ws, playerId) {
    this.ws = ws;
    this.playerId = playerId;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producer = null;
    this.consumers = new Map(); // producerId -> consumer
    this.remoteStreams = new Map(); // producerId -> MediaStream
    this.onRemoteStream = null; // callback для получения удаленного потока
  }

  /**
   * Инициализация устройства Mediasoup
   */
  async initialize(rtpCapabilities) {
    try {
      const mediasoup = await import('mediasoup-client');
      this.device = new mediasoup.Device();
      
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });
      console.log('✅ Mediasoup устройство инициализировано');
      
      return true;
    } catch (error) {
      console.error('❌ Ошибка инициализации Mediasoup устройства:', error);
      throw error;
    }
  }

  /**
   * Подключение к медиа-серверу
   */
  async connect(sendTransportInfo, recvTransportInfo) {
    try {
      const mediasoup = await import('mediasoup-client');

      // Создаем send transport
      this.sendTransport = this.device.createSendTransport({
        id: sendTransportInfo.id,
        iceParameters: sendTransportInfo.iceParameters,
        iceCandidates: sendTransportInfo.iceCandidates,
        dtlsParameters: sendTransportInfo.dtlsParameters,
      });

      // Обработчики send transport
      this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        this.ws.send(JSON.stringify({
          type: 'mediasoup_connect_transport',
          transportId: this.sendTransport.id,
          dtlsParameters,
          direction: 'send',
        }));
        
        // Ожидаем подтверждения от сервера
        const handler = (message) => {
          const data = JSON.parse(message);
          if (data.type === 'mediasoup_transport_connected' && 
              data.transportId === this.sendTransport.id && 
              data.direction === 'send') {
            this.ws.removeEventListener('message', handler);
            callback();
          }
        };
        this.ws.addEventListener('message', handler);
      });

      this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          this.ws.send(JSON.stringify({
            type: 'mediasoup_create_producer',
            transportId: this.sendTransport.id,
            rtpParameters,
          }));

          // Ожидаем ответ от сервера
          const handler = (message) => {
            const data = JSON.parse(message);
            if (data.type === 'mediasoup_producer_created') {
              this.ws.removeEventListener('message', handler);
              callback({ id: data.producer.id });
            }
          };
          this.ws.addEventListener('message', handler);
        } catch (error) {
          errback(error);
        }
      });

      // Создаем recv transport
      this.recvTransport = this.device.createRecvTransport({
        id: recvTransportInfo.id,
        iceParameters: recvTransportInfo.iceParameters,
        iceCandidates: recvTransportInfo.iceCandidates,
        dtlsParameters: recvTransportInfo.dtlsParameters,
      });

      // Обработчики recv transport
      this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        this.ws.send(JSON.stringify({
          type: 'mediasoup_connect_transport',
          transportId: this.recvTransport.id,
          dtlsParameters,
          direction: 'recv',
        }));

        // Ожидаем подтверждения от сервера
        const handler = (message) => {
          const data = JSON.parse(message);
          if (data.type === 'mediasoup_transport_connected' && 
              data.transportId === this.recvTransport.id && 
              data.direction === 'recv') {
            this.ws.removeEventListener('message', handler);
            callback();
          }
        };
        this.ws.addEventListener('message', handler);
      });

      console.log('✅ Mediasoup транспорты созданы');
      return true;
    } catch (error) {
      console.error('❌ Ошибка подключения к Mediasoup:', error);
      throw error;
    }
  }

  /**
   * Отправка локального потока (producer)
   */
  async produce(localStream) {
    try {
      if (!this.sendTransport) {
        throw new Error('Send transport не создан');
      }

      // Получаем видео трек
      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('Видео трек не найден');
      }

      // Создаем producer
      this.producer = await this.sendTransport.produce({ track: videoTrack });
      
      console.log('✅ Producer создан:', this.producer.id);
      
      return this.producer;
    } catch (error) {
      console.error('❌ Ошибка создания producer:', error);
      throw error;
    }
  }

  /**
   * Получение потока от другого игрока (consumer)
   */
  async consume(producerId, remotePlayerId) {
    try {
      if (!this.recvTransport) {
        throw new Error('Recv transport не создан');
      }

      if (this.consumers.has(producerId)) {
        console.log(`⚠️ Consumer для producer ${producerId} уже существует`);
        return this.consumers.get(producerId);
      }

      // Отправляем запрос на создание consumer
      this.ws.send(JSON.stringify({
        type: 'mediasoup_create_consumer',
        producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      }));

      // Ожидаем ответ от сервера
      return new Promise((resolve, reject) => {
        const handler = (message) => {
          try {
            const data = JSON.parse(message);
            if (data.type === 'mediasoup_consumer_created' && data.consumer.producerId === producerId) {
              this.ws.removeEventListener('message', handler);

              // Создаем consumer на клиенте
              const consumer = this.recvTransport.consume({
                id: data.consumer.id,
                producerId: data.consumer.producerId,
                kind: data.consumer.kind,
                rtpParameters: data.consumer.rtpParameters,
              });

              this.consumers.set(producerId, consumer);

              // Создаем MediaStream из consumer трека
              const remoteStream = new MediaStream([consumer.track]);
              this.remoteStreams.set(producerId, remoteStream);

              // Вызываем callback если установлен
              if (this.onRemoteStream) {
                this.onRemoteStream(remotePlayerId, remoteStream);
              }

              console.log(`✅ Consumer создан для producer ${producerId}`);
              resolve(consumer);
            }
          } catch (error) {
            reject(error);
          }
        };
        this.ws.addEventListener('message', handler);

        // Таймаут на случай если сервер не ответит
        setTimeout(() => {
          this.ws.removeEventListener('message', handler);
          reject(new Error('Таймаут ожидания consumer'));
        }, 10000);
      });
    } catch (error) {
      console.error(`❌ Ошибка создания consumer для producer ${producerId}:`, error);
      throw error;
    }
  }

  /**
   * Отключение от медиа-сервера
   */
  disconnect() {
    try {
      // Закрываем producer
      if (this.producer) {
        this.producer.close();
        this.producer = null;
      }

      // Закрываем consumers
      this.consumers.forEach(consumer => consumer.close());
      this.consumers.clear();
      this.remoteStreams.clear();

      // Закрываем transports
      if (this.sendTransport) {
        this.sendTransport.close();
        this.sendTransport = null;
      }
      if (this.recvTransport) {
        this.recvTransport.close();
        this.recvTransport = null;
      }

      console.log('✅ Отключен от Mediasoup');
    } catch (error) {
      console.error('❌ Ошибка отключения от Mediasoup:', error);
    }
  }
}

