"use client"

import Link from 'next/link'
import LibraryStatus from '@/src/components/LibraryStatus'
import MovieCard from '@/src/components/MovieCard'
import FavoriteButton from '@/src/components/FavoriteButton'
import { useLibraryReady } from '@/src/components/LibraryProvider'
import { useLibraryStore } from '@/src/store/libraryStore'
import { movieKey } from '@/src/movie'

export default function Page() {
  const ready = useLibraryReady()
  const favorites = useLibraryStore(state => state.favorites)
  return <div className="page">
    <h1 className="page-title">Избранное</h1>
    <p className="page-description muted">Список того, что хочется посмотреть. Сохраняется в выбранном профиле на сервере.</p>
    <LibraryStatus />
    {!ready ? null : favorites.length ?
      <div className="library-grid">{favorites.map(movie => <article className="library-item" key={movieKey(movie)}>
        <MovieCard movie={movie} /><FavoriteButton movie={movie} />
      </article>)}</div> : <div className="empty-state">
        <h2>Сохраните кино на вечер</h2><p>Добавляйте фильмы в избранное на странице фильма — они появятся здесь.</p>
        <Link href="/" className="button">Перейти в каталог</Link>
      </div>}
  </div>
}
