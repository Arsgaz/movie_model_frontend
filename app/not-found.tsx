import Link from 'next/link'

export default function NotFound() {
  return <div className="page empty-state"><p className="eyebrow">404</p><h1>Страница не найдена</h1>
    <p>Возможно, ссылка устарела. Найдите фильм в каталоге.</p><Link href="/" className="button">В каталог</Link></div>
}
