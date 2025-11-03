import { useContext } from "react";
import { useEffect, useRef } from "react";
import { DataContext } from "../../context/DataContext";

function MyCamera({ onStream }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
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
        
        // Ждем, пока video элемент будет готов
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(err => {
            console.warn("⚠️ Автоплей заблокирован, но поток подключен:", err);
          });
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setWebcamIsOn(false);
    };
  }, []); // Пустой массив зависимостей - камера инициализируется только один раз при монтировании

  return (
    <video 
      className="webcamera" 
      ref={videoRef} 
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