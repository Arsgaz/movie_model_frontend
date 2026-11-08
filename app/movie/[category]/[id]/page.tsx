import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryStatus from '@/src/components/LibraryStatus'
import FavoriteButton from '@/src/components/FavoriteButton'
import RatingControl from '@/src/components/RatingControl'
import MoviePoster from '@/src/components/MoviePoster'
import { getMovieById, getMovieByTmdbId } from '@/src/moviesApi'
import { isMovieCategory, isCatalogId, isLegacyMovieId } from '@/src/movie'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ category: string; id: string }> }
export default async function Page({ params }: Props) {
  const { id, category } = await params
  if (!isMovieCategory(category) || (!isCatalogId(id) && !isLegacyMovieId(id))) notFound()
  const legacy = isLegacyMovieId(id)
  const result = legacy ? await getMovieByTmdbId(id, category) : await getMovieById(id, category)
  if (!result.ok) {
    if (result.error === 'not-found') notFound()
    return <div className="page"><div className="notice" role="status">
      <h1>Не удалось загрузить фильм</h1><p>Каталог временно недоступен. Попробуйте обновить страницу позже.</p>
      <Link href="/">Вернуться в каталог</Link>
    </div></div>
  }
  const movie = result.data
  const backdrop = movie.backdrop_path || movie.poster_path
  return <section className={`movie-details movie-details--${movie.category}`}
    style={backdrop ? { backgroundImage: `linear-gradient(90deg, rgba(8,8,8,.96), rgba(8,8,8,.85)), url(https://image.tmdb.org/t/p/original${backdrop})` } : undefined}>
    <div className="movie-details__container">
      <div className="movie-details__poster"><MoviePoster path={movie.poster_path} title={movie.title} large /></div>
      <div className="movie-details__content">
        <Link href="/" className="back-link">← В каталог</Link>
        <p className="movie-details__category">{category === 'series' ? 'Сериал' : category === 'cartoons' ? 'Мультфильм' : 'Фильм'}</p>
        <h1 className="movie-details__title">{movie.title}</h1>
        <div className="movie-details__meta">
          <span>{movie.release_date || 'Дата выхода не указана'}</span>
          <span>TMDB: {movie.vote_average > 0 ? `${movie.vote_average.toFixed(1)} / 10` : 'нет оценки'}</span>
        </div>
        <LibraryStatus />
        <FavoriteButton movie={movie} />
        <RatingControl movie={movie} />
        <p className="movie-details__overview">{movie.overview || 'Описание пока отсутствует.'}</p>
      </div>
    </div>
  </section>
}
