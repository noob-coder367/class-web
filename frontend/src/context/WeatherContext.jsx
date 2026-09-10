import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react'
import { useAuth } from './AuthContext.jsx'

const WeatherContext = createContext(null)

const STORAGE_KEY = 'classweb_location_permission'
const WEATHER_POLL_MS = 5 * 60 * 1000

function mapWeatherCode(code, precipitation = 0) {
  if (code == null) return null
  if (code <= 1) return 'clear'
  if (code <= 3 || code === 45 || code === 48) return 'cloudy'
  if (code >= 95 && code <= 99) return 'thunderstorm'
  if (
    (code >= 51 && code <= 55) ||
    (code >= 61 && code <= 63) ||
    code === 80 ||
    code === 81
  ) {
    return precipitation > 2.5 ? 'heavy-rain' : 'light-rain'
  }
  if (code === 65 || code === 66 || code === 67 || code === 82) {
    return 'heavy-rain'
  }
  return 'cloudy'
}

async function fetchWeather(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=weather_code,precipitation,wind_speed_10m` +
    `&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather API error')
  const data = await res.json()
  const current = data.current || {}
  const condition = mapWeatherCode(
    current.weather_code,
    current.precipitation ?? 0
  )
  return {
    condition,
    weatherCode: current.weather_code,
    precipitation: current.precipitation ?? 0,
    windSpeed: current.wind_speed_10m ?? 0,
    fetchedAt: Date.now(),
  }
}

export function WeatherProvider({ children }) {
  const { session, authReady } = useAuth()
  const isLoggedIn = !!session?.user

  const [permission, setPermission] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [showPrompt, setShowPrompt] = useState(false)
  const [coords, setCoords] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (!authReady) return
    if (!isLoggedIn) {
      setShowPrompt(false)
      return
    }
    if (permission === 'granted' || permission === 'denied') return
    const t = setTimeout(() => setShowPrompt(true), 1200)
    return () => clearTimeout(t)
  }, [authReady, isLoggedIn, permission])

  useEffect(() => {
    if (!isLoggedIn) {
      setWeather(null)
      setShowPrompt(false)
    }
  }, [isLoggedIn])

  const savePermission = useCallback((value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {}
    setPermission(value)
    setShowPrompt(false)
  }, [])

  const handleAllow = useCallback(() => {
    if (!navigator.geolocation) {
      savePermission('denied')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lon: longitude })
        savePermission('granted')
        setLoading(false)
      },
      () => {
        savePermission('denied')
        setLoading(false)
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    )
  }, [savePermission])

  const handleDeny = useCallback(() => {
    savePermission('denied')
  }, [savePermission])

  /** Bật/tắt chia sẻ vị trí từ Cài đặt → Quyền riêng tư */
  const setLocationEnabled = useCallback(
    (enabled) => {
      if (!enabled) {
        // Tắt: xóa tọa độ, tắt weather, lưu denied
        setCoords(null)
        setWeather(null)
        savePermission('denied')
        return
      }
      // Bật lại: xin geolocation
      if (!navigator.geolocation) {
        savePermission('denied')
        return
      }
      setLoading(true)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          })
          savePermission('granted')
          setLoading(false)
        },
        () => {
          savePermission('denied')
          setLoading(false)
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 }
      )
    },
    [savePermission]
  )

  useEffect(() => {
    if (!isLoggedIn) return
    if (permission !== 'granted' || coords) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      () => {
        setWeather(null)
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 }
    )
  }, [isLoggedIn, permission, coords])

  useEffect(() => {
    if (!isLoggedIn || permission !== 'granted' || !coords) {
      if (!isLoggedIn) setWeather(null)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const data = await fetchWeather(coords.lat, coords.lon)
        if (!cancelled) setWeather(data)
      } catch (err) {
        console.warn('Không lấy được thời tiết:', err)
      }
    }

    load()
    pollRef.current = setInterval(load, WEATHER_POLL_MS)

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isLoggedIn, permission, coords])

  const activeCondition = isLoggedIn ? weather?.condition ?? null : null

  const value = {
    permission,
    showPrompt,
    weather,
    condition: activeCondition,
    loading,
    handleAllow,
    handleDeny,
    setLocationEnabled,
  }

  return (
    <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
  )
}

export function useWeather() {
  const ctx = useContext(WeatherContext)
  if (!ctx) throw new Error('useWeather phải dùng trong <WeatherProvider>')
  return ctx
}
