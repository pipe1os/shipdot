// Static sample data: this period and the previous one, one value per day.
const current = [
  1.12, 1.2, 1.1, 1.26, 1.34, 1.22, 1.38, 1.45, 1.33, 1.49, 1.55, 1.44, 1.6, 1.66, 1.54, 1.5, 1.64,
  1.74, 1.66, 1.76, 1.84, 1.7, 1.8, 1.9, 1.96, 1.85, 2.0, 2.1, 2.01, 2.18,
]
const previous = [
  1.0, 1.04, 0.97, 1.07, 1.12, 1.05, 1.14, 1.1, 1.18, 1.13, 1.2, 1.16, 1.24, 1.19, 1.27, 1.21, 1.29,
  1.24, 1.31, 1.27, 1.34, 1.29, 1.36, 1.32, 1.38, 1.34, 1.41, 1.36, 1.43, 1.4,
]

const [width, height, low, high] = [600, 200, 0.85, 2.3]
const points = (values) =>
  values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * width},${height - ((v - low) / (high - low)) * height}`,
    )
    .join(' ')

export function RevenueChart() {
  return (
    <section className="chart" aria-label="Daily revenue, last 30 days">
      <div className="chart-head">
        <h2>Daily revenue</h2>
        <p className="legend">
          <span>This period</span>
          <span>Previous</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`0,${height} ${points(current)} ${width},${height}`} className="area" />
        <polyline points={points(previous)} className="previous" />
        <polyline points={points(current)} className="current" />
      </svg>
      <p className="days" aria-hidden="true">
        <span>Sep 15</span>
        <span>Sep 22</span>
        <span>Sep 29</span>
        <span>Oct 6</span>
        <span>Oct 13</span>
      </p>
    </section>
  )
}
