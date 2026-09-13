/**
 * Web Push nhắc lịch trực vệ sinh.
 * - 17:00 (Asia/Ho_Chi_Minh) ngày hôm trước → nhắc người trực ngày mai
 * - 05:45 sáng đúng ngày trực → nhắc lần nữa
 * Mức độ: khẩn cấp (urgency high).
 * Click noti → /#/classroom/cleaning-duty
 */

import { supabaseAdmin } from '../config/supabaseClient.js'
import * as cleaningDutyService from './cleaningDuty.service.js'
import * as pushService from './push.service.js'

const TZ = 'Asia/Ho_Chi_Minh'
const CLEANING_URL = '/#/classroom/cleaning-duty'

/** Tránh gửi trùng trong cùng 1 phút/slot (in-memory, đủ khi 1 process). */
const firedKeys = new Set()

function nowInVN() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date())

  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  const y = get('year')
  const m = get('month')
  const d = get('day')
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  const weekday = get('weekday') // Mon, Tue, ... Sun

  return {
    dateISO: `${y}-${m}-${d}`,
    hour,
    minute,
    weekday,
    totalMinutes: hour * 60 + minute,
  }
}

function addDaysISO(dateISO, delta) {
  const d = new Date(`${dateISO}T12:00:00+07:00`)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateVN(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}

/** Lấy danh sách username được phân công trực cho 1 ngày ISO. */
async function getAssigneesForDate(dateISO) {
  const dayId = cleaningDutyService.DAY_IDS[
    (() => {
      const d = new Date(`${dateISO}T12:00:00+07:00`)
      const day = d.getDay() // 0=CN ... 6=T7
      if (day === 0) return -1
      return day - 1 // 1→0 (t2), ... 6→5 (t7)
    })()
  ]
  if (!dayId) return { dayId: null, assignees: [], weekStart: null }

  const weekStart = cleaningDutyService.getWeekStart(dateISO)
  const weekStartISO = (() => {
    const d = weekStart
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })()

  const schedule = await cleaningDutyService.getSchedule(weekStartISO)
  const assignees = schedule?.days?.[dayId]?.assignees || []
  return { dayId, assignees, weekStart: weekStartISO }
}

/** Map username → profile id (chỉ user đã đăng ký). */
async function resolveUserIdsByUsernames(usernames) {
  const names = [...new Set((usernames || []).map((n) => String(n).trim()).filter(Boolean))]
  if (!names.length) return []

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username')
    .in('username', names)

  if (error) {
    console.warn('[cleaningDutyPush] resolve users:', error.message)
    return []
  }

  return (data || []).map((row) => String(row.id)).filter(Boolean)
}

async function sendReminder({ dutyDateISO, kind }) {
  const { assignees } = await getAssigneesForDate(dutyDateISO)
  if (!assignees.length) {
    console.log(`[cleaningDutyPush] ${kind} ${dutyDateISO}: không có ai được phân công — bỏ qua.`)
    return { sent: 0 }
  }

  const userIds = await resolveUserIdsByUsernames(assignees)
  if (!userIds.length) {
    console.log(
      `[cleaningDutyPush] ${kind} ${dutyDateISO}: có ${assignees.length} tên nhưng không map được userId.`
    )
    return { sent: 0 }
  }

  const dateLabel = formatDateVN(dutyDateISO)
  const isEve = kind === 'eve'
  const title = isEve ? '🧹 Nhắc lịch trực vệ sinh (ngày mai)' : '🧹 Đến giờ trực vệ sinh'
  const body = isEve
    ? `Bạn có lịch trực vệ sinh vào ngày mai (${dateLabel}). Chuẩn bị sẵn sàng nhé!`
    : `Hôm nay (${dateLabel}) đến lượt bạn trực vệ sinh lớp. Vào tab Vệ sinh lớp để xem chi tiết.`

  const result = await pushService.sendPushNotification(
    {
      title,
      body,
      url: CLEANING_URL,
      tag: `cleaning-duty-${kind}-${dutyDateISO}`,
      urgency: 'high',
      requireInteraction: true,
      data: {
        type: 'cleaning-duty-reminder',
        kind,
        dutyDate: dutyDateISO,
        tab: 'cleaning-duty',
      },
    },
    { userIds }
  )

  console.log(
    `[cleaningDutyPush] ${kind} ${dutyDateISO}: gửi tới ${userIds.length} user, sent=${result.sent}`
  )
  return result
}

/**
 * Kiểm tra giờ VN và bắn push nếu đúng slot.
 * Gọi định kỳ mỗi ~30–60 giây từ server.
 */
export async function tickCleaningDutyPush() {
  try {
    const now = nowInVN()

    // 17:00 → nhắc người trực NGÀY MAI (bỏ qua Chủ nhật: ngày mai nếu là CN thì không có lịch)
    if (now.hour === 17 && now.minute === 0) {
      const tomorrow = addDaysISO(now.dateISO, 1)
      const key = `eve-${tomorrow}`
      if (!firedKeys.has(key)) {
        firedKeys.add(key)
        // Chỉ giữ ~3 ngày keys gần nhất
        if (firedKeys.size > 20) {
          const arr = [...firedKeys]
          arr.slice(0, arr.length - 10).forEach((k) => firedKeys.delete(k))
        }
        await sendReminder({ dutyDateISO: tomorrow, kind: 'eve' })
      }
    }

    // 05:45 → nhắc người trực HÔM NAY
    if (now.hour === 5 && now.minute === 45) {
      const key = `morn-${now.dateISO}`
      if (!firedKeys.has(key)) {
        firedKeys.add(key)
        if (firedKeys.size > 20) {
          const arr = [...firedKeys]
          arr.slice(0, arr.length - 10).forEach((k) => firedKeys.delete(k))
        }
        await sendReminder({ dutyDateISO: now.dateISO, kind: 'morning' })
      }
    }
  } catch (err) {
    console.warn('[cleaningDutyPush] tick lỗi:', err?.message || err)
  }
}

let intervalHandle = null

/** Khởi động scheduler (gọi 1 lần khi server start). */
export function startCleaningDutyPushScheduler() {
  if (intervalHandle) return
  // Chạy ngay 1 lần (không gửi nếu không đúng giờ), rồi mỗi 30s
  tickCleaningDutyPush()
  intervalHandle = setInterval(tickCleaningDutyPush, 30 * 1000)
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref()
  console.log('[cleaningDutyPush] scheduler đã bật (17:00 hôm trước + 05:45 sáng ngày trực, TZ Asia/Ho_Chi_Minh)')
}
