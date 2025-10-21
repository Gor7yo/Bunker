import './App.css'
import { AppRoutes } from './AppRoutes/AppRoutes'
import { useEffect } from 'react';
import { useContext } from 'react';
import { DataContext } from './context/DataContext';

function App() {

  const { modalIsOpen, setModalIsOpen } = useContext(DataContext)

  const toggleCashback = () => setModalIsOpen((prev) => !prev);
  useEffect(() => {
    document.body.style.overflow = modalIsOpen ? "hidden" : "auto";
    document.addEventListener("click", (e) => {
      if(!modalIsOpen) return


      if (e.target.classList.contains("dropdown")) {
        setModalIsOpen(false);
      }
    });
  }, [modalIsOpen]);

  return (
    <>
      <AppRoutes toggleCashback={toggleCashback}/>
    </>
  )
}

export default App
