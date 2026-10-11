import { useId } from 'react'
import { LIMITS } from '../../lib/questionModel.js'

export default function QuizMetaForm({ title, description, isPublic, errors, onChange }) {
  const id = useId()
  return (
    <section className="qz-panel" aria-label="Thông tin phòng">
      <div className="qz-field">
        <label htmlFor={`${id}-title`}>Tên phòng</label>
        <input
          id={`${id}-title`}
          className="qz-input"
          type="text"
          value={title}
          maxLength={LIMITS.TITLE_MAX}
          placeholder="Một cái tên cho quiz..."
          aria-invalid={Boolean(errors?.title)}
          data-invalid={errors?.title ? 'true' : undefined}
          onChange={(event) => onChange('title', event.target.value)}
        />
        {errors?.title && <p className="qz-error" role="alert">{errors.title}</p>}
      </div>
      <div className="qz-field">
        <label htmlFor={`${id}-description`}>Mô tả <span className="qz-muted">(không bắt buộc)</span></label>
        <textarea
          id={`${id}-description`}
          className="qz-input qz-textarea"
          rows={2}
          value={description}
          maxLength={LIMITS.DESCRIPTION_MAX}
          placeholder="Phòng này nói về điều gì?"
          onChange={(event) => onChange('description', event.target.value)}
        />
        {errors?.description && <p className="qz-error" role="alert">{errors.description}</p>}
      </div>
      <div className="qz-field qz-public-field">
        <label className="qz-public-label">
          <input type="checkbox" checked={isPublic === true} onChange={(event) => onChange('isPublic', event.target.checked)} />
          Công khai quiz để người khác có thể sử dụng
        </label>
        <p className="qz-muted">Quiz công khai sẽ xuất hiện trong danh sách chọn khi người khác tạo phòng. Nội dung chỉ sửa được bởi chủ quiz hoặc quản trị viên.</p>
      </div>
    </section>
  )
}
