// hybrid-media.js - Гибридный медиа менеджер (Mediasoup + P2P fallback)
import { MediasoupClient } from './mediasoup-client';

/**
 * Гибридный менеджер медиа, поддерживающий как Mediasoup, так и P2P WebRTC
 */
export class HybridMediaManager {
  constructor(socket, playerId) {
    this.socket = socket;
    this.playerId = playerId;
    this.useMediasoup = false;
    this.mediasoupClient = null;
    
    // P2P состояния
    this.peersRef = {};
    this.videoRefs = {};
    this.localStream = null;
  }

  /**
   * Инициализация медиа (попытка Mediasoup, fallback на P2P)
   */
  async initialize() {
    try {
      // Пытаемся инициализировать Mediasoup
      console.log('🎥 Пытаемся инициализировать Mediasoup...');
      
      this.mediasoupClient = new MediasoupClient(this.socket, this.playerId);
      
      // Запрашиваем RTP capabilities напрямую через request метод
      const response = await this.mediasoupClient.request('getRouterRtpCapabilities');
      
      const success = await this.mediasoupClient.initialize(response.rtpCapabilities);
      
      if (success) {
        this.useMediasoup = true;
        console.log('✅ Mediasoup инициализирован успешно');
        await this.setupMediasoup();
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Mediasoup недоступен, используем P2P:', error);
    }
    
    // Fallback на P2P
    this.useMediasoup = false;
    console.log('📡 Используем P2P WebRTC');
    return false;
  }

  /**
   * Настройка Mediasoup транспортов
   */
  async setupMediasoup() {
    if (!this.useMediasoup || !this.mediasoupClient) return;
    
    try {
      // Создаем транспорты
      await this.mediasoupClient.createSendTransport();
      await this.mediasoupClient.createRecvTransport();
      console.log('✅ Mediasoup транспорты созданы');
    } catch (error) {
      console.error('❌ Ошибка настройки Mediasoup:', error);
      this.useMediasoup = false;
    }
  }

  /**
   * Установка локального потока медиа
   */
  async setLocalStream(stream) {
    this.localStream = stream;
    
    if (this.useMediasoup && this.mediasoupClient) {
      // Используем Mediasoup
      try {
        await this.mediasoupClient.sendLocalStream(stream);
        console.log('✅ Поток отправлен через Mediasoup');
      } catch (error) {
        console.error('❌ Ошибка отправки через Mediasoup:', error);
      }
    }
    // P2P логика будет в старом коде Lobby.jsx
  }

  /**
   * Создание P2P соединения с игроком
   */
  async createP2PPeerConnection(remoteId) {
    if (this.peersRef[remoteId]) {
      console.log(`⚠️ P2P соединение с ${remoteId} уже существует`);
      return this.peersRef[remoteId];
    }

    console.log(`🎯 Создаем P2P соединение для ${remoteId}`);
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 0
    });

    // Добавляем локальные треки
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        console.log(`📤 Добавляем локальный трек ${track.kind} для ${remoteId}`);
        const sender = pc.addTrack(track, this.localStream);
        
        // Оптимизируем параметры
        if (track.kind === 'audio') {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].priority = 'high';
          params.encodings[0].maxBitrate = 24000;
          try {
            await sender.setParameters(params);
          } catch (e) {
            console.warn('Не удалось установить параметры аудио:', e);
          }
        } else if (track.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          
          try {
            params.encodings = [
              { rid: 'high', active: true, maxBitrate: 350000, scaleResolutionDownBy: 1, maxFramerate: 20 },
              { rid: 'medium', active: true, maxBitrate: 200000, scaleResolutionDownBy: 2, maxFramerate: 15 },
              { rid: 'low', active: true, maxBitrate: 100000, scaleResolutionDownBy: 4, maxFramerate: 10 }
            ];
            await sender.setParameters(params);
            console.log(`✅ Simulcast включен для ${remoteId}`);
          } catch (e) {
            console.log(`⚠️ Simulcast не поддерживается для ${remoteId}`);
            params.encodings = [{
              priority: 'low',
              maxBitrate: 300000,
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

    // Обработка входящих потоков
    pc.ontrack = (event) => {
      console.log(`📹 Получен удаленный поток от ${remoteId}`, event.streams[0]);
      
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        
        setTimeout(() => {
          if (this.videoRefs[remoteId]) {
            const videoElement = this.videoRefs[remoteId];
            videoElement.srcObject = remoteStream;
            videoElement.playsInline = true;
            
            videoElement.play().then(() => {
              console.log(`✅ Видео и аудио воспроизводятся для ${remoteId}`);
            }).catch(err => {
              console.warn(`⚠️ Автоплей заблокирован для ${remoteId}:`, err);
            });
          }
        }, 100);
      }
    };

    // ICE кандидаты
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        console.log(`🧊 Отправляем ICE кандидат для ${remoteId}`);
        this.socket.send(JSON.stringify({
          type: "signal",
          targetId: remoteId,
          signal: {
            type: "ice-candidate",
            candidate: event.candidate
          }
        }));
      }
    };

    // Мониторинг состояния
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`🔗 ${remoteId}: состояние ${state}`);
      
      if (state === 'failed' || state === 'disconnected') {
        console.warn(`⚠️ Соединение с ${remoteId} потеряно, переподключаемся...`);
        
        try {
          pc.close();
        } catch (e) {
          console.warn('Ошибка при закрытии соединения:', e);
        }
        
        delete this.peersRef[remoteId];
        
        setTimeout(async () => {
          if (this.localStream && this.socket) {
            console.log(`🔄 Переподключаемся к ${remoteId}...`);
            await this.createP2PPeerConnection(remoteId);
          }
        }, 3000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`🧊 ${remoteId}: ICE состояние ${state}`);
      
      if (state === 'failed') {
        console.warn(`⚠️ ICE соединение с ${remoteId} не удалось, перезапускаем ICE...`);
        try {
          pc.restartIce();
        } catch (e) {
          console.warn('Не удалось перезапустить ICE:', e);
        }
      }
    };

    // Инициируем соединение
    if (remoteId > this.playerId) {
      console.log(`🚀 Инициируем offer для ${remoteId}`);
      
      setTimeout(async () => {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
          
          await pc.setLocalDescription(offer);
          
          this.socket.send(JSON.stringify({
            type: "signal",
            targetId: remoteId,
            signal: offer
          }));
          
          console.log(`📤 Offer отправлен для ${remoteId}`);
        } catch (error) {
          console.error(`❌ Ошибка создания offer для ${remoteId}:`, error);
        }
      }, 1000);
    }

    this.peersRef[remoteId] = pc;
    return pc;
  }

  /**
   * Обработка WebRTC сигналов
   */
  async handleSignal(fromId, signal) {
    if (this.useMediasoup) {
      // Mediasoup обрабатывает сигналинг иначе
      return;
    }
    
    let pc = this.peersRef[fromId];
    if (!pc) {
      console.log(`🔗 Создаем новое соединение для входящего сигнала от ${fromId}`);
      pc = await this.createP2PPeerConnection(fromId);
    }

    try {
      if (signal.type === "offer") {
        console.log(`📥 Получен offer от ${fromId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        this.socket.send(JSON.stringify({
          type: "signal",
          targetId: fromId,
          signal: answer
        }));
        
        console.log(`📤 Answer отправлен для ${fromId}`);
        
      } else if (signal.type === "answer") {
        console.log(`📥 Получен answer от ${fromId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        
      } else if (signal.type === "ice-candidate" && signal.candidate) {
        console.log(`🧊 Получен ICE кандидат от ${fromId}`);
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      console.error(`❌ Ошибка обработки сигнала от ${fromId}:`, error);
    }
  }

  /**
   * Переключение камеры
   */
  toggleCamera() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      console.log(`📹 Камера ${videoTrack.enabled ? 'включена' : 'выключена'}`);
      return videoTrack.enabled;
    }
  }

  /**
   * Очистка ресурсов
   */
  async cleanup() {
    console.log('🧹 Очистка медиа ресурсов...');
    
    if (this.useMediasoup && this.mediasoupClient) {
      await this.mediasoupClient.cleanup();
    }
    
    // Закрываем P2P соединения
    Object.values(this.peersRef).forEach(pc => {
      if (pc && pc.connectionState !== 'closed') {
        pc.close();
      }
    });
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    
    this.peersRef = {};
    this.videoRefs = {};
    this.localStream = null;
    
    console.log('✅ Медиа ресурсы очищены');
  }

  /**
   * Получить статус подключений
   */
  getConnectionStatus() {
    if (this.useMediasoup) {
      return {
        type: 'mediasoup',
        producers: this.mediasoupClient ? this.mediasoupClient.producers.size : 0,
        consumers: this.mediasoupClient ? this.mediasoupClient.consumers.size : 0
      };
    } else {
      return {
        type: 'p2p',
        connections: Object.values(this.peersRef).filter(pc => pc.connectionState === 'connected').length
      };
    }
  }
}

export default HybridMediaManager;

