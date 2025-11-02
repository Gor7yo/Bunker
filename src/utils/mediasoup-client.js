// Mediasoup SFU клиент
import * as mediasoupClient from 'mediasoup-client';

export class MediasoupClient {
  constructor(socket, playerId) {
    this.socket = socket;
    this.playerId = playerId;
    this.device = null;
    this.rtpCapabilities = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map(); // kind -> producer
    this.consumers = new Map(); // producerId -> consumer
  }

  /**
   * Инициализация устройства Mediasoup
   */
  async initialize(routerRtpCapabilities) {
    try {
      this.rtpCapabilities = routerRtpCapabilities;
      this.device = new mediasoupClient.Device();
      await this.device.load({ routerRtpCapabilities });
      console.log('✅ Mediasoup устройство загружено:', this.device.rtpCapabilities);
      return true;
    } catch (error) {
      console.error('❌ Ошибка загрузки Mediasoup устройства:', error);
      return false;
    }
  }

  /**
   * Создание send transport
   */
  async createSendTransport() {
    try {
      const data = await this.request('createSendTransport');
      
      this.sendTransport = this.device.createSendTransport({
        id: data.id,
        iceParameters: data.iceParameters,
        iceCandidates: data.iceCandidates,
        dtlsParameters: data.dtlsParameters,
        sctpParameters: data.sctpParameters
      });

      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.request('connectSendTransport', { dtlsParameters });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { producerId } = await this.request('produce', { kind, rtpParameters });
          callback({ id: producerId });
        } catch (error) {
          errback(error);
        }
      });

      console.log('✅ Send transport создан');
      return this.sendTransport;
    } catch (error) {
      console.error('❌ Ошибка создания send transport:', error);
      throw error;
    }
  }

  /**
   * Создание recv transport
   */
  async createRecvTransport() {
    try {
      const data = await this.request('createRecvTransport');
      
      this.recvTransport = this.device.createRecvTransport({
        id: data.id,
        iceParameters: data.iceParameters,
        iceCandidates: data.iceCandidates,
        dtlsParameters: data.dtlsParameters,
        sctpParameters: data.sctpParameters
      });

      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.request('connectRecvTransport', { dtlsParameters });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      console.log('✅ Recv transport создан');
      return this.recvTransport;
    } catch (error) {
      console.error('❌ Ошибка создания recv transport:', error);
      throw error;
    }
  }

  /**
   * Отправка локального потока
   */
  async produceLocalStream(stream) {
    if (!this.sendTransport) {
      await this.createSendTransport();
    }

    const tracks = {
      video: stream.getVideoTracks(),
      audio: stream.getAudioTracks()
    };

    for (const [kind, trackArray] of Object.entries(tracks)) {
      if (trackArray.length > 0) {
        try {
          const producer = await this.sendTransport.produce({ track: trackArray[0] });
          this.producers.set(kind, producer);
          console.log(`✅ Producer создан для ${kind}:`, producer.id);
        } catch (error) {
          console.error(`❌ Ошибка создания producer для ${kind}:`, error);
        }
      }
    }
  }

  /**
   * Прием удаленного потока
   */
  async consumeRemoteStream(producerId, remotePlayerId) {
    if (!this.recvTransport) {
      await this.createRecvTransport();
    }

    try {
      const data = await this.request('consume', { producerId, rtpCapabilities: this.device.rtpCapabilities });
      
      const consumer = await this.recvTransport.consume({
        id: data.id,
        producerId: data.producerId,
        kind: data.kind,
        rtpParameters: data.rtpParameters
      });

      this.consumers.set(producerId, consumer);
      
      // Возобновляем consumer
      await this.request('consumerResumed', { consumerId: consumer.id });
      
      console.log(`✅ Consumer создан для ${remotePlayerId}:`, consumer.id);
      return consumer;
    } catch (error) {
      console.error('❌ Ошибка создания consumer:', error);
      return null;
    }
  }

  /**
   * Переключение трека producer
   */
  async toggleProducerTrack(kind, enabled) {
    const producer = this.producers.get(kind);
    if (producer) {
      producer.pause();
      if (enabled) {
        producer.resume();
      }
      console.log(`✅ ${kind} producer ${enabled ? 'включен' : 'выключен'}`);
    }
  }

  /**
   * Очистка ресурсов
   */
  async cleanup() {
    console.log('🧹 Очистка Mediasoup клиента...');
    
    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }
    
    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }
    
    this.producers.clear();
    this.consumers.clear();
  }

  /**
   * Универсальный метод для запросов к серверу
   */
  request(type, data = {}) {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random()}`;
      
      const timeout = setTimeout(() => {
        this.socket.removeEventListener('message', handler);
        reject(new Error(`Timeout для запроса ${type}`));
      }, 10000);

      const handler = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'mediasoup' && message.requestId === requestId) {
            clearTimeout(timeout);
            this.socket.removeEventListener('message', handler);
            
            if (message.error) {
              reject(new Error(message.error));
            } else {
              resolve(message.data);
            }
          }
        } catch (error) {
          // Игнорируем некорректные сообщения
        }
      };

      this.socket.addEventListener('message', handler);

      this.socket.send(JSON.stringify({
        type: 'mediasoup',
        requestType: type,
        requestId,
        data
      }));
    });
  }
}
