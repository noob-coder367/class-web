import { AuthProvider } from './context/AuthContext.jsx'
import { WeatherProvider } from './context/WeatherContext.jsx'
import HomePage from './pages/HomePage.jsx'
import OceanScrollBackground from './components/OceanScrollBackground.jsx'
import LocationPermissionModal from './components/LocationPermissionModal.jsx'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <WeatherProvider>
        <OceanScrollBackground />
        <HomePage />
        <LocationPermissionModal />
      </WeatherProvider>
    </AuthProvider>
  )
}
