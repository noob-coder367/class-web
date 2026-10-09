import * as service from '../services/adminDashboardBackground.service.js'

export async function get(_req, res, next) {
  try { res.json({ background: await service.getAdminDashboardBackground() }) } catch (error) { next(error) }
}
export async function upload(req, res, next) {
  try { res.json({ background: await service.uploadAdminDashboardBackground(req.body, req.headers['content-type']) }) } catch (error) { next(error) }
}
export async function remove(_req, res, next) {
  try { res.json(await service.deleteAdminDashboardBackground()) } catch (error) { next(error) }
}
