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
    const line = String(raw || '').replace(/[\t|]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line || /^STT\b/i.test(line) || /^DANH SÁCH/i.test(line)) continue
    // Standard legacy format: STT, class, full name, date of birth.
    const dateMatch = line.match(/^\s*(\d{1,3})\s+(?:10[A-Z0-9]+)\s+(.+?)\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i)
    if (dateMatch) { add(dateMatch[1], dateMatch[2]); continue }
    // PDF text extraction can split table columns differently or omit the date.
    const classMatch = line.match(/^\s*(\d{1,3})\s+(?:10[A-Z0-9]+)\s+(.+)$/i)
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
