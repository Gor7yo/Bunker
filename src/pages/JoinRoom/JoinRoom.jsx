import "./JoinRoom.css";
import { Link, Navigate } from "react-router-dom";
import { useState, useEffect, useRef, useContext } from "react";
import MyCamera from "../../components/MyCamera/MyCamera";
import { DataContext } from "../../context/DataContext";
import { Lobby } from "../Lobby/Lobby";

export const JoinRoom = () => {
  const { webcamIsOn, mirrorCamera, setMirrorCamera } = useContext(DataContext);

  const [ws, setWs] = useState(null);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [players, setPlayers] = useState([]);
  const [readyCount, setReadyCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [role, setRole] = useState("player");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);

  const wsRef = useRef(null);
  const playerIdRef = useRef(null);

  // ==========================
  // 🛰 Подключение к серверу
  // ==========================
  useEffect(() => {
    if(wsRef.current) return

    const socket = new WebSocket("ws://87.228.76.59:5000");
    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      console.log("🔗 Подключено к серверу");
      setConnected(true);
      setError("");
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      console.log("📨 Сообщение:", data);

      switch (data.type) {
        case "joined_as_host":
          setRole("host");
          playerIdRef.current = data.id;
          setJoined(true);
          break;

        case "joined_as_player":
          setRole("player");
          playerIdRef.current = data.id;
          setJoined(true);
          break;

        case "players_update":
          setPlayers(data.players);
          setReadyCount(data.readyCount || 0);
          // Если игра уже началась и пользователь вошел, переводим в лобби
          if (data.gameStarted && joined) {
            setGameStarted(true);
          }
          break;

        case "game_started":
          console.log("🎮 Игра началась!");
          setGameStarted(true);
          // Отправляем настройки зеркалирования после начала игры
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && joined) {
            wsRef.current.send(
              JSON.stringify({ 
                type: "set_mirror_camera", 
                mirror: mirrorCamera 
              })
            );
          }
          break;

        case "game_reset":
          console.log("🔄 Игра сброшена");
          setGameStarted(false);
          setReady(false);
          break;

        case "kicked":
          console.log("🚪 Вы были кикнуты администратором. Перезагрузка страницы...");
          window.location.reload();
          break;

        case "error":
          setError(data.message);
          break;

        case "host_left":
          console.log("⚠️ Ведущий покинул игру");
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log("⚠️ Соединение закрыто");
      setConnected(false);
    };

    socket.onerror = (e) => {
      console.error("❌ Ошибка WebSocket:", e);
      setConnected(false);
    };

    // Cleanup функция - закрываем соединение при размонтировании компонента
    return () => {
      console.log("🔌 Размонтирование JoinRoom, закрываем WebSocket соединение");
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, []);

  // ==========================
  // 📤 Отправка имени игрока (используется только при нажатии "Готов")
  // ==========================
  // Функция sendName удалена - никнейм теперь отправляется только при нажатии "Готов"

  // ==========================
  // 🚦 Готов / не готов
  // ==========================
  const handleReady = (e) => {
    e.preventDefault();
    if (!name.trim() || !connected) {
      setError("Введите никнейм и дождитесь подключения");
      return;
    }

    const playerName = name.trim();
    
    // Если пользователь еще не вошел (не отправил никнейм), отправляем его сначала
    if (!joined && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join", name: playerName }));
      localStorage.setItem("playerName", playerName);
    } else if (joined && !ready && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Если игрок отменяет готовность, можно обновить никнейм
      wsRef.current.send(JSON.stringify({ type: "join", name: playerName }));
      localStorage.setItem("playerName", playerName);
    }

    // Затем отправляем статус готовности
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "set_ready", ready: !ready })
      );
      setReady(!ready);
    }
  };

  // ==========================
  // 🪞 Отправка настроек зеркалирования на сервер
  // ==========================
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && joined) {
      wsRef.current.send(
        JSON.stringify({ 
          type: "set_mirror_camera", 
          mirror: mirrorCamera 
        })
      );
    }
  }, [mirrorCamera, joined]);

  // ==========================
  // 🕹 Переход в лобби
  // ==========================
  // Переходим в лобби если:
  // 1. Игра началась И пользователь вошел в игру (joined)
  // ИЛИ
  // 2. Игра началась И пользователь готов (ready) - для тех кто заходит во время игры
  const shouldShowLobby = gameStarted && (joined || ready);

  // ==========================
  // 🧱 Интерфейс
  // ==========================

  return (
    <>
    {!shouldShowLobby ? <div className="join-room">
      <div className="actions-block">
        <h2>{readyCount} / {players.length || 0}</h2>
        <p>
          Игроков: {players.filter(p => p.role === "player").length}/3 |
          Ведущий: {players.some(p => p.role === "host") ? "✅" : "❌"}
        </p>
        <h3>{name ? name : "Введите никнейм"}</h3>

        {error && <div className="error-message">{error}</div>}
        {!connected && <div className="connection-status">Подключение к серверу...</div>}
        {connected && !joined && <div className="connection-status">Введите никнейм чтобы присоединиться</div>}

        <div className="actions-main-block">
          <div className="webcam-container">
            <div className="webcam">
              {/* 🎥 Камера игрока (у ведущего не отображается) */}
              {role !== "host" ? (
                <>
                  <MyCamera className="webcamera" />
                  <div className="webcam-controls">
                    <label className="mirror-toggle">
                      <input
                        type="checkbox"
                        checked={mirrorCamera}
                        onChange={(e) => setMirrorCamera(e.target.checked)}
                      />
                      <span>Отзеркалить камеру</span>
                    </label>
                  </div>
                  {webcamIsOn ? (
                    <strong className="webcam-is-on">Ваша вебкамера работает ✅</strong>
                  ) : (
                    <strong>Вебкамера не работает ❌</strong>
                  )}
                </>
              ) : (
                <div className="host-placeholder">
                  🎙 Ведущий — без камеры
                </div>
              )}
            </div>

            <form onSubmit={handleReady} className="username" spellCheck="false">
              <strong>Введите никнейм</strong>
              <div className={`input-area ${ready ? "ready" : ""}`}>
                <input
                  disabled={ready}
                  className="usernam-input"
                  maxLength={24}
                  type="text"
                  placeholder="Никнейм"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleReady(e);
                    }
                  }}
                  />
              </div>

              <button
                style={{ borderColor: ready ? "green" : "red" }}
                className="ready-button"
                >
                {ready ? "Отменить ❌" : "Готов ✅"}
              </button>

              <Link className="back-to-menu" to={"/home"}>
                <button className="back-to-menu">Вернуться на главную</button>
              </Link>
            </form>
          </div>

          <div
            className="players-list"
            style={{ borderColor: gameStarted ? "#366444" : "#4a2525ff" }}
            >
            <h4>Игроки в лобби:</h4>
            <ul>
              {players.length > 0 ? (
                players.map((p) => (
                  <li key={p.id} className={`player-list-item ${p.role === "player" && p.ready ? "ready" : ""} ${p.role === "host" ? "host" : ""}`}>
                    <div className="player-list-info">
                      {p.role === "player" ? (
                        <div className="player-meta">
                          <span>{p.name}</span>
                        </div>
                      ) : (
                        <div className="player-meta">
                          🎙 {p.name}
                        </div>
                      )}
                    </div>
                  </li>
                ))
              ) : (
                <li>Лобби пустое</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div> : <Lobby ws={ws} players={players} playerId={playerIdRef.current} />}
    </>
  );
};
