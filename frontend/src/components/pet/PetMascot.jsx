import { useId } from 'react'

// Linh vật ngọn lửa vẽ bằng SVG, mặc được mũ / phụ kiện / áo.
const BODY = 'M102 16 C122 42 154 72 159 124 C164 178 136 214 100 214 C64 214 36 178 41 124 C46 72 80 44 102 16 Z'

export const HATS = [
  { id: 'beanie', name: 'Mũ len tím', node: <g><path d="M52 100 C52 56 80 34 102 34 C126 34 150 56 150 100 Z" fill="#9b6be0" /><rect x="47" y="84" width="108" height="20" rx="9" fill="#b894f0" /><circle cx="102" cy="62" r="9" fill="#ffc83a" /><path d="M60 92h84" stroke="#9b6be0" strokeWidth="2" opacity=".5" /></g> },
  { id: 'cap', name: 'Mũ lưỡi trai', node: <g><path d="M56 98 C56 54 88 44 104 44 C128 44 150 62 150 98 Z" fill="#ff7a1a" /><path d="M98 92 Q152 82 180 98 Q152 108 98 102 Z" fill="#e85f00" /><circle cx="104" cy="44" r="5" fill="#ffb066" /></g> },
  { id: 'fedora', name: 'Mũ phớt hồng', node: <g><ellipse cx="102" cy="94" rx="64" ry="11" fill="#ff7fc0" /><path d="M70 92 L74 52 Q102 40 130 52 L134 92 Z" fill="#ff9fd0" /><rect x="71" y="76" width="62" height="10" fill="#c2358c" /></g> },
  { id: 'boater', name: 'Mũ phẳng đỏ', node: <g><ellipse cx="102" cy="94" rx="58" ry="9" fill="#c1121f" /><rect x="72" y="56" width="60" height="38" rx="7" fill="#e63946" /><rect x="72" y="76" width="60" height="9" fill="#7a0b14" /></g> },
  { id: 'beret', name: 'Mũ nồi xanh', node: <g><ellipse cx="106" cy="76" rx="54" ry="24" fill="#4fc3d9" transform="rotate(-8 106 76)" /><circle cx="108" cy="52" r="5" fill="#2a99b0" /></g> },
  { id: 'catears', name: 'Tai mèo', node: <g><path d="M56 98 L58 50 L92 80 Z" fill="#fff" stroke="#2b2118" strokeWidth="3" strokeLinejoin="round" /><path d="M148 98 L146 50 L112 80 Z" fill="#fff" stroke="#2b2118" strokeWidth="3" strokeLinejoin="round" /><path d="M64 84 L65 64 L82 80 Z" fill="#ffb3c6" /><path d="M140 84 L139 64 L122 80 Z" fill="#ffb3c6" /><path d="M54 98 Q102 74 150 98" fill="none" stroke="#35ad78" strokeWidth="9" strokeLinecap="round" /></g> },
  { id: 'crown', name: 'Vương miện', node: <g><path d="M58 100 L64 54 L84 78 L102 44 L120 78 L140 54 L146 100 Z" fill="#ffd23f" stroke="#e0a800" strokeWidth="3" strokeLinejoin="round" /><circle cx="102" cy="82" r="6" fill="#e63946" /><circle cx="78" cy="90" r="4" fill="#4aa3f0" /><circle cx="126" cy="90" r="4" fill="#4aa3f0" /></g> },
  { id: 'straw', name: 'Mũ rơm', node: <g><ellipse cx="102" cy="94" rx="72" ry="12" fill="#f2c35b" /><path d="M72 92 Q74 48 102 48 Q130 48 132 92 Z" fill="#f7d57a" /><rect x="73" y="76" width="58" height="10" fill="#c0392b" /></g> },
]

export const ACCESSORIES = [
  { id: 'glasses', name: 'Kính tròn', node: <g fill="rgba(255,255,255,.25)" stroke="#2b2118" strokeWidth="4"><circle cx="80" cy="122" r="23" /><circle cx="124" cy="122" r="23" /><path d="M103 120 Q102 114 101 120" fill="none" /><path d="M57 118 L42 112 M147 118 L162 112" fill="none" strokeLinecap="round" /></g> },
  { id: 'sunglasses', name: 'Kính râm', node: <g><rect x="52" y="108" width="50" height="32" rx="13" fill="#1c1c24" /><rect x="102" y="108" width="50" height="32" rx="13" fill="#1c1c24" /><rect x="98" y="112" width="8" height="5" rx="2" fill="#1c1c24" /><path d="M60 116 L72 112 M110 116 L122 112" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" /></g> },
  { id: 'scarf', name: 'Khăn đỏ', node: <g><path d="M40 164 Q102 186 162 164 L166 186 Q102 210 36 186 Z" fill="#e63946" /><path d="M118 190 L134 224 L114 218 Z" fill="#c1121f" /><path d="M60 176 L56 190 M90 182 L88 196 M120 182 L120 196" stroke="#fff" strokeWidth="3" opacity=".5" strokeLinecap="round" /></g> },
  { id: 'bowtie', name: 'Nơ', node: <g><path d="M102 176 L76 160 L76 192 Z" fill="#8d5cf0" /><path d="M102 176 L128 160 L128 192 Z" fill="#8d5cf0" /><circle cx="102" cy="176" r="6" fill="#5b3fc0" /></g> },
  { id: 'headphones', name: 'Tai nghe', node: <g><path d="M46 122 C44 44 160 44 158 122" fill="none" stroke="#2b2f3a" strokeWidth="9" strokeLinecap="round" /><rect x="34" y="106" width="20" height="38" rx="9" fill="#ff4d6d" stroke="#2b2f3a" strokeWidth="4" /><rect x="150" y="106" width="20" height="38" rx="9" fill="#ff4d6d" stroke="#2b2f3a" strokeWidth="4" /></g> },
]

export const SHIRTS = [
  { id: 'tee-blue', name: 'Áo thun xanh', node: <g><path d="M24 170 Q102 156 180 170 L186 240 L18 240 Z" fill="#4aa3f0" /><path d="M82 164 Q102 192 122 164 L130 162 Q102 200 74 162 Z" fill="#fff" /></g> },
  { id: 'hoodie', name: 'Áo hoodie đỏ', node: <g><path d="M24 170 Q102 156 180 170 L186 240 L18 240 Z" fill="#e5484d" /><path d="M72 164 Q102 194 132 164 L138 168 Q102 208 66 168 Z" fill="#c93338" /><rect x="76" y="196" width="52" height="22" rx="8" fill="#c93338" /><path d="M94 176 V192 M110 176 V192" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></g> },
  { id: 'stripes', name: 'Áo sọc xanh lá', node: <g><rect x="18" y="166" width="168" height="80" fill="#35ad78" />{[176, 188, 200, 212, 224].map((y) => <rect key={y} x="18" y={y} width="168" height="6" fill="#fff" opacity=".9" />)}</g> },
  { id: 'jersey', name: 'Áo đấu tím', node: <g><path d="M24 170 Q102 156 180 170 L186 240 L18 240 Z" fill="#8d5cf0" /><path d="M84 164 L102 188 L120 164" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /><text x="102" y="212" textAnchor="middle" fontSize="24" fontWeight="900" fill="#fff" fontFamily="Manrope, sans-serif">10</text></g> },
  { id: 'class', name: 'Áo lớp 10A4', node: <g><path d="M24 170 Q102 156 180 170 L186 240 L18 240 Z" fill="#f4f4f7" /><path d="M82 164 Q102 184 122 164" fill="none" stroke="#c9ccd6" strokeWidth="4" /><text x="102" y="204" textAnchor="middle" fontSize="16" fontWeight="900" fill="#3b2fa8" fontFamily="Manrope, sans-serif">10A4</text></g> },
]

export const PET_CATEGORIES = [
  { key: 'hat', label: 'Mũ', items: HATS, crop: '30 16 144 100' },
  { key: 'acc', label: 'Phụ kiện', items: ACCESSORIES, crop: '28 70 148 130' },
  { key: 'shirt', label: 'Áo', items: SHIRTS, crop: '24 138 156 96' },
]

const find = (list, id) => list.find((item) => item.id === id)?.node || null

// ghost: vẽ thân xám nhạt, không mặt (dùng làm ảnh xem trước từng món đồ). viewBox: cắt vùng cần xem.
export default function PetMascot({ outfit = {}, size = 200, ghost = false, viewBox = '0 0 200 240', className = '', label = 'Linh vật ngọn lửa' }) {
  const uid = useId().replace(/:/g, '')
  const gradient = `pet-grad-${uid}`
  const clip = `pet-clip-${uid}`
  return <svg className={`pet-mascot ${className}`} width={size} viewBox={viewBox} role="img" aria-label={label}>
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe066" /><stop offset=".55" stopColor="#ffc233" /><stop offset="1" stopColor="#ff9a1f" /></linearGradient>
      <clipPath id={clip}><path d={BODY} /></clipPath>
    </defs>
    {!ghost && <><ellipse cx="82" cy="222" rx="18" ry="8" fill="#ff8c14" /><ellipse cx="122" cy="222" rx="18" ry="8" fill="#ff8c14" /><path d="M44 150 C26 160 24 186 34 198" stroke="#ff9a1f" strokeWidth="11" strokeLinecap="round" fill="none" /><path d="M160 150 C178 160 180 186 170 198" stroke="#ff9a1f" strokeWidth="11" strokeLinecap="round" fill="none" /></>}
    <path d={BODY} fill={ghost ? '#ececf2' : `url(#${gradient})`} />
    {!ghost && <ellipse cx="78" cy="70" rx="14" ry="26" fill="#fff" opacity=".22" transform="rotate(18 78 70)" />}
    {outfit.shirt && <g clipPath={`url(#${clip})`}>{find(SHIRTS, outfit.shirt)}</g>}
    {!ghost && <>
      <ellipse cx="80" cy="122" rx="20" ry="22" fill="#fff" stroke="#c9741a" strokeWidth="3" /><ellipse cx="124" cy="122" rx="20" ry="22" fill="#fff" stroke="#c9741a" strokeWidth="3" />
      <circle cx="83" cy="126" r="12" fill="#5a2d0c" /><circle cx="127" cy="126" r="12" fill="#5a2d0c" /><circle cx="79" cy="120" r="4.5" fill="#fff" /><circle cx="123" cy="120" r="4.5" fill="#fff" />
      <path d="M88 150 Q106 172 128 148 Q108 157 88 150 Z" fill="#e8322a" />
    </>}
    {find(ACCESSORIES, outfit.acc)}
    {find(HATS, outfit.hat)}
  </svg>
}
