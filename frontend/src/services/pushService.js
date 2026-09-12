import { apiClient } from './apiClient.js'

const PROMPT_KEY = 'classweb_push_prompted_v1'
const ENABLED_KEY = 'classweb_push_enabled_v1'

export function hasPromptedPermission() {
  return localStorage.getItem(PROMPT_KEY) === '1'
}

export function markPrompted() {
  localStorage.setItem(PROMPT_KEY, '1')
}

export function isPushEnabledPref() {
  return localStorage.getItem(ENABLED_KEY) !== '0'
}

export function setPushEnabledPref(on) {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0')
}

export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  return reg
}

export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Trình duyệt không hỗ trợ Web Push.')
  }
  const { publicKey } = await apiClient.get('/push/vapid-public-key')
  if (!publicKey) throw new Error('Server chưa cấu hình VAPID key.')

  const reg = await registerServiceWorker()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  await apiClient.post(
    '/push/subscribe',
    { subscription: sub.toJSON() },
    { auth: true }
  )
  setPushEnabledPref(true)
  return sub
}

export async function unsubscribePush() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    try {
      await apiClient.post('/push/unsubscribe', { endpoint }, { auth: true })
    } catch {
      /* ignore */
    }
  }
  setPushEnabledPref(false)
}

export async function requestPermissionAndSubscribe() {
  markPrompted()
  if (typeof Notification === 'undefined') {
    throw new Error('Trình duyệt không hỗ trợ thông báo.')
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    setPushEnabledPref(false)
    throw new Error('Bạn đã từ chối quyền thông báo.')
  }
  return subscribePush()
}
