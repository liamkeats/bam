function ToggleSwitch({ checked, label, helpText, onChange }) {
  return (
    <label className="toggle-row">
      <span className="toggle-copy">
        <strong>{label}</strong>
        {helpText ? <span>{helpText}</span> : null}
      </span>
      <span className={checked ? 'toggle-switch checked' : 'toggle-switch'}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="toggle-slider" aria-hidden="true" />
      </span>
    </label>
  )
}

export default ToggleSwitch
