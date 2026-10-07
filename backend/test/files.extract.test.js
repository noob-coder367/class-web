import test from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import { extractTextFromFile, docxXmlToText, FILE_LIMITS } from '../src/services/files/extractText.js'

/** Dựng một file ZIP tối thiểu (1 entry, deflate) để test DOCX không cần thư viện. */
function buildZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name)
    const raw = Buffer.from(content)
    const data = zlib.deflateRawSync(raw)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8)
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10)
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBuf, data)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(Object.keys(entries).length, 8); eocd.writeUInt16LE(Object.keys(entries).length, 10)
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}

const DOC_XML = '<w:document><w:body><w:p><w:r><w:t>Xin chào &amp; chào</w:t></w:r></w:p><w:p><w:r><w:t>Dòng hai</w:t></w:r><w:tab/><w:r><w:t>sau tab</w:t></w:r></w:p></w:body></w:document>'

test('TXT hợp lệ (UTF-8, có BOM) được đọc', async () => {
  const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Nội dung tiếng Việt có dấu')])
  const { text, kind } = await extractTextFromFile({ buffer, filename: 'bai.TXT' })
  assert.equal(kind, 'txt')
  assert.equal(text, 'Nội dung tiếng Việt có dấu')
})

test('DOCX hợp lệ: trích text, giải mã entity, giữ xuống dòng', async () => {
  const buffer = buildZip({ 'word/document.xml': DOC_XML })
  const { text, kind } = await extractTextFromFile({ buffer, filename: 'bai.docx' })
  assert.equal(kind, 'docx')
  assert.equal(text, 'Xin chào & chào\nDòng hai\tsau tab')
  assert.equal(docxXmlToText('<w:p>a</w:p><w:p>b</w:p>'), 'a\nb')
})

test('file không hợp lệ: sai đuôi, sai magic bytes, rỗng, nhị phân giả TXT', async () => {
  const code = (c) => (e) => e.code === c
  await assert.rejects(extractTextFromFile({ buffer: Buffer.from('x'), filename: 'a.exe' }), code('unsupported_file'))
  await assert.rejects(extractTextFromFile({ buffer: Buffer.from('not a pdf'), filename: 'a.pdf' }), code('unsupported_file'))
  await assert.rejects(extractTextFromFile({ buffer: Buffer.from('not a zip'), filename: 'a.docx' }), code('unsupported_file'))
  await assert.rejects(extractTextFromFile({ buffer: Buffer.from([1, 2, 0, 3]), filename: 'a.txt' }), code('unsupported_file'))
  await assert.rejects(extractTextFromFile({ buffer: Buffer.alloc(0), filename: 'a.txt' }), code('file_unreadable'))
  await assert.rejects(extractTextFromFile({ buffer: Buffer.from([0xff, 0xfe, 0x41]), filename: 'a.txt' }), code('file_unreadable'))
  await assert.rejects(extractTextFromFile({ buffer: Buffer.from('   \n  '), filename: 'a.txt' }), code('file_empty'))
})

test('file quá lớn bị từ chối trước khi xử lý', async () => {
  const big = Buffer.alloc(FILE_LIMITS.MAX_BYTES + 1, 0x41)
  await assert.rejects(extractTextFromFile({ buffer: big, filename: 'a.txt' }), (e) => e.statusCode === 413 && e.code === 'file_too_large')
})

test('DOCX hỏng / thiếu document.xml / zip bomb không làm crash', async () => {
  const truncated = buildZip({ 'word/document.xml': DOC_XML }).subarray(0, 40)
  truncated.writeUInt32LE(0x04034b50, 0)
  await assert.rejects(extractTextFromFile({ buffer: truncated, filename: 'a.docx' }), (e) => e.code === 'file_unreadable')
  await assert.rejects(extractTextFromFile({ buffer: buildZip({ 'other.xml': '<a/>' }), filename: 'a.docx' }), (e) => e.code === 'file_unreadable')
  const bomb = buildZip({ 'word/document.xml': 'A'.repeat(25 * 1024 * 1024) })
  await assert.rejects(extractTextFromFile({ buffer: bomb, filename: 'a.docx' }), (e) => e.code === 'file_unreadable')
})

test('PDF hợp lệ: dùng thư viện được inject; lỗi trích xuất / thiếu thư viện được báo rõ', async () => {
  const buffer = Buffer.from('%PDF-1.4\n%fake body')
  const lib = {
    getDocumentProxy: async (bytes) => { assert.ok(bytes instanceof Uint8Array); return { numPages: 2, destroy: async () => {} } },
    extractText: async () => ({ text: 'Nội dung PDF' }),
  }
  const ok = await extractTextFromFile({ buffer, filename: 'a.pdf', loadPdfLib: async () => lib })
  assert.deepEqual(ok, { text: 'Nội dung PDF', kind: 'pdf' })

  const broken = { getDocumentProxy: async () => { throw new Error('Invalid PDF structure') }, extractText: async () => ({ text: '' }) }
  await assert.rejects(extractTextFromFile({ buffer, filename: 'a.pdf', loadPdfLib: async () => broken }), (e) => e.code === 'file_unreadable')
  await assert.rejects(extractTextFromFile({ buffer, filename: 'a.pdf', loadPdfLib: async () => { throw new Error('Cannot find package') } }), (e) => e.statusCode === 501 && e.code === 'pdf_unavailable')
  const tooLong = { getDocumentProxy: async () => ({ numPages: 999 }), extractText: async () => ({ text: 'x' }) }
  await assert.rejects(extractTextFromFile({ buffer, filename: 'a.pdf', loadPdfLib: async () => tooLong }), (e) => e.code === 'file_too_large')
})
