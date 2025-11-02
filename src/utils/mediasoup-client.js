// mediasoup-client.js - Клиентская библиотека для работы с Mediasoup
import * as mediasoupClient from 'mediasoup-client';

/**
 * Класс для управления медиа соединениями через Mediasoup
 */
export class MediasoupClient {
  constructor(socket, playerId) {
    this.socket = socket;
    this.playerId = playerId;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.producers = new Map(); // kind -> producer
    this.consumers = new Map(); // producerId -> consumer
    this.localStream = null;
  }

  /**
   * Инициализация медиа устройства
   */
  async initialize(routerRtpCapabilities) {
    try {
      console.log('🔧 Инициализируем Mediasoup устройство...');
      
      // Создаем устройство
      this.device = new mediasoupClient.Device();
      
      // Загружаем возможности роутера
      await this.device.load({ routerRtpCapabilities });
      
      console.log('✅ Mediasoup устройство инициализировано');
      
      return true;
    } catch (error) {
      console.error('❌ Ошибка инициализации устройства:', error);
      return false;
    }
  }

  /**
   * Создание транспорта для отправки медиа
   */
  async createSendTransport() {
    try {
      console.log('🚀 Создаю send transport...');
      
      // Запрашиваем создание транспорта на сервере
      const response = await this.request('createSendTransport');
      
      if (!response || !response.transportParams) {
        throw new Error('Не получены параметры транспорта');
      }
      
      // Создаем транспорт на клиенте
      this.sendTransport = this.device.createSendTransport(response.transportParams);
      
      // Обработчики событий транспорта
      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('🔗 Подключаюсь к send transport...');
          await this.request('connectSendTransport', { dtlsParameters });
          callback();
        } catch (error) {
          console.error('❌ Ошибка подключения send transport:', error);
          errback(error);
        }
      });
      
      this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          console.log(`📤 Создаю producer ${kind}...`);
          const response = await this.request('produce', { kind, rtpParameters });
          callback({ id: response.producerId });
        } catch (error) {
          console.error(`❌ Ошибка создания producer ${kind}:`, error);
          errback(error);
        }
      });
      
      this.sendTransport.on('connectionstatechange', (state) => {
        console.log(`🔗 Send transport состояние: ${state}`);
        if (state === 'failed' || state === 'disconnected') {
          console.warn('⚠️ Send transport потерял соединение');
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
   * Создание транспорта для получения медиа
   */
  async createRecvTransport() {
    try {
      console.log('🚀 Создаю recv transport...');
      
      // Запрашиваем создание транспорта на сервере
      const response = await this.request('createRecvTransport');
      
      if (!response || !response.transportParams) {
        throw new Error('Не получены параметры транспорта');
      }
      
      // Создаем транспорт на клиенте
      this.recvTransport = this.device.createRecvTransport(response.transportParams);
      
      // Обработчики событий транспорта
      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          console.log('🔗 Подключаюсь к recv transport...');
          await this.request('connectRecvTransport', { dtlsParameters });
          callback();
        } catch (error) {
          console.error('❌ Ошибка подключения recv transport:', error);
          errback(error);
        }
      });
      
      this.recvTransport.on('connectionstatechange', (state) => {
        console.log(`🔗 Recv transport состояние: ${state}`);
        if (state === 'failed' || state === 'disconnected') {
          console.warn('⚠️ Recv transport потерял соединение');
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
   * Отправка локального медиа потока (видео и аудио)
   */
  async sendLocalStream(stream) {
    if (!this.sendTransport) {
      throw new Error('Send transport не создан');
    }
    
    this.localStream = stream;
    
    try {
      // Отправляем видео трек
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await this.sendTrack(videoTrack, stream, 'video');
      }
      
      // Отправляем аудио трек
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        await this.sendTrack(audioTrack, stream, 'audio');
      }
      
      console.log('✅ Локальный поток отправлен');
    } catch (error) {
      console.error('❌ Ошибка отправки локального потока:', error);
      throw error;
    }
  }

  /**
   * Отправка отдельного трека
   */
  async sendTrack(track, stream, kind) {
    if (!this.sendTransport || !track) {
      return null;
    }
    
    try {
      // Создаем producer
      const producer = await this.sendTransport.produce({
        track,
        codecOptions: kind === 'video' ? {
          videoGoogleStartBitrate: 1000 // Начальный битрейт
        } : undefined
      });
      
      // Устанавливаем параметры качества для видео (Simulcast)
      if (kind === 'video' && producer.rtpParameters.encodings) {
        const encodings = producer.rtpParameters.encodings;
        
        // Пытаемся включить Simulcast (3 уровня качества)
        try {
          encodings[0].maxBitrate = 800000; // High
          encodings[0].maxFramerate = 24;
          
          // Добавляем дополнительные слои для Simulcast
          if (encodings.length === 1) {
            encodings.push({
              scaleResolutionDownBy: 2,
              maxBitrate: 400000,
              maxFramerate: 15
            });
            encodings.push({
              scaleResolutionDownBy: 4,
              maxBitrate: 150000,
              maxFramerate: 10
            });
          }
          
          producer.rtpParameters.encodings = encodings;
          console.log('✅ Simulcast включен для видео');
        } catch (error) {
          console.warn('⚠️ Simulcast не поддерживается:', error);
        }
      }
      
      this.producers.set(kind, producer);
      
      console.log(`✅ Producer ${kind} создан:`, {
        id: producer.id,
        kind: producer.kind,
        rtpParameters: producer.rtpParameters
      });
      
      // Отслеживаем изменения состояния
      producer.on('trackended', () => {
        console.log(`📹 Producer ${kind} завершился`);
        this.producers.delete(kind);
      });
      
      return producer;
    } catch (error) {
      console.error(`❌ Ошибка создания producer ${kind}:`, error);
      throw error;
    }
  }

  /**
   * Получение медиа от другого игрока
   */
  async consumeRemoteStream(producerId, remotePlayerId) {
    if (!this.recvTransport) {
      console.warn('⚠️ Recv transport не создан');
      return null;
    }
    
    // Проверяем, не получаем ли мы уже этот producer
    if (this.consumers.has(producerId)) {
      console.log(`⚠️ Уже получаем producer ${producerId}`);
      return this.consumers.get(producerId);
    }
    
    try {
      // Запрашиваем создание consumer на сервере
      const response = await this.request('consume', {
        producerId,
        rtpCapabilities: this.device.rtpCapabilities
      });
      
      if (!response || !response.consumerParams) {
        throw new Error('Не получены параметры consumer');
      }
      
      // Создаем consumer на клиенте
      const consumer = await this.recvTransport.consume(response.consumerParams);
      
      this.consumers.set(producerId, consumer);
      
      console.log(`✅ Consumer создан для producer ${producerId}:`, {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind
      });
      
      // Отслеживаем изменения состояния
      consumer.on('trackended', () => {
        console.log(`📹 Consumer ${consumer.id} завершился`);
        this.consumers.delete(producerId);
      });
      
      // Отправляем подтверждение на сервер
      await this.request('consumerResumed', { consumerId: consumer.id });
      
      return consumer;
    } catch (error) {
      console.error(`❌ Ошибка создания consumer для producer ${producerId}:`, error);
      throw error;
    }
  }

  /**
   * Остановка отправки трека
   */
  async stopProducing(kind) {
    const producer = this.producers.get(kind);
    if (producer) {
      producer.close();
      this.producers.delete(kind);
      console.log(`✅ Producer ${kind} остановлен`);
    }
  }

  /**
   * Остановка получения трека
   */
  async stopConsuming(producerId) {
    const consumer = this.consumers.get(producerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(producerId);
      console.log(`✅ Consumer для producer ${producerId} остановлен`);
    }
  }

  /**
   * Включение/выключение трека
   */
  async toggleProducerTrack(kind, enabled) {
    const producer = this.producers.get(kind);
    if (producer) {
      await producer.pause();
      if (enabled) {
        await producer.resume();
      }
      console.log(`✅ Producer ${kind} ${enabled ? 'включен' : 'выключен'}`);
    }
  }

  /**
   * Изменение разрешения и битрейта
   */
  async setProducerParameters(kind, params) {
    const producer = this.producers.get(kind);
    if (!producer) {
      return;
    }
    
    try {
      // Получаем текущие параметры
      const parameters = producer.rtpParameters;
      
      // Обновляем параметры
      if (kind === 'video' && parameters.encodings && parameters.encodings.length > 0) {
        const encoding = parameters.encodings[0];
        
        if (params.maxBitrate !== undefined) {
          encoding.maxBitrate = params.maxBitrate;
        }
        if (params.maxFramerate !== undefined) {
          encoding.maxFramerate = params.maxFramerate;
        }
        if (params.scaleResolutionDownBy !== undefined) {
          encoding.scaleResolutionDownBy = params.scaleResolutionDownBy;
        }
        
        // Применяем изменения
        await producer.setPreferredLayers({ 
          spatialLayer: params.spatialLayer || 0,
          temporalLayer: params.temporalLayer || 0
        });
        
        console.log(`✅ Параметры producer ${kind} обновлены`);
      }
    } catch (error) {
      console.error(`❌ Ошибка обновления параметров producer ${kind}:`, error);
    }
  }

  /**
   * Получить статистику производителей
   */
  async getProducerStats() {
    const stats = {};
    
    for (const [kind, producer] of this.producers) {
      try {
        const producerStats = await producer.getStats();
        stats[kind] = producerStats;
      } catch (error) {
        console.error(`❌ Ошибка получения статистики producer ${kind}:`, error);
      }
    }
    
    return stats;
  }

  /**
   * Получить статистику потребителей
   */
  async getConsumerStats() {
    const stats = {};
    
    for (const [producerId, consumer] of this.consumers) {
      try {
        const consumerStats = await consumer.getStats();
        stats[producerId] = consumerStats;
      } catch (error) {
        console.error(`❌ Ошибка получения статистики consumer ${producerId}:`, error);
      }
    }
    
    return stats;
  }

  /**
   * Полная очистка ресурсов
   */
  async cleanup() {
    console.log('🧹 Очистка Mediasoup ресурсов...');
    
    // Закрываем всех producers
    for (const [kind, producer] of this.producers) {
      try {
        producer.close();
      } catch (error) {
        console.error(`Ошибка закрытия producer ${kind}:`, error);
      }
    }
    this.producers.clear();
    
    // Закрываем всех consumers
    for (const [producerId, consumer] of this.consumers) {
      try {
        consumer.close();
      } catch (error) {
        console.error(`Ошибка закрытия consumer ${producerId}:`, error);
      }
    }
    this.consumers.clear();
    
    // Закрываем транспорты
    if (this.sendTransport) {
      try {
        this.sendTransport.close();
      } catch (error) {
        console.error('Ошибка закрытия send transport:', error);
      }
      this.sendTransport = null;
    }
    
    if (this.recvTransport) {
      try {
        this.recvTransport.close();
      } catch (error) {
        console.error('Ошибка закрытия recv transport:', error);
      }
      this.recvTransport = null;
    }
    
    this.localStream = null;
    this.device = null;
    
    console.log('✅ Ресурсы Mediasoup очищены');
  }

  /**
   * Вспомогательный метод для отправки запросов
   */
  request(type, data = {}) {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // Отправляем запрос
      this.socket.send(JSON.stringify({
        type: 'mediasoup',
        requestType: type,
        requestId,
        data
      }));
      
      // Временный обработчик ответа
      const responseHandler = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'mediasoup' && message.requestId === requestId) {
            this.socket.removeEventListener('message', responseHandler);
            
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
      
      this.socket.addEventListener('message', responseHandler);
      
      // Таймаут
      setTimeout(() => {
        this.socket.removeEventListener('message', responseHandler);
        reject(new Error('Timeout медиа запроса'));
      }, 10000);
    });
  }
}

export default MediasoupClient;
