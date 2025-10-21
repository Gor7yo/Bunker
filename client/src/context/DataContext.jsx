import { useState } from "react";
import { useRef } from "react";
import { createContext } from "react";
import properties from '../data/properties.json'

export const DataContext = createContext()


export const DataProvider = ({ children }) => {
	
	// joinroom
	const inputUsernameRef = useRef(null)
	const [webcamIsOn, setWebcamIsOn] = useState(false)
  const [modalIsOpen, setModalIsOpen] = useState(false);

	// admin panel
	const [roomIsCreated, setRoomIsCreated] = useState(false)

	const { propertiesCategory } = properties
	

	return (
		<DataContext.Provider value={{inputUsernameRef, webcamIsOn, setWebcamIsOn, modalIsOpen, setModalIsOpen, roomIsCreated, setRoomIsCreated, propertiesCategory}}>
			{children}
		</DataContext.Provider>
	)
}