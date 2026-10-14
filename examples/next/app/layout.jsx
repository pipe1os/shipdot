import './globals.css'

export const metadata = { title: 'shipdot + Next.js' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
