import '../src/global.css'
import type { Metadata } from 'next'
import Header from '../src/components/Header'
import LibraryProvider from '../src/components/LibraryProvider'

export const metadata: Metadata = {
  title: { default: 'Кинотека', template: '%s — Кинотека' },
  description: 'Находите фильмы, сохраняйте избранное и оценивайте просмотренное',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body>
        <a className="skip-link" href="#main">К содержимому</a>
        <LibraryProvider>
          <Header />
          <main id="main">{children}</main>
        </LibraryProvider>
      </body>
    </html>
  )
}
