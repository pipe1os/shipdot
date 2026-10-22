import { RevenueChart } from './revenue-chart'
import { WhatsNew } from './whats-new'

// A made-up analytics app. Only <WhatsNew /> is shipdot; everything else is scenery for it.
export default function Page() {
  return (
    <>
      <aside className="demo-note">
        <p>
          <strong>This is a made-up app. The bell and the red dot are shipdot.</strong> Click the
          dot on Export CSV, or open the bell, to see what changed.
        </p>
        <nav aria-label="shipdot">
          <a href="https://pipe1os.github.io/shipdot/frameworks/next/">Next.js setup</a>
          <a href="https://github.com/pipe1os/shipdot">GitHub</a>
        </nav>
      </aside>

      <div className="app">
        <header className="top">
          <span className="brand">
            <span className="mark">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="1.5" y="7" width="2.6" height="5.5" rx="1" />
                <rect x="5.7" y="4" width="2.6" height="8.5" rx="1" />
                <rect x="9.9" y="1.5" width="2.6" height="11" rx="1" />
              </svg>
            </span>
            Acme
          </span>
          <nav className="nav" aria-label="Acme">
            <a href="#overview">Overview</a>
            <a href="#reports" aria-current="page">
              Reports
            </a>
            <a href="#customers">Customers</a>
          </nav>
          <div className="end">
            <span className="avatar" aria-hidden="true">
              MR
            </span>
            <WhatsNew />
          </div>
        </header>

        <main className="main">
          <div className="head">
            <div>
              <p className="crumb">Reports / Revenue</p>
              <h1>Revenue overview</h1>
            </div>
            <div className="actions">
              <button type="button" id="btn-filter">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                Filter
              </button>
              <button type="button" id="btn-export" className="primary">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>

          <dl className="kpis">
            <div>
              <dt>Revenue</dt>
              <dd>
                $48.2k <span>+12.4%</span>
              </dd>
            </div>
            <div>
              <dt>Orders</dt>
              <dd>
                1,284 <span>+3.1%</span>
              </dd>
            </div>
            <div>
              <dt>Average order</dt>
              <dd>
                $37.54 <span>+9.0%</span>
              </dd>
            </div>
          </dl>

          <RevenueChart />
        </main>
      </div>
    </>
  )
}
