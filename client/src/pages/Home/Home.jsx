import { Link } from "react-router-dom"
import './Home.css'

export const Home = () => {



	return (
		<div className="home">
			<div className="home-page">
				<div className="title-block">
					<h2>Добро пожаловать в БУНКЕР!</h2>
				</div>
				<div className="home-page__main">
					<div className="main__block">
						<h4>Чтобы начать играть, дождитесь, пока Админ запустит комнату.</h4>
						<div className="main__actions">
							<Link to='/join-room'><button className="actions__join-game">Присоеденится</button></Link>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}