const DAYS = ['t2', 't3', 't4', 't5', 't6', 't7']

function emptyRow() {
  return { t2: '', t3: '', t4: '', t5: '', t6: '', t7: '' }
}

function row(cells) {
  return {
    t2: cells[0],
    t3: cells[1],
    t4: cells[2],
    t5: cells[3],
    t6: cells[4],
    t7: cells[5],
  }
}

export const DEFAULT_SUBJECTS = [
  { id: 'hdtn1', name: 'HĐTN 1', tone: 'act' },
  { id: 'hdtn2', name: 'HĐTN 2', tone: 'act' },
  { id: 'hdtn3', name: 'HĐTN 3', tone: 'act' },
  { id: 'ai', name: 'Trí tuệ nhân tạo', tone: 'tech' },
  { id: 'cdhoa', name: 'CĐ Hóa học', tone: 'sci' },
  { id: 'cdvatli', name: 'CĐ Vật lí', tone: 'sci' },
  { id: 'cdtoan', name: 'CĐ Toán', tone: 'math' },
  { id: 'nguvan', name: 'Ngữ văn', tone: 'lit' },
  { id: 'congnghe', name: 'Công nghệ', tone: 'tech' },
  { id: 'gddia', name: 'GD địa phương', tone: 'hist' },
  { id: 'gdqp', name: 'GDQP và AN', tone: 'hist' },
  { id: 'tienganh', name: 'Tiếng Anh', tone: 'lang' },
  { id: 'tann', name: 'Tiếng Anh NN', tone: 'lang' },
  { id: 'toan', name: 'Toán', tone: 'math' },
  { id: 'stem', name: 'STEM', tone: 'tech' },
  { id: 'lichsu', name: 'Lịch sử', tone: 'hist' },
  { id: 'hoahoc', name: 'Hóa học', tone: 'sci' },
  { id: 'gdthe', name: 'GD thể', tone: 'pe' },
  { id: 'vatli', name: 'Vật lí', tone: 'sci' },
  { id: 'tinhoc', name: 'Tin học', tone: 'tech' },
  { id: 'tinquocte', name: 'Tin học Quốc tế', tone: 'tech' },
  { id: 'tuhoc', name: 'Tự học', tone: 'act' },
  { id: 'clb', name: 'Câu lạc bộ', tone: 'act' },
]

export function createDefaultTimetable() {
  return {
    className: '10A4',
    school: 'THPT Nguyễn Hữu Huân',
    effectiveFrom: '2026-09-03',
    subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })),
    sessions: [
      {
        id: 'morning',
        label: 'Buổi sáng',
        extra: {
          time: '06:45',
          note: 'Lễ chào cờ (riêng Thứ Hai — học sinh có mặt)',
        },
        arrival: {
          time: '06:50',
          note: 'Học sinh có mặt tại trường (Từ Thứ Ba đến Thứ Sáu)',
        },
        periods: [
          { id: 'm1', kind: 'lesson', number: 1, start: '07:00', end: '07:45' },
          { id: 'm2', kind: 'lesson', number: 2, start: '07:45', end: '08:30' },
          {
            id: 'mbreak',
            kind: 'break',
            start: '08:30',
            end: '09:00',
            label: 'Thể dục giữa giờ + Giải lao',
            note: '30 phút',
          },
          { id: 'm3', kind: 'lesson', number: 3, start: '09:00', end: '09:45' },
          { id: 'm4', kind: 'lesson', number: 4, start: '09:45', end: '10:30' },
          {
            id: 'm5',
            kind: 'lesson',
            number: 5,
            start: '10:30',
            end: '11:15',
            note: 'Lớp Tích Hợp áp dụng theo TKB của EMG',
          },
        ],
        grid: {
          m1: row(['hdtn1', 'ai', 'gddia', 'tann', 'lichsu', '']),
          m2: row(['hdtn2', 'cdhoa', 'gdqp', 'tann', 'lichsu', '']),
          m3: row(['nguvan', 'congnghe', 'tienganh', 'toan', 'stem', '']),
          m4: row(['nguvan', 'congnghe', 'tienganh', 'toan', 'stem', '']),
          m5: emptyRow(),
        },
      },
      {
        id: 'afternoon',
        label: 'Buổi chiều',
        arrival: {
          time: '12:50',
          note: 'Học sinh có mặt tại trường',
        },
        periods: [
          { id: 'a1', kind: 'lesson', number: 1, start: '13:00', end: '13:45' },
          { id: 'a2', kind: 'lesson', number: 2, start: '13:45', end: '14:30' },
          {
            id: 'abreak',
            kind: 'break',
            start: '14:30',
            end: '14:45',
            label: 'Giải lao',
            note: '15 phút',
          },
          { id: 'a3', kind: 'lesson', number: 3, start: '14:45', end: '15:30' },
          { id: 'a4', kind: 'lesson', number: 4, start: '15:30', end: '16:15' },
        ],
        grid: {
          a1: row(['hoahoc', 'hdtn3', 'gdthe', 'vatli', 'tinhoc', '']),
          a2: row(['hoahoc', 'nguvan', 'gdthe', 'vatli', 'tinhoc', '']),
          a3: row(['tienganh', 'toan', 'tinquocte', 'tuhoc', 'clb', '']),
          a4: row(['cdvatli', 'cdtoan', 'tinquocte', '', '', '']),
        },
      },
    ],
  }
}

export { DAYS }
