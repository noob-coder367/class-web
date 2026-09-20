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

/** Trình duyệt chưa cấp quyền thông báo → cần hiện bảng hỏi (mọi tài khoản). */
export function needsPushPrompt() {
  const perm = getNotificationPermission()
  return perm !== 'granted' && perm !== 'unsupported'
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

/**
 * Đồng bộ subscription thật (PushManager) với backend.
 * localStorage không phải nguồn sự thật — chỉ dùng để nhớ user đã tắt chủ động.
 */
export async function syncPushSubscription({ createIfMissing = true } = {}) {
  if (getNotificationPermission() !== 'granted') return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('[push] Trình duyệt không hỗ trợ Web Push / Service Worker.')
    return null
  }

  try {
    const { publicKey } = await apiClient.get('/push/vapid-public-key')
    if (!publicKey) {
      console.error('[push] Server chưa cấu hình VAPID key.')
      throw new Error('Server chưa cấu hình VAPID key.')
    }

    const reg = await registerServiceWorker()
    if (!reg?.pushManager) {
      console.error('[push] Không đăng ký được Service Worker.')
      throw new Error('Không đăng ký được Service Worker.')
    }

    let sub = await reg.pushManager.getSubscription()
    if (!sub && createIfMissing) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    if (!sub) return null

    await apiClient.post(
      '/push/subscribe',
      { subscription: sub.toJSON() },
      { auth: true }
    )
    setPushEnabledPref(true)
    return sub
  } catch (err) {
    console.error('[push] auto-sync thất bại:', err)
    throw err
  }
}

export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Trình duyệt không hỗ trợ Web Push.')
  }
  return syncPushSubscription({ createIfMissing: true })
}

export async function unsubscribePush() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) {
      setPushEnabledPref(false)
      return
    }
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      try {
        await apiClient.post('/push/unsubscribe', { endpoint }, { auth: true })
      } catch (err) {
        console.error('[push] hủy subscription trên server thất bại:', err)
      }
    }
  } catch (err) {
    console.error('[push] unsubscribe thất bại:', err)
    throw err
  } finally {
    setPushEnabledPref(false)
  }
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
