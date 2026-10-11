function normalizeLine(value) {
  return String(value || '').replace(/[\t|]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Gom các text item cùng dòng dù PDF.js trả y lệch vài điểm ảnh. */
export function groupPdfTextItemsIntoRows(items) {
  const positioned = (items || [])
    .map((item) => ({
      text: String(item?.str || '').trim(),
      x: Number(item?.transform?.[4] || 0),
      y: Number(item?.transform?.[5] || 0),
      fontSize: Math.abs(Number(item?.transform?.[3] || item?.transform?.[0] || 0)),
    }))
    .filter((item) => item.text && Number.isFinite(item.x) && Number.isFinite(item.y))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const rows = []
  for (const item of positioned) {
    const tolerance = Math.max(2.5, Math.min(5, item.fontSize * 0.3 || 3))
    let target = null
    let distance = Infinity
    for (const row of rows) {
      const currentDistance = Math.abs(row.y - item.y)
      if (currentDistance <= tolerance && currentDistance < distance) {
        target = row
        distance = currentDistance
      }
    }
    if (!target) {
      target = { y: item.y, items: [] }
      rows.push(target)
    }
    target.items.push(item)
    target.y = target.items.reduce((sum, value) => sum + value.y, 0) / target.items.length
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' '))
    .map(normalizeLine)
    .filter(Boolean)
}

export function parseClassRosterNames(lines) {
  const found = []
  const seen = new Set()
  const add = (stt, rawName) => {
    const name = String(rawName || '').replace(/^\s*\d+\s*[-.)]?\s*/, '').replace(/\s+/g, ' ').replace(/[|;,:\s-]+$/, '').trim()
    const number = Number(stt)
    if (!Number.isInteger(number) || number < 1 || !name || /^họ tên$/i.test(name) || /^họ và tên$/i.test(name)) return
    const key = number + ':' + name.toLocaleLowerCase('vi')
    if (seen.has(key) || found.some((item) => item.stt === number)) return
    seen.add(key)
    found.push({ stt: number, name })
  }
  for (const raw of lines) {
    const line = normalizeLine(raw)
    if (!line || /^STT\b/i.test(line) || /^DANH SÁCH/i.test(line)) continue
    // Standard legacy format: STT, class, full name, date of birth.
    const dateMatch = line.match(/^\s*(\d{1,3})\s+(?:\d{2}[A-Z0-9]+)\s+(.+?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i)
    if (dateMatch) { add(dateMatch[1], dateMatch[2]); continue }
    // PDF text extraction can split table columns differently or omit the date.
    const classMatch = line.match(/^\s*(\d{1,3})\s+(?:\d{2}[A-Z0-9]+)\s+(.+)$/i)
    if (classMatch) {
      const name = classMatch[2].replace(/\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}.*$/, '').trim()
      if (name) add(classMatch[1], name)
      continue
    }
    // Some PDFs export the columns as "STT Name ..." without the class column.
    const simpleMatch = line.match(/^\s*(\d{1,3})[.)]?\s+([\p{L}][\p{L}\s.'’-]{2,}?)(?:\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4})?\s*$/u)
    if (simpleMatch && !/^(tổng|số lượng|lớp|ngày sinh|họ tên)\b/i.test(simpleMatch[2])) add(simpleMatch[1], simpleMatch[2])
  }
  return found.sort((a, b) => a.stt - b.stt)
}
