import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./AdminPanel.css";

export const AdminPanel = () => {
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  
  const wsRef = useRef(null);
  const playerIdRef = useRef(null);

  // ==========================
  // 🛰 Подключение к серверу
  // ==========================
  useEffect(() => {
    if (wsRef.current) return;

    // Определяем URL WebSocket (localhost для разработки или продакшн)
    const wsUrl = window.location.hostname === 'localhost' 
      ? 'ws://localhost:5000' 
      : 'wss://bunker-server.onrender.com';
    
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;
    setWs(socket);

    socket.onopen = () => {
      console.log("🔗 Подключено к серверу");
      setConnected(true);
      
      // Сразу отправляем запрос на вход как админ
      socket.send(JSON.stringify({ 
        type: "join", 
        name: "admin" 
      }));
    };

    socket.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        console.log("📨 Сообщение:", data);

        switch (data.type) {
          case "joined_as_player":
            playerIdRef.current = data.id;
            setJoined(true);
            setResetMessage("");
            break;

          case "players_update":
            setPlayers(data.players || []);
            setGameStarted(data.gameStarted || false);
            break;

          case "game_reset":
            setResetMessage("✅ Игра успешно сброшена!");
            setGameStarted(false);
            setResetConfirm(false);
            setTimeout(() => setResetMessage(""), 3000);
            break;

          case "error":
            setResetMessage(`❌ Ошибка: ${data.message}`);
            setTimeout(() => setResetMessage(""), 5000);
            break;

          default:
            break;
        }
      } catch (error) {
        console.error("❌ Ошибка парсинга сообщения:", error);
      }
    };

    socket.onclose = () => {
      console.log("⚠️ Соединение закрыто");
      setConnected(false);
      setJoined(false);
    };

    socket.onerror = (e) => {
      console.error("❌ Ошибка WebSocket:", e);
      setConnected(false);
    };

    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  // ==========================
  // 🔄 Сброс игры
  // ==========================
  const handleResetGame = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "reset_game" }));
      setResetMessage("⏳ Сброс игры...");
    } else {
      setResetMessage("❌ Нет соединения с сервером");
    }
  };

  // ==========================
  // 🧱 Интерфейс
  // ==========================
  return (
    <div className="admin-panel">
      <div className="admin-panel-container">
        <div className="admin-panel-header">
          <h1>🎛️ Панель администратора</h1>
          <Link to="/home" className="back-link">
            ← На главную
          </Link>
        </div>

        <div className="admin-panel-status">
          <div className={`status-item ${connected ? 'connected' : 'disconnected'}`}>
            <span className="status-icon">{connected ? '🟢' : '🔴'}</span>
            <span>{connected ? 'Подключено' : 'Не подключено'}</span>
          </div>
          
          {joined && (
            <div className="status-item">
              <span className="status-icon">👤</span>
              <span>Вошли как администратор</span>
            </div>
          )}

          <div className="status-item">
            <span className="status-icon">{gameStarted ? '🎮' : '⏸️'}</span>
            <span>{gameStarted ? 'Игра начата' : 'Игра не начата'}</span>
          </div>

          <div className="status-item">
            <span className="status-icon">👥</span>
            <span>Игроков онлайн: {players.length}</span>
          </div>
        </div>

        {resetMessage && (
          <div className={`reset-message ${resetMessage.includes('✅') ? 'success' : 'error'}`}>
            {resetMessage}
          </div>
        )}

        <div className="admin-panel-actions">
          <div className="action-card">
            <h2>🔄 Сброс игры</h2>
            <p>
              Завершает текущую игру и сбрасывает все карточки всех игроков.
              Все характеристики будут очищены.
            </p>
            
            {!resetConfirm ? (
              <button 
                className="reset-btn"
                onClick={handleResetGame}
                disabled={!connected || !joined || !gameStarted}
              >
                Сбросить игру
              </button>
            ) : (
              <div className="reset-confirm">
                <p className="confirm-text">⚠️ Вы уверены, что хотите сбросить игру?</p>
                <div className="confirm-buttons">
                  <button 
                    className="confirm-btn confirm-yes"
                    onClick={handleResetGame}
                  >
                    Да, сбросить
                  </button>
                  <button 
                    className="confirm-btn confirm-no"
                    onClick={() => setResetConfirm(false)}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {players.length > 0 && (
          <div className="players-list-section">
            <h2>👥 Игроки онлайн ({players.length})</h2>
            <div className="players-grid">
              {players.map((player) => (
                <div key={player.id} className="player-info-card">
                  <div className="player-info-header">
                    <span className="player-name">{player.name}</span>
                    <span className="player-role">
                      {player.role === 'host' ? '🎙 Ведущий' : '👤 Игрок'}
                    </span>
                  </div>
                  <div className="player-info-details">
                    <div className="player-status">
                      {player.ready ? '✅ Готов' : '⏳ Не готов'}
                    </div>
                    {player.characteristics && (
                      <div className="player-cards-info">
                        Раскрыто карт: {
                          Object.values(player.characteristics).filter(
                            char => char && char.revealed
                          ).length
                        } / {Object.keys(player.characteristics).length}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!connected && (
          <div className="connection-error">
            <p>⚠️ Не удалось подключиться к серверу.</p>
            <p>Проверьте, что сервер запущен.</p>
          </div>
        )}
      </div>
    </div>
  );
};