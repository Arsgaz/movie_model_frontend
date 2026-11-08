"use client"

import Link from 'next/link'
import LibraryStatus from '@/src/components/LibraryStatus'
import MovieCard from '@/src/components/MovieCard'
import RatingControl from '@/src/components/RatingControl'
import { useLibraryReady } from '@/src/components/LibraryProvider'
import { useLibraryStore } from '@/src/store/libraryStore'
import { movieKey } from '@/src/movie'

export default function Page() {
  const ready = useLibraryReady()
  const ratings = useLibraryStore(state => state.ratings)
  const entries = Object.values(ratings).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return <div className="page">
    <h1 className="page-title">Мои оценки</h1>
    <p className="page-description muted">Ваши впечатления о просмотренном. Оценки сохраняются в выбранном профиле на сервере.</p>
    <LibraryStatus />
    {!ready ? null : entries.length ? <>
      <p className="library-count" role="status">Оценено: {entries.length}</p>
      <div className="library-grid library-grid--ratings">{entries.map(({ movie }) => <article className="library-item" key={movieKey(movie)}>
        <MovieCard movie={movie} /><RatingControl movie={movie} />
      </article>)}</div>
    </> : <div className="empty-state">
      <h2>Какие фильмы вам понравились?</h2>
      <p>Найдите знакомый фильм в каталоге и поставьте ему оценку от 1 до 5 на его странице.</p>
      <Link href="/" className="button">Выбрать фильм</Link>
    </div>}
  </div>
}
