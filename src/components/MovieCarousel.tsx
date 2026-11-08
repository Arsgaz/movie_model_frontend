import MovieCard from './MovieCard'
import { movieKey, type Movie, type MovieCategory } from '../movie'

export default function MovieCarousel({ title, movies, category }: { title: string; movies: Movie[]; category: MovieCategory }) {
  return <section className={`movie-carousel movie-carousel--${category}`} aria-label={title}>
    <div className="movie-carousel__overlay">
      <h2 className="movie-carousel__title">{title}</h2>
      {movies.length ? <div className="movie-carousel__list">{movies.map(movie => <MovieCard key={movieKey(movie)} movie={movie} />)}</div>
        : <p className="muted">По вашему запросу ничего не найдено.</p>}
    </div>
  </section>
}
