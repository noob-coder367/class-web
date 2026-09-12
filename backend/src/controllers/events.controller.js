import * as eventsService from '../services/events.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export async function listEvents(req, res, next) {
  try {
    noStore(res)
    const items = await eventsService.listEvents()
    res.json({ items })
  } catch (err) {
    next(err)
  }
}

export async function createEvent(req, res, next) {
  try {
    noStore(res)
    const item = await eventsService.createEvent(req.body || {}, req.profile)
    res.status(201).json({ message: 'Đã đăng sự kiện.', item })
  } catch (err) {
    next(err)
  }
}

export async function deleteEvent(req, res, next) {
  try {
    noStore(res)
    const result = await eventsService.deleteEvent(req.params.id)
    res.json({ message: 'Đã xoá sự kiện.', ...result })
  } catch (err) {
    next(err)
  }
}

export async function updateEventExpiry(req, res, next) {
  try {
    noStore(res)
    const item = await eventsService.updateEventExpiry(
      req.params.id,
      req.body?.expires_at ?? null
    )
    res.json({ message: 'Đã cập nhật thời gian tự xóa.', item })
  } catch (err) {
    next(err)
  }
}
