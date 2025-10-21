// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 5000 }, () =>
  console.log("✅ Сервер запущен на порту 5000")
);

const MAX_PLAYERS = 3; // Увеличил до 8
let allPlayers = [];
let host = null;
let gameState = { started: false };

// ============================
// 📡 Функция отправки всем клиентам
// ============================
function broadcast(data, excludeWs = null) {
  const msg = JSON.stringify(data);
  const clients = [...allPlayers, host].filter(p => p && p.readyState === WebSocket.OPEN);
  
  clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (error) {
        console.error("❌ Ошибка отправки:", error);
      }
    }
  });
}

// ============================
// 🔁 Отправка актуального списка игроков всем
// ============================
function sendPlayersUpdate() {
  const activePlayers = allPlayers.filter(p => p.readyState === WebSocket.OPEN);
  const activeHost = host && host.readyState === WebSocket.OPEN ? host : null;

  const playersList = [...activePlayers];
  if (activeHost) {
    playersList.push(activeHost);
  }

  const readyCount = playersList.filter((p) => p.ready).length;
  const totalPlayers = playersList.length;

  console.log("📤 Игроков онлайн:", activePlayers.length, "Готовых:", readyCount);

  broadcast({
    type: "players_update",
    players: playersList.map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      role: p.role,
    })),
    readyCount,
    totalPlayers,
    regularPlayers: activePlayers.length,
    maxRegularPlayers: MAX_PLAYERS,
    hostConnected: !!activeHost,
    hostReady: activeHost ? activeHost.ready : false,
    gameStarted: gameState.started
  });
}

// ============================
// ✅ Проверяем: все ли готовы, и можно ли стартовать
// ============================
function checkAllReady() {
  const activePlayers = allPlayers.filter(p => p.readyState === WebSocket.OPEN);
  const activeHost = host && host.readyState === WebSocket.OPEN ? host : null;

  if (!activeHost || !activeHost.ready) {
    gameState.started = false;
    return;
  }

  const playersList = [...activePlayers, activeHost];
  const allReady = playersList.length > 1 && playersList.every((p) => p.ready);

  if (allReady && !gameState.started) {
    gameState.started = true;
    console.log("🎮 Игра началась! Устанавливаем WebRTC соединения...");
    broadcast({ 
      type: "game_started",
      message: "Игра начинается! Устанавливаем видеосвязь..."
    });
    
    // Даем время на установку WebRTC соединений
    setTimeout(() => {
      broadcast({
        type: "game_message", 
        message: "Проверьте видео и аудио соединения"
      });
    }, 3000);
  }
}

// ============================
// 🎯 Отправка сообщения конкретному игроку
// ============================
function sendToPlayer(playerId, data) {
  const allConnections = [...allPlayers, host];
  const targetPlayer = allConnections.find(p => p && p.id === playerId && p.readyState === WebSocket.OPEN);
  
  if (targetPlayer) {
    try {
      targetPlayer.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`❌ Ошибка отправки игроку ${playerId}:`, error);
      return false;
    }
  }
  return false;
}

// ============================
// 🧠 Обработка нового подключения
// ============================
wss.on("connection", (ws) => {
  ws.id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  ws.name = null;
  ws.role = "player";
  ws.ready = false;

  console.log("🔌 Новое подключение:", ws.id);

  // Приветственное сообщение
  ws.send(JSON.stringify({
    type: "welcome",
    yourId: ws.id,
    message: "Подключение установлено"
  }));

  // Отправляем текущее состояние
  sendPlayersUpdate();

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        // 👋 Игрок вошёл
        case "join": {
          const nickname = (data.name || "").trim();
          
          if (!nickname) {
            ws.send(JSON.stringify({ type: "error", message: "Введите никнейм" }));
            return;
          }

          if (nickname.length > 24) {
            ws.send(JSON.stringify({ type: "error", message: "Никнейм слишком длинный" }));
            return;
          }

          // Если у игрока уже есть имя
          if (ws.name) {
            if (ws.name !== nickname) {
              ws.name = nickname;
              sendPlayersUpdate();
            }
            return;
          }

          // Проверка на дубликаты имен
          const activePlayers = [...allPlayers, host].filter(p => p && p.readyState === WebSocket.OPEN);
          const existingPlayer = activePlayers.find(p => p.name && p.name.toLowerCase() === nickname.toLowerCase());
          
          if (existingPlayer) {
            ws.send(JSON.stringify({ type: "error", message: "Никнейм уже занят" }));
            return;
          }

          ws.name = nickname;

          // 🎙 Ведущий
          if (["millisana", "admin", "host", "ведущий"].includes(nickname.toLowerCase())) {
            if (host && host.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "error", message: "Ведущий уже есть" }));
              return;
            }
            
            ws.role = "host";
            host = ws;
            console.log(`🎙 Ведущий: ${ws.name}`);
            
            ws.send(JSON.stringify({ 
              type: "joined_as_host", 
              id: ws.id 
            }));
            
          } else {
            // 👤 Обычный игрок
            const activeRegularPlayers = allPlayers.filter(p => p.readyState === WebSocket.OPEN);
            
            if (activeRegularPlayers.length >= MAX_PLAYERS) {
              ws.send(JSON.stringify({ 
                type: "error", 
                message: `Лобби заполнено (максимум ${MAX_PLAYERS} игроков)` 
              }));
              return;
            }

            allPlayers.push(ws);
            console.log(`👤 Игрок: ${ws.name}`);
            
            ws.send(JSON.stringify({ 
              type: "joined_as_player", 
              id: ws.id 
            }));
          }

          sendPlayersUpdate();
          
          // Уведомляем о новом игроке для инициации WebRTC
          broadcast({
            type: "new_player_joined",
            playerId: ws.id,
            playerName: ws.name
          }, ws);
          
          break;
        }

        // ✅ Игрок нажал "готов"
        case "set_ready": {
          if (!ws.name) {
            ws.send(JSON.stringify({ type: "error", message: "Сначала введите никнейм" }));
            return;
          }

          ws.ready = data.ready;
          console.log(`✅ ${ws.name}: ${data.ready ? 'готов' : 'не готов'}`);

          ws.send(JSON.stringify({
            type: "ready_status",
            ready: data.ready
          }));

          sendPlayersUpdate();
          checkAllReady();
          break;
        }

        // 📊 Запрос текущего состояния лобби
        case "get_lobby_state": {
          sendPlayersUpdate();
          break;
        }

        // 🔄 Сброс состояния игры
        case "reset_game": {
          if (ws.role === "host") {
            gameState.started = false;
            allPlayers.forEach(p => p.ready = false);
            if (host) host.ready = false;
            
            broadcast({
              type: "game_reset",
              message: "Игра сброшена"
            });
            
            sendPlayersUpdate();
          }
          break;
        }

        // 📡 WebRTC сигналы - УЛУЧШЕННАЯ ВЕРСИЯ
        case "signal": {
          if (!data.targetId || !data.signal) {
            ws.send(JSON.stringify({ type: "error", message: "Неверный сигнал" }));
            return;
          }

          // Находим целевого игрока
          const targetPlayer = [...allPlayers, host].find(p => 
            p && p.id === data.targetId && p.readyState === WebSocket.OPEN
          );
          
          if (!targetPlayer) {
            console.log(`❌ Целевой игрок ${data.targetId} не найден`);
            ws.send(JSON.stringify({ type: "error", message: "Игрок не в сети" }));
            return;
          }

          // Пересылаем сигнал с дополнительной информацией
          const success = sendToPlayer(data.targetId, {
            type: "signal",
            fromId: ws.id,
            fromName: ws.name,
            signal: data.signal,
            timestamp: Date.now()
          });

          if (success) {
            const signalType = data.signal.type || 'ice-candidate';
            console.log(`📡 ${signalType} от ${ws.name} к ${targetPlayer.name}`);
          }
          break;
        }

        // 🔍 Запрос на переустановку WebRTC соединений
        case "refresh_connections": {
          console.log(`🔄 ${ws.name} запросил обновление WebRTC соединений`);
          broadcast({
            type: "refresh_connections_request",
            from: ws.id
          }, ws);
          break;
        }

        // 💬 Чат сообщения
        case "chat_message": {
          if (data.message) {
            broadcast({
              type: "chat_message",
              from: ws.id,
              fromName: ws.name,
              message: data.message,
              timestamp: Date.now()
            }, ws);
          }
          break;
        }

        default:
          ws.send(JSON.stringify({ type: "error", message: "Неизвестная команда" }));
      }
    } catch (error) {
      console.error("❌ Ошибка обработки сообщения:", error);
      ws.send(JSON.stringify({ type: "error", message: "Ошибка сервера" }));
    }
  });

  // ❌ Отключение клиента
  ws.on("close", () => {
    console.log(`❌ Отключился: ${ws.name || 'Unknown'} (${ws.role})`);
    
    if (ws.role === "player") {
      allPlayers = allPlayers.filter((p) => p !== ws);
    } else if (ws.role === "host") {
      host = null;
      broadcast({ 
        type: "host_left",
        message: "Ведущий вышел из игры"
      });
    }

    // Уведомляем об отключении игрока
    broadcast({
      type: "player_left",
      playerId: ws.id,
      playerName: ws.name
    });

    sendPlayersUpdate();
  });

  ws.on("error", (error) => {
    console.error(`💥 Ошибка: ${ws.name || ws.id}`, error);
  });
});

console.log("🚀 Сервер 'Бункер' готов для 8 игроков!");