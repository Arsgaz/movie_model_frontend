export type MovieCategory = 'movies' | 'series' | 'cartoons'

export type Movie = {
  id: string | number
  tmdb_id?: number
  title: string
  overview: string
  poster_path: string | null
  backdrop_path?: string | null
  release_date: string
  vote_average: number
  category: MovieCategory
}

export type MediaType = 'movie' | 'tv'

export const categoryLabels: Record<MovieCategory, string> = {
  movies: 'Фильмы', series: 'Сериалы', cartoons: 'Мультфильмы',
}

export function isMovieCategory(value: string): value is MovieCategory {
  return value === 'movies' || value === 'series' || value === 'cartoons'
}

export function getMediaType(category: MovieCategory): MediaType {
  return category === 'series' ? 'tv' : 'movie'
}

// Animation is a movie genre, not a separate TMDB identity.
export function movieKey(movie: Pick<Movie, 'id' | 'tmdb_id' | 'category'>): string {
  return `${getMediaType(movie.category)}:${movie.tmdb_id ?? movie.id}`
}

export function isCatalogId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function isLegacyMovieId(value: string): boolean {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
}
