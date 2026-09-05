/**
 * Validator nhẹ, không cần thêm thư viện ngoài.
 * Dùng: router.post('/x', validateBody({ email: 'string', otp: 'string' }), ...)
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const missing = []

    for (const field of Object.keys(schema)) {
      const value = req.body?.[field]
      if (value === undefined || value === null || value === '') {
        missing.push(field)
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Thiếu trường bắt buộc: ${missing.join(', ')}`,
      })
    }

    next()
  }
}
