const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

function textElement(text, options = {}) {
  return {
    id: uid(), type: 'text', x: options.x ?? 10, y: options.y ?? 20, width: options.width ?? 80, height: options.height ?? 18,
    rotation: 0, opacity: 1, zIndex: options.zIndex ?? 1, text,
    style: { fontFamily: 'Be Vietnam Pro, sans-serif', fontSize: options.fontSize ?? 34, fontWeight: options.fontWeight ?? 700, color: options.color ?? '#14324a', textAlign: options.textAlign ?? 'left', lineHeight: 1.2, letterSpacing: 0 },
    animation: { entrance: 'fade', duration: 0.45, delay: 0 },
  }
}

function slide(title, elements, background = '#ffffff', notes = '') {
  return { id: uid(), title, background: { type: 'solid', value: background }, transition: { type: 'fade', duration: 0.5, advance: 'click' }, notes, elements }
}

export const PRESENTATION_TEMPLATES = [
  { id: 'blank', label: 'Blank', description: 'Bắt đầu từ canvas sạch', slides: () => [slide('Trang tiêu đề', [])] },
  { id: 'education', label: 'Education', description: 'Bài giảng rõ ràng, dễ đọc', slides: () => [
    slide('Tiêu đề bài học', [textElement('Tên bài học', { y: 30, fontSize: 46, textAlign: 'center', width: 90, x: 5 }), textElement('Môn học · Lớp · Ngày', { y: 55, fontSize: 18, color: '#0b91a3', textAlign: 'center', width: 90, x: 5 })], '#f4fbfc'),
    slide('Nội dung chính', [textElement('Nội dung chính', { y: 10, fontSize: 30 }), textElement('• Ý tưởng thứ nhất\n• Ý tưởng thứ hai\n• Ví dụ minh họa', { y: 28, fontSize: 25, width: 72, height: 45 })]),
  ] },
  { id: 'business', label: 'Business', description: 'Tối giản, chuyên nghiệp', slides: () => [
    slide('Executive summary', [textElement('EXECUTIVE\nSUMMARY', { y: 25, fontSize: 48, fontWeight: 800 }), textElement('Một thông điệp rõ ràng cho quyết định quan trọng.', { y: 58, fontSize: 20, color: '#607789' })], '#eef4f7'),
    slide('Key metrics', [textElement('KEY METRICS', { y: 10, fontSize: 26 }), textElement('00%', { x: 8, y: 35, width: 25, fontSize: 48, color: '#0b91a3' }), textElement('Tăng trưởng', { x: 8, y: 62, width: 25, fontSize: 16 }), textElement('00', { x: 38, y: 35, width: 25, fontSize: 48, color: '#0b91a3' }), textElement('Dự án', { x: 38, y: 62, width: 25, fontSize: 16 })], '#ffffff'),
  ] },
  { id: 'science', label: 'Science', description: 'Nghiên cứu và báo cáo', slides: () => [
    slide('Research brief', [textElement('RESEARCH\nBRIEF', { y: 24, fontSize: 46, color: '#193b52' }), textElement('Câu hỏi · Phương pháp · Kết quả', { y: 63, fontSize: 18, color: '#4d8190' })], '#eaf5f2'),
    slide('Hypothesis', [textElement('Giả thuyết', { y: 12, fontSize: 30 }), textElement('Viết giả thuyết và bằng chứng hỗ trợ ở đây.', { y: 32, fontSize: 26, width: 76 })]),
  ] },
]

export function templateById(id) {
  return PRESENTATION_TEMPLATES.find((item) => item.id === id) || PRESENTATION_TEMPLATES[0]
}
