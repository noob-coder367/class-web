import { AuthProvider } from './context/AuthContext.jsx'
import HomePage from './pages/HomePage.jsx'
import OceanScrollBackground from './components/OceanScrollBackground.jsx'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <OceanScrollBackground />
      <HomePage />
    </AuthProvider>
  )
}
