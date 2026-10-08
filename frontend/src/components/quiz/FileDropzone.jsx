import { useId, useRef, useState } from 'react'

export const MAX_FILE_BYTES = 8 * 1024 * 1024
const ACCEPT = '.pdf,.docx,.txt,image/*'
const EXTENSIONS = ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tif', 'tiff']

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Kiểm tra sơ bộ phía client (backend vẫn kiểm tra lại đuôi file, magic bytes và dung lượng). */
export function checkFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!EXTENSIONS.includes(extension)) return 'Chỉ hỗ trợ PDF, DOCX, TXT hoặc ảnh.'
  if (file.size === 0) return 'File rỗng.'
  if (file.size > MAX_FILE_BYTES) return 'File quá lớn (tối đa 8 MB).'
  return null
}

export default function FileDropzone({ file, onFile, onReject, disabled = false }) {
  const inputId = useId()
  const cameraId = useId()
  const albumId = useId()
  const inputRef = useRef(null)
  const cameraRef = useRef(null)
  const albumRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const accept = (candidate) => {
    if (!candidate) return
    const problem = checkFile(candidate)
    if (problem) onReject?.(problem)
    else onFile(candidate)
  }

  const clear = () => {
    onFile(null)
    ;[inputRef, cameraRef, albumRef].forEach((ref) => { if (ref.current) ref.current.value = '' })
  }

  if (file) {
    return (
      <div className="qz-file">
        <div className="qz-file-info">
          <strong title={file.name}>{file.name}</strong>
          <span>{formatSize(file.size)}{file.type?.startsWith('image/') ? ' · Ảnh sẽ được OCR' : ''}</span>
        </div>
        <button type="button" className="qz-btn qz-btn-quiet" onClick={clear} disabled={disabled} aria-label={`Bỏ file ${file.name}`}>
          Bỏ file
        </button>
      </div>
    )
  }

  return (
    <div className={`qz-upload-stack${disabled ? ' is-disabled' : ''}`}>
    <label
      htmlFor={inputId}
      className={`qz-dropzone${dragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (!disabled) accept(event.dataTransfer.files?.[0])
      }}
    >
      <span className="qz-dropzone-title">Chọn file hoặc kéo thả vào đây</span>
      <span className="qz-dropzone-hint">PDF, DOCX, TXT hoặc ảnh · tối đa 8 MB</span>
      <input
        id={inputId}
        ref={inputRef}
        className="qz-visually-hidden"
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        onChange={(event) => accept(event.target.files?.[0])}
      />
    </label>
    <div className="qz-image-actions" aria-label="Chọn ảnh">
      <button type="button" className="qz-btn qz-btn-quiet" disabled={disabled} onClick={() => cameraRef.current?.click()}>📷 Chụp ảnh</button>
      <button type="button" className="qz-btn qz-btn-quiet" disabled={disabled} onClick={() => albumRef.current?.click()}>🖼 Chọn từ album</button>
      <input id={cameraId} ref={cameraRef} className="qz-visually-hidden" type="file" accept="image/*" capture="environment" disabled={disabled} onChange={(event) => accept(event.target.files?.[0])} />
      <input id={albumId} ref={albumRef} className="qz-visually-hidden" type="file" accept="image/*" disabled={disabled} onChange={(event) => accept(event.target.files?.[0])} />
    </div>
    </div>
  )
}
