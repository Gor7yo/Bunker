import { Navigate, Route, Routes } from "react-router-dom"
import { Home } from "../pages/Home/Home"
import { JoinRoom } from "../pages/JoinRoom/JoinRoom"
import { NotFound } from "../pages/NotFound/NotFound"
import { Lobby } from "../pages/Lobby/Lobby"
import { AdminPanel } from "../pages/AdminPanel/AdminPanel"

export const AppRoutes = ({ toggleCashback }) => {
	return (
		<Routes>
			<Route path="/home" element={<Home />} />
			<Route path="/" element={<Navigate to={'/home'}/>} />
			<Route path="/join-room" element={<JoinRoom toggleCashback={toggleCashback} />} />
			<Route path="/lobby" element={<Lobby />} />
			<Route path="/admin-panel" element={<AdminPanel />} />
			<Route path="*" element={<NotFound />}/>
		</Routes>
	)
}