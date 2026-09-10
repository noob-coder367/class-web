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
const WEATHER_POLL_MS = 5 * 60 * 1000 // 5 phút

/**
 * WMO weather code → trạng thái đơn giản
 * https://open-meteo.com/en/docs
 */
function mapWeatherCode(code, precipitation = 0) {
  if (code == null) return null
  // 0 Clear, 1 Mainly clear
  if (code <= 1) return 'clear'
  // 2 Partly cloudy, 3 Overcast, 45/48 Fog
  if (code <= 3 || code === 45 || code === 48) return 'cloudy'
  // Drizzle / light rain / light showers
  if (
    (code >= 51 && code <= 55) ||
    (code >= 61 && code <= 63) ||
    code === 80 ||
    code === 81
  ) {
    return precipitation > 2.5 ? 'heavy-rain' : 'light-rain'
  }
  // Heavy rain, thunderstorm, heavy showers
  if (
    code === 65 ||
    code === 66 ||
    code === 67 ||
    code === 82 ||
    (code >= 95 && code <= 99)
  ) {
    return 'heavy-rain'
  }
  // Snow / other → treat as cloudy for ocean theme
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
    condition, // 'clear' | 'cloudy' | 'light-rain' | 'heavy-rain' | null
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
      return localStorage.getItem(STORAGE_KEY) // 'granted' | 'denied' | null
    } catch {
      return null
    }
  })
  const [showPrompt, setShowPrompt] = useState(false)
  const [coords, setCoords] = useState(null)
  const [weather, setWeather] = useState(null) // { condition, ... }
  const [loading, setLoading] = useState(false)
  const pollRef = useRef(null)

  // Chỉ hỏi 1 lần sau khi auth sẵn sàng + đã đăng nhập + chưa từng trả lời
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

  // Đăng xuất → tắt hết hiệu ứng thời tiết, về ngày-đêm
  useEffect(() => {
    if (!isLoggedIn) {
      setWeather(null)
      setShowPrompt(false)
      // Không xóa permission / coords — lần login sau vẫn nhớ
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

  // Khi đã granted nhưng chưa có coords (reload trang) — chỉ khi đang login
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

  // Fetch + poll weather — chỉ khi đang login + granted + có coords
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

  // Chỉ trả condition khi đang đăng nhập — logout = nền ngày-đêm
  const activeCondition = isLoggedIn ? weather?.condition ?? null : null

  const value = {
    permission,
    showPrompt,
    weather,
    condition: activeCondition,
    loading,
    handleAllow,
    handleDeny,
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
