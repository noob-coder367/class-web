import * as pushService from '../services/push.service.js'

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
}

export async function getVapidPublicKey(req, res, next) {
  try {
    noStore(res)
    res.json({ publicKey: pushService.getPublicVapidKey() })
  } catch (err) {
    next(err)
  }
}

export async function subscribe(req, res, next) {
  try {
    noStore(res)
    const subscription = req.body?.subscription || req.body
    const userAgent = req.headers['user-agent'] || ''
    const receiptUrl = pushService.receiptUrlFromRequest(req)
    await pushService.saveSubscription(req.profile.id, subscription, userAgent, { receiptUrl })
    res.status(201).json({ message: 'Đã đăng ký nhận thông báo.' })
  } catch (err) {
    next(err)
  }
}

export async function unsubscribe(req, res, next) {
  try {
    noStore(res)
    const endpoint = req.body?.endpoint || ''
    await pushService.removeSubscription(req.profile.id, endpoint)
    res.json({ message: 'Đã hủy đăng ký thông báo.' })
  } catch (err) {
    next(err)
  }
}

export async function receipt(req, res, next) {
  try {
    noStore(res)
    const receiptToken = req.body?.receiptToken || req.body?.receipt_token || ''
    await pushService.recordReceipt(receiptToken)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
