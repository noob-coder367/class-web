import { AuthProvider } from './context/AuthContext.jsx'
import HomePage from './pages/HomePage.jsx'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <HomePage />
    </AuthProvider>
  )
}
