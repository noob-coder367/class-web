import { useId } from 'react'

// Linh vật ngọn lửa (vẽ lại theo mẫu): thân giọt lửa có 2 chóp, mắt to, mày cam, miệng cười có lưỡi, tay móc, chân dẹt.
// Hệ toạ độ: viewBox 0 0 200 226. Đầu ~ y 18-76, mắt y~102, miệng y~128-152, thân kết thúc y~208.
const BODY = 'M100 208 C58 208 28 180 28 138 C28 96 58 56 86 20 C90 14 98 14 102 22 C108 36 120 48 134 50 C142 46 150 42 156 48 C170 64 176 100 176 138 C176 180 148 208 100 208 Z'

const H = (id, name, node, crop = '30 0 150 85') => ({ id, name, node, crop, tf: 'translate(0 -32)' })
export const HATS = [
  H('beanie', 'Mũ len tím', <g><path d="M52 100 C52 56 80 34 102 34 C126 34 150 56 150 100 Z" fill="#9b6be0" /><rect x="47" y="84" width="108" height="20" rx="9" fill="#b894f0" /><circle cx="102" cy="62" r="9" fill="#ffc83a" /><path d="M58 92h92" stroke="#8a56d4" strokeWidth="2" opacity=".5" /></g>),
  H('cap', 'Mũ lưỡi trai', <g><path d="M56 98 C56 54 88 44 104 44 C128 44 150 62 150 98 Z" fill="#ff7a1a" /><path d="M98 92 Q152 82 180 98 Q152 108 98 102 Z" fill="#e85f00" /><circle cx="104" cy="44" r="5" fill="#ffb066" /></g>),
  H('fedora', 'Mũ phớt hồng', <g><ellipse cx="102" cy="94" rx="64" ry="11" fill="#ff7fc0" /><path d="M70 92 L74 52 Q102 40 130 52 L134 92 Z" fill="#ff9fd0" /><rect x="71" y="76" width="62" height="10" fill="#c2358c" /></g>),
  H('boater', 'Mũ phẳng đỏ', <g><ellipse cx="102" cy="94" rx="58" ry="9" fill="#c1121f" /><rect x="72" y="56" width="60" height="38" rx="7" fill="#e63946" /><rect x="72" y="76" width="60" height="9" fill="#7a0b14" /></g>),
  H('beret', 'Mũ nồi xanh', <g><ellipse cx="106" cy="76" rx="54" ry="24" fill="#4fc3d9" transform="rotate(-8 106 76)" /><circle cx="108" cy="52" r="5" fill="#2a99b0" /></g>),
  H('catears', 'Tai mèo', <g><path d="M56 98 L58 50 L92 80 Z" fill="#fff" stroke="#2b2118" strokeWidth="3" strokeLinejoin="round" /><path d="M148 98 L146 50 L112 80 Z" fill="#fff" stroke="#2b2118" strokeWidth="3" strokeLinejoin="round" /><path d="M64 84 L65 64 L82 80 Z" fill="#ffb3c6" /><path d="M140 84 L139 64 L122 80 Z" fill="#ffb3c6" /><path d="M54 98 Q102 74 150 98" fill="none" stroke="#35ad78" strokeWidth="9" strokeLinecap="round" /></g>),
  H('crown', 'Vương miện', <g><path d="M58 100 L64 54 L84 78 L102 44 L120 78 L140 54 L146 100 Z" fill="#ffd23f" stroke="#e0a800" strokeWidth="3" strokeLinejoin="round" /><circle cx="102" cy="82" r="6" fill="#e63946" /><circle cx="78" cy="90" r="4" fill="#4aa3f0" /><circle cx="126" cy="90" r="4" fill="#4aa3f0" /></g>),
  H('straw', 'Mũ rơm', <g><ellipse cx="102" cy="94" rx="72" ry="12" fill="#f2c35b" /><path d="M72 92 Q74 48 102 48 Q130 48 132 92 Z" fill="#f7d57a" /><rect x="73" y="76" width="58" height="10" fill="#c0392b" /></g>),
]

export const ACCESSORIES = [
  { id: 'glasses', name: 'Kính tròn', tf: 'translate(-15 -35) scale(1.12)', crop: '30 70 140 64', node: <g fill="rgba(255,255,255,.25)" stroke="#2b2118" strokeWidth="4"><circle cx="80" cy="122" r="23" /><circle cx="124" cy="122" r="23" /><path d="M103 120 Q102 114 101 120" fill="none" /><path d="M57 118 L42 112 M147 118 L162 112" fill="none" strokeLinecap="round" /></g> },
  { id: 'sunglasses', name: 'Kính râm', tf: 'translate(-13 -34) scale(1.1)', crop: '30 70 140 64', node: <g><rect x="52" y="108" width="50" height="32" rx="13" fill="#1c1c24" /><rect x="102" y="108" width="50" height="32" rx="13" fill="#1c1c24" /><rect x="98" y="112" width="8" height="5" rx="2" fill="#1c1c24" /><path d="M60 116 L72 112 M110 116 L122 112" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" /></g> },
  { id: 'scarf', name: 'Khăn đỏ', tf: 'translate(-10 -6) scale(1.1 1)', crop: '16 140 170 86', node: <g><path d="M40 164 Q102 186 162 164 L166 186 Q102 210 36 186 Z" fill="#e63946" /><path d="M118 190 L134 224 L114 218 Z" fill="#c1121f" /><path d="M60 176 L56 190 M90 182 L88 196 M120 182 L120 196" stroke="#fff" strokeWidth="3" opacity=".5" strokeLinecap="round" /></g> },
  { id: 'bowtie', name: 'Nơ', tf: 'translate(2 -12)', crop: '50 140 110 66', node: <g><path d="M102 176 L76 160 L76 192 Z" fill="#8d5cf0" /><path d="M102 176 L128 160 L128 192 Z" fill="#8d5cf0" /><circle cx="102" cy="176" r="6" fill="#5b3fc0" /></g> },
  { id: 'headphones', name: 'Tai nghe', tf: 'translate(-22 -22) scale(1.2 1)', crop: '10 30 190 130', node: <g><path d="M46 122 C44 44 160 44 158 122" fill="none" stroke="#2b2f3a" strokeWidth="9" strokeLinecap="round" /><rect x="34" y="106" width="20" height="38" rx="9" fill="#ff4d6d" stroke="#2b2f3a" strokeWidth="4" /><rect x="150" y="106" width="20" height="38" rx="9" fill="#ff4d6d" stroke="#2b2f3a" strokeWidth="4" /></g> },
]

const TOP = 'M16 158 Q102 146 188 158 L194 240 L10 240 Z'
const S = (id, name, node) => ({ id, name, node, crop: '14 146 176 70' })
export const SHIRTS = [
  S('tee-blue', 'Áo thun xanh', <g><path d={TOP} fill="#4aa3f0" /><path d="M78 152 Q102 182 126 152 L134 150 Q102 192 70 150 Z" fill="#fff" /></g>),
  S('hoodie', 'Áo hoodie đỏ', <g><path d={TOP} fill="#e5484d" /><path d="M68 152 Q102 186 136 152 L142 156 Q102 200 62 156 Z" fill="#c93338" /><rect x="76" y="186" width="52" height="20" rx="8" fill="#c93338" /><path d="M94 166 V182 M110 166 V182" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></g>),
  S('stripes', 'Áo sọc xanh lá', <g><rect x="10" y="150" width="190" height="90" fill="#35ad78" />{[162, 172, 182, 192, 202].map((y) => <rect key={y} x="10" y={y} width="190" height="5" fill="#fff" opacity=".9" />)}</g>),
  S('jersey', 'Áo đấu tím', <g><path d={TOP} fill="#8d5cf0" /><path d="M80 152 L102 176 L124 152" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /><text x="102" y="199" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff" fontFamily="Manrope, sans-serif">10</text></g>),
  S('class', 'Áo lớp 10A4', <g><path d={TOP} fill="#f4f4f7" /><path d="M80 152 Q102 174 124 152" fill="none" stroke="#c9ccd6" strokeWidth="4" /><text x="102" y="193" textAnchor="middle" fontSize="15" fontWeight="900" fill="#3b2fa8" fontFamily="Manrope, sans-serif">10A4</text></g>),
]

export const PET_CATEGORIES = [
  { key: 'hat', label: 'Mũ', items: HATS, crop: '30 0 150 85' },
  { key: 'acc', label: 'Phụ kiện', items: ACCESSORIES, crop: '16 30 170 190' },
  { key: 'shirt', label: 'Áo', items: SHIRTS, crop: '14 146 176 70' },
]

const place = (list, id) => { const item = list.find((entry) => entry.id === id); return item ? <g transform={item.tf || undefined}>{item.node}</g> : null }

// ghost: thân xám nhạt, không mặt (ảnh xem trước từng món). viewBox: cắt vùng cần xem.
export default function PetMascot({ outfit = {}, size = 200, ghost = false, viewBox = '0 0 200 226', className = '', label = 'Linh vật ngọn lửa' }) {
  const uid = useId().replace(/:/g, '')
  const grad = `pet-grad-${uid}`
  const shade = `pet-shade-${uid}`
  const clip = `pet-clip-${uid}`
  return <svg className={`pet-mascot ${className}`} width={size} viewBox={viewBox} role="img" aria-label={label}>
    <defs>
      <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe85e" /><stop offset=".5" stopColor="#ffc82b" /><stop offset="1" stopColor="#ff9c1a" /></linearGradient>
      <radialGradient id={shade} cx=".46" cy=".42" r=".66"><stop offset=".62" stopColor="#ff8a00" stopOpacity="0" /><stop offset="1" stopColor="#ff7a00" stopOpacity=".5" /></radialGradient>
      <clipPath id={clip}><path d={BODY} /></clipPath>
    </defs>
    {!ghost && <>
      <ellipse cx="102" cy="217" rx="62" ry="5" fill="#a85a00" opacity=".16" />
      <ellipse cx="80" cy="211" rx="17" ry="7" fill="#f2850a" /><ellipse cx="124" cy="211" rx="17" ry="7" fill="#f2850a" />
      <path d="M34 138 C20 154 18 176 28 190 C32 193 37 188 34 184" stroke="#f7a223" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M170 138 C184 154 186 176 176 190 C172 193 167 188 170 184" stroke="#f7a223" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>}
    <path d={BODY} fill={ghost ? '#ececf2' : `url(#${grad})`} />
    {!ghost && <>
      <path d={BODY} fill={`url(#${shade})`} />
      <path d="M52 112 C56 84 70 54 90 30" stroke="#fff" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".42" />
      <ellipse cx="60" cy="150" rx="7" ry="14" fill="#fff" opacity=".18" transform="rotate(12 60 150)" />
    </>}
    {outfit.shirt && <g clipPath={`url(#${clip})`}>{place(SHIRTS, outfit.shirt)}</g>}
    {!ghost && <>
      <path d="M52 74 Q72 60 94 70" stroke="#f08a1c" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M108 70 Q130 58 148 74" stroke="#f08a1c" strokeWidth="5" strokeLinecap="round" fill="none" />
      <ellipse cx="75" cy="104" rx="25" ry="27" fill="#fff" /><ellipse cx="123" cy="104" rx="25" ry="27" fill="#fff" />
      <path d="M52 100 Q75 74 98 100" stroke="#f3a62b" strokeWidth="3" fill="none" opacity=".55" /><path d="M100 100 Q123 74 146 100" stroke="#f3a62b" strokeWidth="3" fill="none" opacity=".55" />
      <circle cx="77" cy="108" r="18" fill="#c97612" /><circle cx="125" cy="108" r="18" fill="#c97612" />
      <circle cx="77" cy="109" r="12" fill="#4a2205" /><circle cx="125" cy="109" r="12" fill="#4a2205" />
      <circle cx="71" cy="102" r="5" fill="#fff" /><circle cx="119" cy="102" r="5" fill="#fff" /><circle cx="82" cy="115" r="2.4" fill="#fff" opacity=".9" /><circle cx="130" cy="115" r="2.4" fill="#fff" opacity=".9" />
      <ellipse cx="142" cy="132" rx="8" ry="10" fill="#fff3a0" opacity=".65" />
      <path d="M86 130 Q112 138 138 124 Q134 148 112 152 Q92 152 86 130 Z" fill="#d62f1f" />
      <path d="M98 146 Q112 136 128 142 Q118 154 106 152 Z" fill="#ff7a5c" />
      <path d="M140 120 Q145 126 140 133" stroke="#e58a1a" strokeWidth="3" strokeLinecap="round" fill="none" />
    </>}
    {place(ACCESSORIES, outfit.acc)}
    {place(HATS, outfit.hat)}
  </svg>
}
