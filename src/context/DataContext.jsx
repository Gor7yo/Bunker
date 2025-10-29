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
  const [mirrorCamera, setMirrorCamera] = useState(() => {
    // Загружаем из localStorage или по умолчанию false
    const saved = localStorage.getItem('mirrorCamera');
    return saved === 'true';
  });

	// admin panel
	const [roomIsCreated, setRoomIsCreated] = useState(false)

	const { propertiesCategory } = properties
	

	// Сохраняем зеркалирование в localStorage при изменении
	const handleSetMirrorCamera = (value) => {
		setMirrorCamera(value);
		localStorage.setItem('mirrorCamera', value.toString());
	};

	return (
		<DataContext.Provider value={{
			inputUsernameRef, 
			webcamIsOn, 
			setWebcamIsOn, 
			modalIsOpen, 
			setModalIsOpen, 
			roomIsCreated, 
			setRoomIsCreated, 
			propertiesCategory,
			mirrorCamera,
			setMirrorCamera: handleSetMirrorCamera
		}}>
			{children}
		</DataContext.Provider>
	)
}