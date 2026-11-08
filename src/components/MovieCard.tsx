import Link from 'next/link'
import type { Movie } from '../movie'
import MoviePoster from './MoviePoster'

export default function MovieCard({ movie }: { movie: Movie }) {
  return <Link href={`/movie/${movie.category}/${movie.id}`} className="movie-card">
    <div className="movie-card__poster"><MoviePoster path={movie.poster_path} title={movie.title} /></div>
    <h3 className="movie-card__title">{movie.title}</h3>
    <p className="movie-card__date">{movie.release_date?.slice(0, 4) || 'Год не указан'}</p>
    <p className="movie-card__rating">TMDB: {movie.vote_average > 0 ? `${movie.vote_average.toFixed(1)} / 10` : 'нет оценки'}</p>
  </Link>
}
