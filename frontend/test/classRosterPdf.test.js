import test from 'node:test'
import assert from 'node:assert/strict'
import { groupPdfTextItemsIntoRows, parseClassRosterNames } from '../src/lib/classRosterPdf.js'

test('parses legacy PDF roster rows with class/date, class without date, and simple names', () => {
  const names = parseClassRosterNames([
    'STT   Lớp   Họ và tên   Ngày sinh',
    '2 10A4 Trần Thị Bình',
    '1\t10A4\tNguyễn Văn An\t01/01/2008',
    '3. Lê Thị Hoa 03/04/2008',
    '3 10A4 Không thay thế hàng cùng STT',
  ])

  assert.deepEqual(names, [
    { stt: 1, name: 'Nguyễn Văn An' },
    { stt: 2, name: 'Trần Thị Bình' },
    { stt: 3, name: 'Lê Thị Hoa' },
  ])
})

test('ignores empty/header rows and returns an empty list when there are no student rows', () => {
  assert.deepEqual(parseClassRosterNames(['', 'STT | Lớp | Họ tên', 'DANH SÁCH HỌC SINH']), [])
})

test('groups PDF text items with small y-coordinate drift into one roster row', () => {
  const rows = groupPdfTextItemsIntoRows([
    { str: '1', transform: [10, 0, 0, 10, 20, 700] },
    { str: '10A4', transform: [10, 0, 0, 10, 45, 701.8] },
    { str: 'Nguyễn Văn An', transform: [10, 0, 0, 10, 85, 699.2] },
    { str: '01/01/2008', transform: [10, 0, 0, 10, 170, 700.6] },
  ])

  assert.deepEqual(rows, ['1 10A4 Nguyễn Văn An 01/01/2008'])
  assert.deepEqual(parseClassRosterNames(rows), [{ stt: 1, name: 'Nguyễn Văn An' }])
})
