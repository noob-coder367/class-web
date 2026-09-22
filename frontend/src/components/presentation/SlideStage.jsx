function elementStyle(element) {
  const extra = element?.style && typeof element.style === 'object' ? element.style : {}
  const shape = element?.shape || 'rectangle'
  const shapeStyle =
    element?.type === 'shape'
      ? {
          background: extra.background || '#0b91a3',
          border: extra.border || 'none',
          borderRadius: shape === 'circle' ? '50%' : extra.borderRadius ?? 12,
          clipPath: shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
        }
      : extra
  return {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    transform: `rotate(${element.rotation || 0}deg)`,
    opacity: element.opacity == null ? 1 : element.opacity,
    zIndex: element.zIndex || 1,
    ...shapeStyle,
  }
}

export default function SlideStage({
  slide,
  selectedId = null,
  interactive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizePointerDown,
  className = '',
}) {
  const background = slide?.background || {}
  const bgStyle =
    background.type === 'image' && background.value
      ? { backgroundImage: `url(${background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: background.value || '#ffffff' }

  return (
    <div
      className={`presentation-canvas ${className}`.trim()}
      style={bgStyle}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerLeave={interactive ? onPointerUp : undefined}
    >
      {(slide?.elements || []).map((element) => {
        const selected = interactive && selectedId === element.id
        return (
          <div
            key={element.id}
            className={`presentation-element presentation-element--${element.type}${selected ? ' is-selected' : ''}`}
            style={elementStyle(element)}
            onPointerDown={interactive ? (event) => onPointerDown?.(event, element) : undefined}
          >
            {element.type === 'text' ? element.text : null}
            {element.type === 'image' && element.src ? (
              <img src={element.src} alt="" draggable={false} />
            ) : null}
            {selected ? (
              <span
                className="presentation-resize-handle"
                onPointerDown={(event) => onResizePointerDown?.(event, element)}
                aria-hidden="true"
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
