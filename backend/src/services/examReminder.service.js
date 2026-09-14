/**
 * Scheduler nhắc bài kiểm tra (Asia/Ho_Chi_Minh).
 *
 * Logic cũ khi LPHT đăng báo bài vẫn giữ nguyên:
 *   - Tạo thông báo "ngày mai / hôm nay / ngày dd/mm" ngay lúc đăng
 *   - Push lần đầu + hết hạn 00:00 ngày hôm sau
 *
 * Thêm trên logic cũ:
 *   - 00:00 ngày kiểm tra → đẩy THÊM 1 thông báo "hôm nay kiểm tra"
 *     (thay bài "ngày mai" trên bảng Thông báo chung bằng bài mới)
 *   - 17:00 ngày kiểm tra → xóa thông báo kiểm tra khỏi Thông báo chung
 *     (không xóa báo bài trong tab Bài tập)
 */

import * as homeworkService from './homework.service.js'
import * as announcementsService from './announcements.service.js'

const TZ = 'Asia/Ho_Chi_Minh'
const CLEAR_MINUTES = 17 * 60

/** Tránh gửi trùng trong cùng 1 ngày (in-memory, đủ khi 1 process). */
const firedKeys = new Set()
let ticking = false

function vnParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type) => parts.find((p) => p.type === type)?.value || ''
  const y = get('year')
  const m = get('month')
  const d = get('day')
  let hour = Number(get('hour'))
  const minute = Number(get('minute'))
  // Một số ICU trả 24:00 thay vì 00:00 lúc nửa đêm
  if (hour === 24) hour = 0
  return {
    dateISO: `${y}-${m}-${d}`,
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
  }
}

function createdDateVN(iso) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return null
  return vnParts(t).dateISO
}

/** 17:00 VN ngày kiểm tra → lúc xóa khỏi bảng thông báo. */
function examBoardClearISO(examDateISO) {
  const [y, m, d] = String(examDateISO).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 10, 0, 0)).toISOString()
}

function buildTodayExamContent({ subject, examContent }) {
  const subjectPart = subject ? ` môn ${subject}` : ''
  let text = `🚨 Bạn có bài kiểm tra${subjectPart} vào hôm nay!`
  if (examContent) text += `\n\n${examContent}`
  return text
}

async function sendTodayReminder(hw) {
  const content = buildTodayExamContent({
    subject: hw.exam_subject,
    examContent: hw.exam_content,
  })
  const profile = {
    id: hw.created_by || null,
    username: hw.created_by_name || 'Hệ thống',
  }

  const ann = await announcementsService.createExamReminderAnnouncement(
    {
      content,
      expires_at: examBoardClearISO(hw.exam_date),
      source_homework_id: hw.id,
    },
    profile
  )

  const oldId = hw.exam_announcement_id
  if (oldId && oldId !== ann?.id) {
    await announcementsService.deleteAnnouncement(oldId).catch(() => {})
  }

  await homeworkService.patchHomework(hw.id, {
    exam_announcement_id: ann?.id || oldId || null,
    exam_today_notified_at: new Date().toISOString(),
  })

  console.log(
    `[examReminder] 00:00 ${hw.exam_date}: đã đẩy thông báo hôm nay cho "${hw.exam_subject || hw.title}" (${hw.id})`
  )
  return ann
}

async function clearExamAnnouncement(hw) {
  let deleted = 0
  try {
    const result = await announcementsService.deleteExamRemindersByHomeworkId(hw.id)
    deleted += result?.deleted || 0
  } catch (err) {
    console.warn('[examReminder] xóa theo homework id thất bại:', err?.message || err)
  }

  if (hw.exam_announcement_id) {
    try {
      await announcementsService.deleteAnnouncement(hw.exam_announcement_id)
      deleted += 1
    } catch {
      /* đã xóa ở bước trên, hoặc không còn */
    }
  }

  await homeworkService.patchHomework(hw.id, {
    exam_announcement_id: null,
    exam_cleared_at: new Date().toISOString(),
  })

  console.log(
    `[examReminder] 17:00 ${hw.exam_date}: đã gỡ thông báo kiểm tra khỏi bảng chung cho "${hw.exam_subject || hw.title}" (deleted≈${deleted})`
  )
}

/**
 * Tick mỗi ~30s.
 * Trước 17:00 ngày kiểm tra: đẩy thông báo "hôm nay" (1 lần).
 * Từ 17:00: xóa thông báo kiểm tra khỏi Thông báo chung (1 lần).
 */
export async function tickExamReminder() {
  if (ticking) return
  ticking = true
  try {
    const now = vnParts()
    const items = await homeworkService.listHomework()
    const examsToday = items.filter((row) => row.has_exam && row.exam_date === now.dateISO)
    if (!examsToday.length) return

    if (now.totalMinutes < CLEAR_MINUTES) {
      for (const hw of examsToday) {
        const key = `today-${hw.id}-${now.dateISO}`
        if (hw.exam_today_notified_at || firedKeys.has(key)) continue
        firedKeys.add(key)
        const createdDay = createdDateVN(hw.created_at)
        // Đăng trong ngày kiểm tra: lúc đăng đã push "hôm nay" — không đẩy trùng.
        if (createdDay === now.dateISO) {
          await homeworkService.patchHomework(hw.id, {
            exam_today_notified_at: new Date().toISOString(),
          })
          continue
        }
        try {
          await sendTodayReminder(hw)
        } catch (err) {
          firedKeys.delete(key)
          console.warn('[examReminder] đẩy thông báo hôm nay thất bại:', err?.message || err)
        }
      }
      return
    }

    // 17:00 trở đi: gỡ khỏi Thông báo chung.
    // Bài đăng SAU 17h ngày kiểm tra để logic cũ (hết hạn 0h hôm sau) xử lý.
    for (const hw of examsToday) {
      const key = `clear-${hw.id}-${now.dateISO}`
      if (hw.exam_cleared_at || firedKeys.has(key)) continue
      const created = vnParts(new Date(hw.created_at))
      if (created.dateISO === now.dateISO && created.totalMinutes >= CLEAR_MINUTES) continue
      firedKeys.add(key)
      try {
        await clearExamAnnouncement(hw)
      } catch (err) {
        firedKeys.delete(key)
        console.warn('[examReminder] gỡ thông báo 17h thất bại:', err?.message || err)
      }
    }

    if (firedKeys.size > 40) {
      const arr = [...firedKeys]
      arr.slice(0, arr.length - 20).forEach((k) => firedKeys.delete(k))
    }
  } catch (err) {
    console.warn('[examReminder] tick lỗi:', err?.message || err)
  } finally {
    ticking = false
  }
}

let intervalHandle = null

/** Khởi động scheduler (gọi 1 lần khi server start). */
export function startExamReminderScheduler() {
  if (intervalHandle) return
  tickExamReminder()
  intervalHandle = setInterval(tickExamReminder, 30 * 1000)
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref()
  console.log(
    '[examReminder] scheduler đã bật (00:00 đẩy thông báo hôm nay + 17:00 xóa khỏi Thông báo chung, TZ Asia/Ho_Chi_Minh)'
  )
}
