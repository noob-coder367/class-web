import zlib from 'node:zlib'

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

/**
 * Đọc 1 entry từ file ZIP (đủ cho DOCX) bằng zlib có sẵn của Node, không cần thư viện ngoài.
 * Giới hạn kích thước giải nén để chống zip bomb. Trả về Buffer hoặc null nếu không có entry.
 */
export function readZipEntry(buffer, wantedName, { maxBytes = 20 * 1024 * 1024 } = {}) {
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff)
  let eocd = -1
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip: missing end of central directory')

  const total = buffer.readUInt16LE(eocd + 10)
  let offset = buffer.readUInt32LE(eocd + 16)

  for (let n = 0; n < total; n += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== SIG_CENTRAL) throw new Error('zip: bad central directory')
    const method = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const size = buffer.readUInt32LE(offset + 24)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extraLength = buffer.readUInt16LE(offset + 30)
    const commentLength = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)

    if (name === wantedName) {
      if (size > maxBytes) throw new Error('zip: entry too large')
      if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== SIG_LOCAL) throw new Error('zip: bad local header')
      const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28)
      const data = buffer.subarray(start, start + compressedSize)
      if (method === 0) return Buffer.from(data)
      if (method === 8) return zlib.inflateRawSync(data, { maxOutputLength: maxBytes })
      throw new Error('zip: unsupported compression')
    }
    offset += 46 + nameLength + extraLength + commentLength
  }
  return null
}
