import * as memberProfileService from '../services/memberProfile.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
}

export async function getMemberProfile(req, res, next) {
  try { noStore(res); res.json({ memberProfile: await memberProfileService.getMemberProfile(req.profile) }) } catch (err) { next(err) }
}

export async function saveMemberProfile(req, res, next) {
  try {
    noStore(res)
    const memberProfile = await memberProfileService.saveMemberProfile(req.body || {}, req.profile)
    res.json({ message: 'Đã lưu thông tin cá nhân.', memberProfile })
  } catch (err) { next(err) }
}
