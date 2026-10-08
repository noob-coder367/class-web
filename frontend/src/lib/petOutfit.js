import { supabase } from './supabaseClient.js'

export const EMPTY_OUTFIT = Object.freeze({ hat: null, acc: null, shirt: null })

function normalizeOutfit(row) {
  return {
    hat: row?.hat ?? null,
    acc: row?.acc ?? null,
    shirt: row?.shirt ?? null,
  }
}

/** Load a user's outfit. An anonymous visitor has no saved outfit. */
export async function loadOutfit(userId) {
  if (!userId) return { ...EMPTY_OUTFIT }

  const { data, error } = await supabase
    .from('pet_outfits')
    .select('hat, acc, shirt')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return normalizeOutfit(data)
}

/** Persist one outfit row for the authenticated user. */
export async function saveOutfit(userId, outfit = {}) {
  if (!userId) {
    throw new Error('Vui lòng đăng nhập để lưu trang phục.')
  }

  const { error } = await supabase
    .from('pet_outfits')
    .upsert({
      user_id: userId,
      ...normalizeOutfit(outfit),
    }, { onConflict: 'user_id' })

  if (error) throw error
}
