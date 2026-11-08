"use client"

import { movieKey, type Movie } from '../movie'
import { useLibraryStore } from '../store/libraryStore'
import { useLibraryReady } from './LibraryProvider'

export default function RatingControl({ movie }: { movie: Movie }) {
  const ready = useLibraryReady()
  const pending = useLibraryStore(state => state.busy)
  const rating = useLibraryStore(state => state.ratings[movieKey(movie)]?.value)
  const rate = useLibraryStore(state => state.rateMovie)
  const remove = useLibraryStore(state => state.removeRating)
  return <fieldset className="rating-control" disabled={!ready || pending}>
    <legend>Ваша оценка</legend>
    <div className="rating-control__buttons">
      {[1, 2, 3, 4, 5].map(value => <button type="button" key={value}
        aria-label={`Оценить «${movie.title}» на ${value} из 5`}
        aria-pressed={ready && rating === value}
        className={ready && rating === value ? 'rating-control__selected' : ''}
        onClick={() => void rate(movie, value)}>{value} ★</button>)}
      {ready && rating && <button type="button" className="text-button" onClick={() => void remove(movie)}>Удалить оценку</button>}
    </div>
    {pending && <p role="status">Сохраняем…</p>}
    <p className="muted" aria-live="polite">{ready && rating ? `Ваша оценка: ${rating} из 5` : 'Уже смотрели? Поделитесь впечатлением.'}</p>
  </fieldset>
}
