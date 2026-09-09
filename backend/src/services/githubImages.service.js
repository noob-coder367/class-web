import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'

export const IMAGE_CATEGORIES = {
  teacher: {
    id: 'teacher',
    dir: 'teacher',
    label: 'Ảnh giáo viên',
    hint: 'Ảnh cô chủ nhiệm / giáo viên hiển thị ở mục Giáo viên.',
    max: 8,
  },
  hero: {
    id: 'hero',
    dir: 'hero',
    label: 'Ảnh lớp (trang chủ)',
    hint: 'Ảnh polaroid lớn trên banner trang chủ. Chỉ giữ 1 ảnh.',
    max: 1,
  },
  gallery: {
    id: 'gallery',
    dir: 'gallery',
    label: 'Ảnh lớp',
    hint: 'Kỷ niệm trong mục Ảnh lớp.',
    max: 24,
  },
}

const BUCKET = 'site-images'
const MANIFEST_PATH = 'manifest.json'
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_BYTES = 10 * 1024 * 1024

function emptyManifest() {
  return { teacher: [], hero: [], gallery: [] }
}

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
    })
    if (error && !/already exists|duplicate|exists/i.test(error.message || '')) {
      throw new AppError('Không tạo được kho ảnh: ' + error.message, 502)
    }
  } else if (data.public === false) {
    await supabaseAdmin.storage.updateBucket(BUCKET, { public: true })
  }
}

function publicFileUrl(filePath) {
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath)
  return data?.publicUrl || ''
}

function withPublicUrls(manifest) {
  const mapItem = (item) => ({
    ...item,
    url: publicFileUrl(item.path),
  })
  return {
    teacher: (manifest.teacher || []).map(mapItem),
    hero: (manifest.hero || []).map(mapItem),
    gallery: (manifest.gallery || []).map(mapItem),
  }
}

async function readManifest() {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(MANIFEST_PATH)
  if (error || !data) {
    if (error && !/not found|does not exist/i.test(error.message || '')) {
      // Bucket rỗng / chưa có manifest là bình thường.
    }
    return emptyManifest()
  }
  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return {
      teacher: Array.isArray(parsed.teacher) ? parsed.teacher : [],
      hero: Array.isArray(parsed.hero) ? parsed.hero : [],
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
    }
  } catch {
    return emptyManifest()
  }
}

async function writeManifest(manifest) {
  const body = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(MANIFEST_PATH, body, {
      contentType: 'application/json',
      upsert: true,
    })
  if (error) {
    throw new AppError('Không lưu được danh sách ảnh: ' + error.message, 502)
  }
}

function sanitizeFilename(name, ext) {
  const base = String(name || 'anh')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const stamp = Date.now().toString(36)
  return `${base || 'anh'}-${stamp}.${ext}`
}

function stripDataUrl(contentBase64) {
  const raw = String(contentBase64 || '').trim()
  const match = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  return match ? match[1] : raw.replace(/\s+/g, '')
}

export async function listSiteImages() {
  await ensureBucket()
  return withPublicUrls(await readManifest())
}

export async function uploadSiteImage({ category, filename, contentBase64, mimeType, caption }) {
  const meta = IMAGE_CATEGORIES[category]
  if (!meta) throw new AppError('Nhóm ảnh không hợp lệ.')

  const ext = ALLOWED_MIME[String(mimeType || '').toLowerCase()]
  if (!ext) {
    throw new AppError('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.')
  }

  const pure = stripDataUrl(contentBase64)
  if (!pure) throw new AppError('Thiếu dữ liệu ảnh.')

  let bytes
  try {
    bytes = Buffer.from(pure, 'base64')
  } catch {
    throw new AppError('Ảnh không hợp lệ.')
  }
  if (!bytes.length) throw new AppError('Ảnh trống.')
  if (bytes.length > MAX_BYTES) {
    throw new AppError('Ảnh tối đa 10MB. Hãy nén hoặc chọn ảnh nhỏ hơn.')
  }

  await ensureBucket()
  const manifest = await readManifest()
  if ((manifest[category] || []).length >= meta.max) {
    throw new AppError(
      `Nhóm "${meta.label}" đã đủ ${meta.max} ảnh. Xóa bớt rồi thêm lại.`
    )
  }

  const safeName = sanitizeFilename(filename, ext)
  const filePath = `${meta.dir}/${safeName}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, bytes, {
      contentType: String(mimeType || 'image/jpeg').toLowerCase(),
      upsert: false,
    })
  if (uploadError) {
    throw new AppError('Không tải được ảnh lên: ' + uploadError.message, 502)
  }

  const item = {
    name: safeName,
    path: filePath,
    caption: String(caption || '').trim().slice(0, 120),
    category,
  }

  if (category === 'hero') {
    const old = (manifest.hero || [])[0]
    if (old?.path && old.path !== filePath) {
      await supabaseAdmin.storage.from(BUCKET).remove([old.path])
    }
    manifest.hero = [item]
  } else {
    manifest[category] = [...(manifest[category] || []), item]
  }

  await writeManifest(manifest)
  return withPublicUrls(manifest)
}

export async function deleteSiteImage(filePath) {
  const path = String(filePath || '')
  if (!path || path === MANIFEST_PATH || path.includes('..')) {
    throw new AppError('Đường dẫn ảnh không hợp lệ.')
  }
  const allowed = Object.values(IMAGE_CATEGORIES).some((meta) =>
    path.startsWith(`${meta.dir}/`)
  )
  if (!allowed) throw new AppError('Đường dẫn ảnh không hợp lệ.')

  await ensureBucket()
  const manifest = await readManifest()
  let found = false
  for (const key of Object.keys(IMAGE_CATEGORIES)) {
    const next = (manifest[key] || []).filter((item) => item.path !== path)
    if (next.length !== (manifest[key] || []).length) found = true
    manifest[key] = next
  }

  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path])
  if (error && !found) {
    throw new AppError('Không tìm thấy ảnh này.', 404)
  }

  await writeManifest(manifest)
  return withPublicUrls(manifest)
}

export function listCategoryMeta() {
  return Object.values(IMAGE_CATEGORIES)
}
