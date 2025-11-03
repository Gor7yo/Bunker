import { useContext } from "react";
import { useEffect, useRef } from "react";
import { DataContext } from "../../context/DataContext";

function MyCamera({ onStream }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lastTimeRef = useRef(0);
  const trackCheckIntervalRef = useRef(null);
  const { webcamIsOn, setWebcamIsOn, mirrorCamera } = useContext(DataContext)

  useEffect(() => {
    let mounted = true;
    
    async function startCamera() {
      try {
        // ⚡ ОПТИМИЗИРОВАННЫЕ НАСТРОЙКИ ДЛЯ 8 ИГРОКОВ: минимальное разрешение и FPS
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 480, max: 640 }, 
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 20, max: 24 },
            aspectRatio: { ideal: 4/3 },
            facingMode: 'user'
          }, 
          audio: false 
        });
        
        if (!mounted) {
          // Если компонент размонтирован, останавливаем поток
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        streamRef.current = stream;
        
        // Функция подключения потока к видео элементу
        const connectStreamToVideo = (videoElement) => {
          if (!videoElement || !streamRef.current) return;
          
          videoElement.srcObject = streamRef.current;
          videoElement.playsInline = true;
          videoElement.muted = true;
          
          // Принудительное воспроизведение
          videoElement.play().then(() => {
            console.log("✅ Видео воспроизводится в MyCamera");
          }).catch(err => {
            console.warn("⚠️ Автоплей заблокирован, но поток подключен:", err);
          });
          
          // Обработчик для отслеживания изменений времени (обнаружение заморозки)
          videoElement.ontimeupdate = () => {
            const currentTime = videoElement.currentTime;
            if (lastTimeRef.current === currentTime && currentTime > 0) {
              // Видео заморожено - принудительно обновляем srcObject
              console.log("🔄 Обнаружена заморозка видео, обновляем...");
              videoElement.srcObject = null;
              setTimeout(() => {
                if (mounted && streamRef.current && videoRef.current) {
                  videoRef.current.srcObject = streamRef.current;
                  videoRef.current.play().catch(console.warn);
                }
              }, 100);
            }
            lastTimeRef.current = currentTime;
          };
          
          // Обработчик для проверки состояния треков
          const checkTracks = () => {
            if (streamRef.current && mounted) {
              streamRef.current.getVideoTracks().forEach(track => {
                if (track.readyState === 'ended') {
                  console.warn("⚠️ Видео трек остановлен!");
                } else if (track.readyState === 'live' && !track.enabled) {
                  console.warn("⚠️ Видео трек отключен, включаем...");
                  track.enabled = true;
                }
              });
            }
          };
          
          // Проверяем треки каждые 2 секунды
          if (trackCheckIntervalRef.current) {
            clearInterval(trackCheckIntervalRef.current);
          }
          trackCheckIntervalRef.current = setInterval(checkTracks, 2000);
        };
        
        // Подключаем поток сразу, если видео элемент уже готов
        if (videoRef.current) {
          connectStreamToVideo(videoRef.current);
        } else {
          // Если видео элемент еще не готов, ждем его появления
          const checkVideoElement = setInterval(() => {
            if (videoRef.current && mounted) {
              clearInterval(checkVideoElement);
              connectStreamToVideo(videoRef.current);
            }
          }, 100);
          
          // Останавливаем проверку через 5 секунд, если элемент так и не появился
          setTimeout(() => {
            clearInterval(checkVideoElement);
          }, 5000);
        }
        
        setWebcamIsOn(true);
        if (onStream) onStream(stream);
      } catch (err) {
        console.error("Ошибка доступа к камере:", err);
        if (mounted) {
          setWebcamIsOn(false);
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      // Остановка камеры при размонтировании компонента
      if (trackCheckIntervalRef.current) {
        clearInterval(trackCheckIntervalRef.current);
        trackCheckIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.ontimeupdate = null;
      }
      setWebcamIsOn(false);
    };
  }, []); // Пустой массив зависимостей - камера инициализируется только один раз при монтировании

  // Callback ref для подключения потока при создании/изменении видео элемента
  const videoCallbackRef = (element) => {
    videoRef.current = element;
    // Если элемент создан и поток готов - подключаем
    if (element && streamRef.current && element.srcObject !== streamRef.current) {
      console.log("📹 Подключаем поток к видео элементу (callback ref)");
      element.srcObject = streamRef.current;
      element.playsInline = true;
      element.muted = true;
      element.play().catch(console.warn);
    }
  };

  return (
    <video 
      className="webcamera" 
      ref={videoCallbackRef} 
      autoPlay 
      playsInline 
      muted 
      style={{ 
        width: "400px",
        transform: mirrorCamera ? 'scaleX(-1)' : 'none'
      }} 
    />
  );
}

export default MyCamera;