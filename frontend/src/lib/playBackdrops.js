/** Chủ đề nền khi vào phòng (phía sau khung câu hỏi / đáp án / nút). */
export const PLAY_BACKDROP_THEMES = [
  { id: 'sky', label: 'Bầu trời', hint: 'Xanh trong, mây nhẹ' },
  { id: 'ocean', label: 'Đại dương', hint: 'Sóng xanh sâu' },
  { id: 'sunset', label: 'Hoàng hôn', hint: 'Cam, hồng, tím' },
  { id: 'night', label: 'Đêm sao', hint: 'Trời đêm lấp lánh' },
  { id: 'forest', label: 'Rừng xanh', hint: 'Tán cây rậm' },
  { id: 'aurora', label: 'Cực quang', hint: 'Lụa xanh tím' },
  { id: 'sakura', label: 'Hoa anh đào', hint: 'Hồng phấn nhẹ' },
  { id: 'desert', label: 'Sa mạc', hint: 'Cát vàng nắng' },
  { id: 'lavender', label: 'Oải hương', hint: 'Tím mộng mơ' },
  { id: 'rain', label: 'Mưa', hint: 'Xám dịu, se lạnh' },
  { id: 'galaxy', label: 'Ngân hà', hint: 'Tím nebula' },
  { id: 'meadow', label: 'Đồng cỏ', hint: 'Xanh lá, trời sáng' },
]

export function playBackdropThemeOf(id) {
  return PLAY_BACKDROP_THEMES.find((t) => t.id === id) || null
}

export function normalizePlayBackdrop(raw) {
  const type = raw?.backdropType === 'theme' || raw?.backdropType === 'image' ? raw.backdropType : ''
  const theme = String(raw?.backdropTheme || '')
  const image = String(raw?.backdropImage || '')
  if (type === 'theme' && playBackdropThemeOf(theme)) {
    return { backdropType: 'theme', backdropTheme: theme, backdropImage: '' }
  }
  if (type === 'image' && image) {
    return { backdropType: 'image', backdropTheme: '', backdropImage: image }
  }
  return { backdropType: '', backdropTheme: '', backdropImage: '' }
}
