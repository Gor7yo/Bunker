import { useRef, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import "./ActiveGame.css";

export const ActiveGame = () => {
  const [players, setPlayers] = useState([]);
  const [host, setHost] = useState(null);
  const [connected, setConnected] = useState(false);
  const [gamePhase, setGamePhase] = useState("waiting"); // waiting, playing, finished
  const wsRef = useRef(null);

  // ============================
  // 🛰 Подключаемся к серверу
  // ============================
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:5000");
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("🔗 Подключено к серверу в игре");
      setConnected(true);
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      console.log("📨 Получено сообщение в игре:", data);

      switch (data.type) {
        case "players_update":
          const regularPlayers = data.players.filter(p => p.role === "player");
          const hostPlayer = data.players.find(p => p.role === "host");
          
          setPlayers(regularPlayers);
          setHost(hostPlayer);
          break;

        case "game_phase_change":
          setGamePhase(data.phase);
          break;

        case "error":
          console.error("Ошибка сервера:", data.message);
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log("⚠️ Соединение закрыто в игре");
      setConnected(false);
    };

    socket.onerror = (error) => {
      console.error("❌ Ошибка WebSocket в игре:", error);
      setConnected(false);
    };

    return () => socket.close();
  }, []);

  // ============================
  // 🧱 Интерфейс
  // ============================
  return (
    <div className="active-game">
      <div className="game-header">
        <h1>🎮 Активная игра</h1>
        <div className="game-status">
          <h2>Фаза игры: {gamePhase}</h2>
          <div className="connection-status">
            {connected ? "✅ Подключено" : "❌ Не подключено"}
          </div>
        </div>
      </div>

      <div className="game-content">
        <div className="players-section">
          <h3>Игроки ({players.length})</h3>
          <div className="players-list">
            {players.map((player) => (
              <div key={player.id} className="player-item">
                <span className="player-name">{player.name}</span>
                <span className="player-status">
                  {player.ready ? "✅" : "⏳"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="game-area">
          <div className="game-board">
            <h3>Игровое поле</h3>
            <p>Здесь будет игровая логика</p>
          </div>
        </div>
      </div>
    </div>
  );
};
