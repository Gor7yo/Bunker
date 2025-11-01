// kurento-client.js
// Клиентская утилита для работы с Kurento Media Server

/**
 * Kurento WebRTC клиент для подключения к медиа-серверу
 */
export class KurentoWebRtcPeer {
  constructor(ws, playerId) {
    this.ws = ws;
    this.playerId = playerId;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.onRemoteStream = null; // Callback: (stream) => void
    this.onConnectionStateChange = null; // Callback: (state) => void
  }

  /**
   * Инициализация соединения с Kurento
   */
  async start(localStream, onRemoteStream) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket не подключен');
    }

    this.localStream = localStream;
    this.onRemoteStream = onRemoteStream;

    console.log(`🎬 Инициализация Kurento соединения для ${this.playerId}`);

    // Создаем RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    // Добавляем локальные треки
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`📤 Добавляем локальный трек ${track.kind}`);
        const sender = this.pc.addTrack(track, localStream);
        
        // Оптимизация битрейта
        if (sender.track.kind === 'video') {
          this.optimizeVideoSender(sender);
        } else if (sender.track.kind === 'audio') {
          this.optimizeAudioSender(sender);
        }
      });
    }

    // Обработка входящих потоков
    this.pc.ontrack = (event) => {
      console.log('📹 Получен удаленный поток от Kurento');
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Обработка ICE кандидатов
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws.readyState === WebSocket.OPEN) {
        console.log('🧊 Отправляем ICE кандидат на сервер');
        this.ws.send(JSON.stringify({
          type: 'kurento_ice_candidate',
          candidate: event.candidate
        }));
      }
    };

    // Мониторинг состояния соединения
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log(`🔗 Kurento соединение: ${state}`);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    };

    // Создаем offer
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await this.pc.setLocalDescription(offer);

      // Отправляем offer на сервер
      console.log('📤 Отправляем SDP offer на Kurento сервер');
      this.ws.send(JSON.stringify({
        type: 'kurento_offer',
        sdpOffer: offer.sdp
      }));

    } catch (error) {
      console.error('❌ Ошибка создания offer:', error);
      throw error;
    }
  }

  /**
   * Обработка SDP answer от сервера
   */
  async processAnswer(sdpAnswer) {
    if (!this.pc) {
      throw new Error('PeerConnection не инициализирован');
    }

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: sdpAnswer
      }));
      console.log('✅ SDP answer установлен');
    } catch (error) {
      console.error('❌ Ошибка установки SDP answer:', error);
      throw error;
    }
  }

  /**
   * Обработка ICE кандидата от сервера
   */
  async addIceCandidate(candidate) {
    if (!this.pc) {
      console.warn('⚠️ PeerConnection не готов для ICE кандидата');
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ ICE кандидат добавлен');
    } catch (error) {
      console.error('❌ Ошибка добавления ICE кандидата:', error);
    }
  }

  /**
   * Оптимизация видео sender
   */
  async optimizeVideoSender(sender) {
    try {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      
      // Пытаемся включить Simulcast
      try {
        params.encodings = [
          { rid: 'high', active: true, maxBitrate: 350000, scaleResolutionDownBy: 1, maxFramerate: 20 },
          { rid: 'medium', active: true, maxBitrate: 200000, scaleResolutionDownBy: 2, maxFramerate: 15 },
          { rid: 'low', active: true, maxBitrate: 100000, scaleResolutionDownBy: 4, maxFramerate: 10 }
        ];
        await sender.setParameters(params);
        console.log('✅ Simulcast включен для Kurento');
      } catch (e) {
        // Fallback: один поток
        params.encodings[0].maxBitrate = 300000;
        params.encodings[0].maxFramerate = 20;
        await sender.setParameters(params);
      }
    } catch (error) {
      console.warn('⚠️ Не удалось оптимизировать видео sender:', error);
    }
  }

  /**
   * Оптимизация аудио sender
   */
  async optimizeAudioSender(sender) {
    try {
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      params.encodings[0].priority = 'high';
      params.encodings[0].maxBitrate = 24000;
      await sender.setParameters(params);
    } catch (error) {
      console.warn('⚠️ Не удалось оптимизировать аудио sender:', error);
    }
  }

  /**
   * Остановка соединения
   */
  async stop() {
    console.log(`🛑 Останавливаем Kurento соединение для ${this.playerId}`);

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.localStream = null;
    this.remoteStream = null;
  }

  /**
   * Получение локального потока
   */
  getLocalStream() {
    return this.localStream;
  }

  /**
   * Получение удаленного потока
   */
  getRemoteStream() {
    return this.remoteStream;
  }
}


