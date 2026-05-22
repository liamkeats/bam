function getTone(value) {
  if (value >= 75) {
    return 'high'
  }

  if (value >= 40) {
    return 'medium'
  }

  if (value > 0) {
    return 'low'
  }

  return 'empty'
}

function clampValue(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function ProgressRing({
  value,
  label = 'Today',
  size = 150,
  strokeWidth = 12,
  reducedMotion = false,
  pulse = false,
}) {
  const progress = clampValue(value)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (progress / 100) * circumference
  const tone = getTone(progress)

  return (
    <div
      className={`progress-ring progress-ring-${tone}${pulse ? ' is-pulsing' : ''}${reducedMotion ? ' reduce-motion' : ''}`}
      style={{ '--ring-size': `${size}px` }}
    >
      <svg
        className="progress-ring-svg"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          className="progress-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="progress-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>

      <div className="progress-ring-center">
        <strong>{progress}%</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

export default ProgressRing
