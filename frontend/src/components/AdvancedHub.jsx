import './AdvancedHub.css'

/** Trang trắng của nhóm "Nâng cao": mỗi mục con là 1 ô nền gradient, bấm để mở route của mục đó. */
export default function AdvancedHub({ items, onOpen }) {
  return (
    <div className="adv-page">
      <h2 className="adv-title">Nâng cao</h2>
      <div className="adv-grid">
        {items.map((item, index) => {
          const Icon = item.icon
          return (
            <button key={item.id} type="button" className={`adv-card adv-card--${index % 4}`} onClick={() => onOpen(item)}>
              <span className="adv-card-icon">{Icon ? <Icon /> : null}</span>
              <strong className="adv-card-title">{item.label}</strong>
            </button>
          )
        })}
      </div>
    </div>
  )
}
