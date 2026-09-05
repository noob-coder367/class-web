/**
 * Phải chạy SAU requireAuth. Chỉ cho qua nếu profile.role === 'admin'.
 * Đây là điểm mà bản gốc chỉ kiểm tra ở frontend (ẩn/hiện nút) -
 * nay được enforce thật sự ở server.
 */
export function requireAdmin(req, res, next) {
  if (req.profile?.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn không có quyền admin.' })
  }
  next()
}
