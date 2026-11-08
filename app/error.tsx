"use client"

import Link from 'next/link'

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <div className="page empty-state" role="alert"><h1>Не удалось открыть страницу</h1>
    <p>Попробуйте ещё раз или вернитесь в каталог.</p>
    <button type="button" className="button" onClick={() => retry()}>Попробовать снова</button>
    <Link href="/">В каталог</Link>
  </div>
}
