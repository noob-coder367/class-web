import { env } from '../config/env.js'
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

const IMAGES_ROOT = 'frontend/public/images'
const MANIFEST_PATH = `${IMAGES_ROOT}/manifest.json`
const ALLOWED_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_BYTES = 2 * 1024 * 1024

function emptyManifest() {
  return { teacher: [], hero: [], gallery: [] }
}

function githubHeaders(includeJson = false) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'class-web-admin',
  }
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`
  }
  if (includeJson) headers['Content-Type'] = 'application/json'
  return headers
}

function requireGithubWrite() {
  if (!env.GITHUB_TOKEN) {
    throw new AppError(
      'Chưa cấu hình GITHUB_TOKEN trên backend. Thêm token (quyền contents:write) vào backend/.env để admin có thể thêm/xóa ảnh trên GitHub.',
      503
    )
  }
}

function contentsUrl(filePath) {
  const encoded = filePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${encoded}`
}

function publicFileUrl(filePath, sha) {
  const ref = sha || env.GITHUB_BRANCH
  return `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${ref}/${filePath}`
}

async function githubJson(url, options = {}) {
  const res = await fetch(url, options)
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { res, data }
}

async function getFile(filePath) {
  const url = `${contentsUrl(filePath)}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`
  const { res, data } = await githubJson(url, { headers: githubHeaders() })
  if (res.status === 404) return null
  if (!res.ok) {
    const message = data?.message || `GitHub API ${res.status}`
    throw new AppError('Không đọc được file trên GitHub: ' + message, 502)
  }
  return data
}

async function putFile(filePath, { contentBase64, message, sha }) {
  requireGithubWrite()
  const body = {
    message,
    content: contentBase64,
    branch: env.GITHUB_BRANCH,
  }
  if (sha) body.sha = sha

  const { res, data } = await githubJson(contentsUrl(filePath), {
    method: 'PUT',
    headers: githubHeaders(true),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const messageText = data?.message || `GitHub API ${res.status}`
    throw new AppError('Không ghi được file lên GitHub: ' + messageText, 502)
  }
  return data
}

async function deleteFile(filePath, { sha, message }) {
  requireGithubWrite()
  const { res, data } = await githubJson(contentsUrl(filePath), {
    method: 'DELETE',
    headers: githubHeaders(true),
    body: JSON.stringify({
      message,
      sha,
      branch: env.GITHUB_BRANCH,
    }),
  })
  if (res.status === 404) return
  if (!res.ok) {
    const messageText = data?.message || `GitHub API ${res.status}`
    throw new AppError('Không xóa được file trên GitHub: ' + messageText, 502)
  }
}

function decodeManifestContent(file) {
  if (!file?.content) return emptyManifest()
  const text = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8')
  try {
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

function withPublicUrls(manifest) {
  const mapItem = (item) => ({
    ...item,
    url: publicFileUrl(item.path, item.sha),
  })
  return {
    teacher: (manifest.teacher || []).map(mapItem),
    hero: (manifest.hero || []).map(mapItem),
    gallery: (manifest.gallery || []).map(mapItem),
  }
}

export async function listSiteImages() {
  const file = await getFile(MANIFEST_PATH)
  if (!file) return withPublicUrls(emptyManifest())
  return withPublicUrls(decodeManifestContent(file))
}

async function readManifestRecord() {
  const file = await getFile(MANIFEST_PATH)
  if (!file) return { sha: null, manifest: emptyManifest() }
  return { sha: file.sha, manifest: decodeManifestContent(file) }
}

async function writeManifest(manifest, sha, message) {
  const contentBase64 = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8').toString(
    'base64'
  )
  return putFile(MANIFEST_PATH, { contentBase64, message, sha })
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
    throw new AppError('Ảnh tối đa 2MB. Hãy nén hoặc chọn ảnh nhỏ hơn.')
  }

  const { sha: manifestSha, manifest } = await readManifestRecord()
  if ((manifest[category] || []).length >= meta.max) {
    throw new AppError(
      `Nhóm "${meta.label}" đã đủ ${meta.max} ảnh. Xóa bớt rồi thêm lại.`
    )
  }

  const safeName = sanitizeFilename(filename, ext)
  const filePath = `${IMAGES_ROOT}/${meta.dir}/${safeName}`

  const saved = await putFile(filePath, {
    contentBase64: pure,
    message: `admin: thêm ${meta.label} ${safeName}`,
  })

  const item = {
    name: safeName,
    path: filePath,
    caption: String(caption || '').trim().slice(0, 120),
    sha: saved.content?.sha || saved.commit?.sha || '',
    category,
  }

  if (category === 'hero') {
    manifest.hero = [item]
  } else {
    manifest[category] = [...(manifest[category] || []), item]
  }

  await writeManifest(
    manifest,
    manifestSha,
    `admin: cập nhật danh sách ảnh (${meta.label})`
  )

  return withPublicUrls(manifest)
}

export async function deleteSiteImage(filePath) {
  const path = String(filePath || '')
  if (!path.startsWith(`${IMAGES_ROOT}/`)) {
    throw new AppError('Đường dẫn ảnh không hợp lệ.')
  }
  if (path === MANIFEST_PATH) {
    throw new AppError('Không được xóa file danh sách ảnh.')
  }

  const { sha: manifestSha, manifest } = await readManifestRecord()
  let found = null
  for (const key of Object.keys(IMAGE_CATEGORIES)) {
    const hit = (manifest[key] || []).find((item) => item.path === path)
    if (hit) {
      found = hit
      manifest[key] = manifest[key].filter((item) => item.path !== path)
      break
    }
  }

  const remote = await getFile(path)
  if (remote?.sha) {
    await deleteFile(path, {
      sha: remote.sha,
      message: `admin: xóa ảnh ${path.split('/').pop()}`,
    })
  } else if (!found) {
    throw new AppError('Không tìm thấy ảnh này trên GitHub.', 404)
  }

  await writeManifest(
    manifest,
    manifestSha,
    `admin: cập nhật danh sách ảnh sau khi xóa`
  )

  return withPublicUrls(manifest)
}

export function listCategoryMeta() {
  return Object.values(IMAGE_CATEGORIES)
}
