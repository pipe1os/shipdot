import { WhatsNew } from './whats-new'

export default function Page() {
  return (
    <>
      <header>
        <strong>Acme</strong>
        <WhatsNew />
      </header>
      <main>
        <h1>Reports</h1>
        <button type="button" id="btn-export">
          Export CSV
        </button>
      </main>
    </>
  )
}
