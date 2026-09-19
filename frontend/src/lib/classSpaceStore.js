// Lưu trữ các "lớp học" (bộ câu hỏi) được tạo trong mục "Lớp học" của khu vực lớp.
// Cũng như phần Kho lưu trữ / Thêm câu hỏi (state chỉ ở client, không có API riêng),
// danh sách lớp học ở đây được lưu cục bộ bằng localStorage để giữ đúng kiến trúc
// hiện có của tính năng này, không cần đổi sang backend.

const KEY = 'classweb_class_space_v1'
const EVENT = 'classweb-class-space-updated'

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `cls-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch (err) {
    // Ảnh nền (blob url) khá nhẹ để lưu vì chỉ là chuỗi tham chiếu, nhưng vẫn
    // phòng trường hợp localStorage đầy hoặc bị chặn (chế độ ẩn danh...).
    console.warn('Không lưu được danh sách lớp học:', err?.message || err)
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** Danh sách lớp học, mới tạo lên trước. */
export function listClasses() {
  return [...read()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export function getClass(id) {
  if (!id) return null
  return read().find((c) => c.id === id) || null
}

export function createClass(data) {
  const list = read()
  const now = Date.now()
  const isPublic = data.isPublic !== false
  const record = {
    id: uid(),
    title: String(data.title || '').trim(),
    cover: data.cover || '',
    backdropType: data.backdropType || '',
    backdropTheme: data.backdropTheme || '',
    backdropImage: data.backdropImage || '',
    isPublic,
    password: isPublic ? '' : String(data.password || ''),
    shuffle: !!data.shuffle,
    allowRetry: data.allowRetry !== false,
    allowMultiTry: !!data.allowMultiTry,
    questions: Array.isArray(data.questions) ? data.questions : [],
    ownerId: data.ownerId || '',
    ownerName: data.ownerName || 'Ẩn danh',
    createdAt: now,
    updatedAt: now,
  }
  list.push(record)
  write(list)
  return record
}

export function updateClass(id, patch) {
  const list = read()
  let updated = null
  const isPublic = patch.isPublic !== false
  const next = list.map((c) => {
    if (c.id !== id) return c
    updated = {
      ...c,
      ...patch,
      isPublic,
      password: isPublic ? '' : String(patch.password ?? c.password ?? ''),
      questions: Array.isArray(patch.questions) ? patch.questions : c.questions,
      id: c.id,
      ownerId: c.ownerId,
      ownerName: c.ownerName,
      createdAt: c.createdAt,
      updatedAt: Date.now(),
    }
    return updated
  })
  write(next)
  return updated
}

export function deleteClass(id) {
  write(read().filter((c) => c.id !== id))
}
