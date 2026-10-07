import path from 'node:path'
import { HttpError } from '../../lib/httpError.js'
import { readZipEntry } from './zipReader.js'

export const FILE_LIMITS = Object.freeze({
  MAX_BYTES: 8 * 1024 * 1024,
  MAX_PDF_PAGES: 150,
  PDF_TIMEOUT_MS: 30000,
})

const SUPPORTED = ['.pdf', '.docx', '.txt']

function unsupported() {
  return new HttpError('Chỉ hỗ trợ file PDF, DOCX hoặc TXT.', 415, 'unsupported_file')
}

function unreadable(message = 'Không đọc được file. File có thể bị hỏng hoặc không đúng định dạng.') {
  return new HttpError(message, 422, 'file_unreadable')
}

/** Xác định loại file bằng đuôi file + magic bytes (KHÔNG tin MIME do client gửi). */
export function detectFileKind(filename, buffer) {
  const ext = path.extname(String(filename || '')).toLowerCase()
  if (!SUPPORTED.includes(ext)) throw unsupported()
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw unreadable('File rỗng.')
  if (buffer.length > FILE_LIMITS.MAX_BYTES) {
    throw new HttpError('File quá lớn (tối đa 8 MB).', 413, 'file_too_large')
  }

  if (ext === '.pdf') {
    if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw unsupported()
    return 'pdf'
  }
  if (ext === '.docx') {
    if (buffer.readUInt32LE(0) !== 0x04034b50) throw unsupported()
    return 'docx'
  }
  if (buffer.subarray(0, 8192).includes(0)) throw unsupported()
  return 'txt'
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeChar(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name])
}

function safeChar(code) {
  try { return String.fromCodePoint(code) } catch { return '' }
}

export function docxXmlToText(xml) {
  const stripped = xml
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(stripped).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function extractDocx(buffer) {
  let xml
  try {
    xml = readZipEntry(buffer, 'word/document.xml')
  } catch {
    throw unreadable()
  }
  if (!xml) throw unreadable('File DOCX không hợp lệ.')
  return docxXmlToText(xml.toString('utf8'))
}

function extractTxt(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '')
  } catch {
    throw unreadable('File TXT cần được lưu với mã hóa UTF-8.')
  }
}

async function extractPdf(buffer, loadPdfLib) {
  let lib
  try {
    lib = await loadPdfLib()
  } catch {
    throw new HttpError('Máy chủ chưa hỗ trợ đọc PDF. Hãy dùng file DOCX/TXT hoặc nhập text.', 501, 'pdf_unavailable')
  }

  let pdf
  const work = (async () => {
    // Copy 1 lần vì pdf.js có thể "detach" ArrayBuffer đầu vào.
    pdf = await lib.getDocumentProxy(new Uint8Array(buffer))
    if (pdf.numPages > FILE_LIMITS.MAX_PDF_PAGES) {
      throw new HttpError(`PDF quá dài (tối đa ${FILE_LIMITS.MAX_PDF_PAGES} trang).`, 413, 'file_too_large')
    }
    const { text } = await lib.extractText(pdf, { mergePages: true })
    return Array.isArray(text) ? text.join('\n') : String(text || '')
  })()

  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new HttpError('Đọc file quá lâu. Hãy thử file nhỏ hơn.', 504, 'file_timeout')), FILE_LIMITS.PDF_TIMEOUT_MS)
  })
  try {
    return await Promise.race([work, timeout])
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw unreadable('Không đọc được file PDF (file hỏng, có mật khẩu hoặc là bản scan).')
  } finally {
    clearTimeout(timer)
    work.catch(() => {})
    try { await pdf?.destroy?.() } catch { /* ignore */ }
  }
}

/**
 * extractTextFromFile: PDF / DOCX / TXT -> text thuần.
 * Không ghi file tạm ra đĩa (xử lý trực tiếp trên 1 Buffer) nên không có gì phải dọn;
 * Buffer được giải phóng khi request kết thúc.
 */
export async function extractTextFromFile({ buffer, filename, loadPdfLib = () => import('unpdf') }) {
  const kind = detectFileKind(filename, buffer)
  let text
  if (kind === 'pdf') text = await extractPdf(buffer, loadPdfLib)
  else if (kind === 'docx') text = extractDocx(buffer)
  else text = extractTxt(buffer)

  text = String(text).replace(/\u0000/g, '').trim()
  if (!text) {
    throw new HttpError('Không tìm thấy nội dung văn bản trong file (file ảnh/bản scan chưa được hỗ trợ).', 422, 'file_empty')
  }
  return { text, kind }
}
