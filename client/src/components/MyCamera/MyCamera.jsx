import { useContext } from "react";
import { useEffect, useRef } from "react";
import { DataContext } from "../../context/DataContext";

function MyCamera({ onStream }) {
  const videoRef = useRef(null);
  const { webcamIsOn, setWebcamIsOn } = useContext(DataContext)

  useEffect(() => {
    let stream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setWebcamIsOn(true);
        if (onStream) onStream(stream);
      } catch (err) {
        console.error("Ошибка доступа к камере:", err);
        setWebcamIsOn(false);
      }
    }

    startCamera();

    return () => {
      // Остановка камеры при размонтировании компонента
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setWebcamIsOn(false);
    };
  }, [onStream]);

  return <video className="webcamera" ref={videoRef} autoPlay playsInline muted style={{ width: "400px" }} />;
}

export default MyCamera;