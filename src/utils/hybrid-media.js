// Гибридный медиа менеджер: Mediasoup SFU + P2P fallback
import { MediasoupClient } from './mediasoup-client';
import SimplePeer from 'simple-peer';

export class HybridMediaManager {
  constructor(socket, playerId) {
    this.socket = socket;
    this.playerId = playerId;
    this.useMediasoup = false;
    this.mediasoupClient = null;
    this.localStream = null;
    this.peersRef = {}; // Для P2P fallback
    this.videoRefs = null; // Ссылка на videoRefs из Lobby
  }

  /**
   * Установка ссылки на videoRefs из Lobby
   */
  setVideoRefs(videoRefs) {
    this.videoRefs = videoRefs;
  }

  /**
   * Инициализация: пробуем Mediasoup, fallback на P2P
   */
  async initialize() {
    try {
      console.log('🎬 Пробуем инициализировать Mediasoup SFU...');
      
      this.mediasoupClient = new MediasoupClient(this.socket, this.playerId);
      
      // Получаем RTP capabilities от сервера
      const rtpCapabilities = await this.mediasoupClient.request('getRouterRtpCapabilities');
      
      // Инициализируем устройство
      const success = await this.mediasoupClient.initialize(rtpCapabilities);
      
      if (success) {
        this.useMediasoup = true;
        await this.setupMediasoup();
        console.log('✅ Mediasoup SFU активирован');
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Mediasoup SFU недоступен, используем P2P WebRTC:', error.message);
    }
    
    this.useMediasoup = false;
    console.log('📡 Режим P2P WebRTC активирован');
    return false;
  }

  /**
   * Настройка Mediasoup транспортов
   */
  async setupMediasoup() {
    if (!this.mediasoupClient) return;
    await this.mediasoupClient.createSendTransport();
    await this.mediasoupClient.createRecvTransport();
  }

  /**
   * Установка локального потока
   */
  async setLocalStream(stream) {
    this.localStream = stream;
    
    if (this.useMediasoup && this.mediasoupClient) {
      await this.mediasoupClient.produceLocalStream(stream);
    }
  }

  /**
   * Обработка сигнала от другого пира (для P2P)
   */
  async handleSignal(fromId, signal) {
    if (this.useMediasoup) {
      console.log('⚠️ Игнорируем P2P сигнал, так как используем Mediasoup');
      return;
    }

    const peer = this.peersRef[fromId];
    if (peer && !peer.destroyed) {
      peer.signal(signal);
    }
  }

  /**
   * Создание P2P соединения (fallback)
   */
  async createP2PPeerConnection(remoteId) {
    if (this.useMediasoup || !this.localStream) {
      return null;
    }

    console.log(`🔗 Создаем P2P соединение с ${remoteId}`);
    
    const peer = new SimplePeer({
      initiator: this.playerId < remoteId,
      trickle: false,
      stream: this.localStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (signal) => {
      this.socket.send(JSON.stringify({
        type: 'signal',
        fromId: this.playerId,
        toId: remoteId,
        signal
      }));
    });

    peer.on('stream', (remoteStream) => {
      console.log(`✅ Получен поток от ${remoteId}`, remoteStream);
      
      // Находим видео элемент для этого игрока
      if (this.videoRefs && this.videoRefs.current && this.videoRefs.current[remoteId]) {
        const videoElement = this.videoRefs.current[remoteId];
        videoElement.srcObject = remoteStream;
        videoElement.playsInline = true;
        
        videoElement.play().then(() => {
          console.log(`✅ Видео от ${remoteId} воспроизводится`);
        }).catch(err => {
          console.warn(`⚠️ Автоплей заблокирован для ${remoteId}:`, err);
        });
      } else {
        console.warn(`⚠️ Видео элемент для ${remoteId} не найден, ждем...`);
        // Попробуем еще раз через небольшую задержку
        setTimeout(() => {
          if (this.videoRefs && this.videoRefs.current && this.videoRefs.current[remoteId]) {
            const videoElement = this.videoRefs.current[remoteId];
            videoElement.srcObject = remoteStream;
            videoElement.playsInline = true;
            videoElement.play().catch(err => console.warn('Автоплей заблокирован:', err));
            console.log(`✅ Видео от ${remoteId} воспроизводится (повторная попытка)`);
          }
        }, 100);
      }
    });

    peer.on('error', (error) => {
      console.error(`❌ P2P ошибка с ${remoteId}:`, error);
    });

    peer.on('close', () => {
      console.log(`🔌 P2P соединение с ${remoteId} закрыто`);
      delete this.peersRef[remoteId];
    });

    this.peersRef[remoteId] = peer;
    return peer;
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    console.log('🧹 Очистка гибридного менеджера...');
    
    if (this.mediasoupClient) {
      this.mediasoupClient.cleanup();
    }
    
    Object.values(this.peersRef).forEach(peer => {
      if (!peer.destroyed) {
        peer.destroy();
      }
    });
    this.peersRef = {};
  }
}

