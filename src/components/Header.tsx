"use client"

import Link from 'next/link'
import ProfileSelector from './ProfileSelector'
import { usePathname } from 'next/navigation'

const links = [['/', 'Каталог'], ['/recommendations', 'Для вас'], ['/favorites', 'Избранное'], ['/ratings', 'Мои оценки']]
export default function Header() {
  const pathname = usePathname()
  return <header className="header"><div className="header__container">
    <Link href="/" className="header__logo">🎬 Кинотека</Link>
    <nav className="header__nav" aria-label="Основная навигация">
      {links.map(([href, label]) => <Link key={href} href={href}
        aria-current={pathname === href ? 'page' : undefined}
        className={`header__link${pathname === href ? ' header__link--active' : ''}`}>{label}</Link>)}
    </nav>
    <ProfileSelector />
  </div></header>
}
