// Lưu trang phục thú cưng theo từng tài khoản (localStorage). Muốn đồng bộ nhiều thiết bị thì chuyển sang bảng profiles/pet_outfits trên Supabase.
const PREFIX = 'class-web:pet-outfit:'
const EMPTY = Object.freeze({ hat: null, acc: null, shirt: null })

export function loadOutfit(uid = 'guest') {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFIX + uid) || 'null')
    return { hat: parsed?.hat ?? null, acc: parsed?.acc ?? null, shirt: parsed?.shirt ?? null }
  } catch { return { ...EMPTY } }
}

export function saveOutfit(uid = 'guest', outfit) {
  try { localStorage.setItem(PREFIX + uid, JSON.stringify({ hat: outfit.hat ?? null, acc: outfit.acc ?? null, shirt: outfit.shirt ?? null })) } catch { /* bỏ qua */ }
}
