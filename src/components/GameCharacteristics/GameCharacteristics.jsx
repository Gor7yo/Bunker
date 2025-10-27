import { useState, useEffect } from "react";
import "./GameCharacteristics.css";

export const GameCharacteristics = ({ ws, players, playerId, isHost }) => {
	const [playerCards, setPlayerCards] = useState({});

	// Обработка сообщений от сервера
	useEffect(() => {
		if (!ws) return;

		const handleMessage = (msg) => {
			try {
				const data = JSON.parse(msg.data);
				console.log("📨 Получено сообщение в GameCharacteristics:", data);

				switch (data.type) {
					case "player_cards":
						setPlayerCards(data.cards);
						break;

					case "characteristic_revealed":
						// Обновление обрабатывается через обновление players
						break;

					default:
						break;
				}
			} catch (error) {
				console.error("❌ Ошибка обработки сообщения в GameCharacteristics:", error);
			}
		};

		ws.addEventListener('message', handleMessage);
		return () => ws.removeEventListener('message', handleMessage);
	}, [ws]);

	// Раскрыть характеристику игрока
	const revealCharacteristic = (targetPlayerId, characteristicType) => {
		if (ws && isHost) {
			ws.send(JSON.stringify({
				type: "reveal_characteristic",
				playerId: targetPlayerId,
				characteristicType: characteristicType
			}));
		}
	};

	// Получить название категории на русском
	const getCategoryName = (category) => {
		const categoryNames = {
			bandage: "Багаж",
			actions: "Карта действия",
			fact: "Факт",
			fobia: "Фобия",
			health: "Здоровье",
			hobbie: "Хобби",
			age: "Возраст",
			proffesion: "Профессия"
		};
		return categoryNames[category] || category;
	};

	// Получить характеристику для отображения
	const getCharacteristicDisplay = (char) => {
		if (char.revealed) {
			return char.value;
		}
		return null; // Скрыто - показываем только категорию
	};

	const currentPlayer = players.find(p => p.id === playerId);
	
	// Если нет текущего игрока или характеристик, не показываем
	if (!currentPlayer || !currentPlayer.characteristics) {
		return null;
	}

	return (
		<div className="player-characteristics-container">
			<div className="characteristics-header">
				<h3>Мои характеристики</h3>
			</div>
			<div className="characteristics-list">
				{Object.entries(currentPlayer.characteristics).map(([category, char]) => (
					<div key={category} className="characteristic-item">
						<div className="category-name">{getCategoryName(category)}</div>
						{char.revealed && (
							<div className="characteristic-value">
								{char.value}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
};