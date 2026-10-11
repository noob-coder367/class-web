import * as accountService from '../services/adminAccount.service.js'

export async function list(req, res, next) {
  try { res.json({ accounts: await accountService.listAccounts() }) } catch (error) { next(error) }
}

export async function details(req, res, next) {
  try { res.json({ account: await accountService.getAccountDetails(req.params.id) }) } catch (error) { next(error) }
}

export async function update(req, res, next) {
  try { res.json({ message: 'Đã cập nhật hồ sơ tài khoản.', account: await accountService.updateAccount(req.params.id, req.body || {}) }) } catch (error) { next(error) }
}

export async function renameGhost(req, res, next) {
  try {
    const profile = await accountService.updateGhostDisplayName(req.params.id, req.body?.displayName)
    res.json({ message: 'Đã cập nhật tên tài khoản ma.', profile })
  } catch (error) { next(error) }
}

export async function remove(req, res, next) {
  try {
    await accountService.deleteAccount(req.params.id, req.profile.id)
    res.json({ message: 'Đã xóa tài khoản.' })
  } catch (error) { next(error) }
}
