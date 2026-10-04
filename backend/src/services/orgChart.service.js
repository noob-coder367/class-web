import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabaseClient.js'
import { AppError } from './auth.service.js'
import { isAdminRole } from '../lib/roles.js'

const MAX_NODES = 120
const MAX_PHOTO_CHARS = 400_000 // ảnh đã nén ở client (~vài chục KB), chặn thêm ở server

function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function normalizeNodes(raw) {
  if (!Array.isArray(raw)) throw new AppError('Dữ liệu cây thành viên không hợp lệ.', 400)
  if (raw.length > MAX_NODES) throw new AppError(`Cây thành viên tối đa ${MAX_NODES} người.`, 400)
  const seen = new Set()
  const nodes = []
  for (const item of raw) {
    const id = clean(item?.id, 64) || randomUUID()
    if (seen.has(id)) continue
    seen.add(id)
    const name = clean(item?.name, 80)
    if (!name) throw new AppError('Mỗi thành viên cần có họ và tên.', 400)
    const photo = typeof item?.photo === 'string' && item.photo.startsWith('data:image/') ? item.photo : ''
    if (photo.length > MAX_PHOTO_CHARS) throw new AppError('Ảnh thành viên quá lớn sau khi nén.', 400)
    nodes.push({ id, name, role: clean(item?.role, 80), photo, parentId: clean(item?.parentId, 64) || null })
  }
  const ids = new Set(nodes.map((n) => n.id))
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const node of nodes) {
    if (node.parentId && (!ids.has(node.parentId) || node.parentId === node.id)) node.parentId = null
  }
  // Chặn vòng lặp cha-con.
  for (const node of nodes) {
    let cur = node
    const path = new Set()
    while (cur?.parentId) {
      if (path.has(cur.id)) { node.parentId = null; break }
      path.add(cur.id)
      cur = byId.get(cur.parentId)
    }
  }
  return nodes
}

export async function getOrgChart() {
  const { data, error } = await supabaseAdmin
    .from('class_org_chart').select('nodes, updated_at').eq('id', 'default').maybeSingle()
  if (error) {
    console.error('[org-chart] read failed', error.message)
    throw new AppError('Không thể đọc cây thành viên lớp.', 503)
  }
  return { nodes: Array.isArray(data?.nodes) ? data.nodes : [], updatedAt: data?.updated_at || '' }
}

export async function saveOrgChart(payload, profile) {
  if (!isAdminRole(profile?.role)) throw new AppError('Chỉ admin mới được chỉnh cây thành viên.', 403)
  const nodes = normalizeNodes(payload?.nodes)
  const updatedAt = new Date().toISOString()
  const { error } = await supabaseAdmin.from('class_org_chart').upsert(
    { id: 'default', nodes, updated_at: updatedAt, updated_by: profile?.id || null },
    { onConflict: 'id' }
  )
  if (error) {
    console.error('[org-chart] write failed', error.message)
    throw new AppError('Không thể lưu cây thành viên lớp.', 503)
  }
  return { nodes, updatedAt }
}
