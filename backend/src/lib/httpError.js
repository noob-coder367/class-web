/**
 * Lỗi nghiệp vụ có statusCode + code ổn định để frontend hiển thị đúng thông báo.
 * message luôn là tiếng Việt, an toàn để trả cho người dùng (không chứa stack/secret).
 */
export class HttpError extends Error {
  constructor(message, statusCode = 400, code = undefined) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
  }
}
