function TabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      className={active ? 'tab-btn active' : 'tab-btn'}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default TabButton
