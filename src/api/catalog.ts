import { getMediaType, isCatalogId, type Movie, type MovieCategory } from '../movie'

export type CatalogResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: 'configuration' | 'unavailable' | 'not-found' }

export type MoviePage = { movies: Movie[]; page: number; totalPages: number; totalResults: number | null }

type BackendMovie = {
  id: string | null; tmdb_id: number; media_type: 'movie' | 'tv'; title: string; overview: string;
  poster_path: string | null; backdrop_path: string | null; release_date: string | null;
  vote_average: number; genres: { tmdb_id: number; name: string }[];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
const nonnegative = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const imagePath = (value: unknown) => value === null || (typeof value === 'string' && /^\/[A-Za-z0-9_./-]+$/.test(value))

function isBackendMovie(value: unknown): value is BackendMovie {
  if (!record(value)) return false
  return (value.id === null || (typeof value.id === 'string' && isCatalogId(value.id))) && positive(value.tmdb_id) &&
    (value.media_type === 'movie' || value.media_type === 'tv') && typeof value.title === 'string' &&
    typeof value.overview === 'string' && imagePath(value.poster_path) && imagePath(value.backdrop_path) &&
    (value.release_date === null || (typeof value.release_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.release_date))) &&
    typeof value.vote_average === 'number' && Number.isFinite(value.vote_average) && value.vote_average >= 0 && value.vote_average <= 10 &&
    Array.isArray(value.genres) && value.genres.every(genre => record(genre) && positive(genre.tmdb_id) && typeof genre.name === 'string')
}

function normalize(movie: BackendMovie, category: MovieCategory): Movie {
  return { id: movie.id ?? movie.tmdb_id, tmdb_id: movie.tmdb_id, title: movie.title, overview: movie.overview,
    poster_path: movie.poster_path, backdrop_path: movie.backdrop_path,
    release_date: movie.release_date ?? '', vote_average: movie.vote_average, category }
}

function matches(movie: BackendMovie, category: MovieCategory): boolean {
  return movie.media_type === getMediaType(category) &&
    (category !== 'cartoons' || movie.genres.some(genre => genre.tmdb_id === 16))
}

export function createCatalogApi(baseUrl: string, fetcher: typeof fetch = fetch) {
  async function request(path: string, method = 'GET', body?: object): Promise<CatalogResult<unknown>> {
    let url: URL
    try {
      url = new URL(`api/v1/${path}`, `${baseUrl.replace(/\/+$/, '')}/`)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { ok: false, error: 'configuration' }
    } catch { return { ok: false, error: 'configuration' } }
    try {
      const response = await fetcher(url, { method, cache: 'no-store',
        signal: AbortSignal.timeout(method === 'POST' ? 25000 : path.startsWith('discovery/') ? 20000 : 8000),
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      if (response.status === 404) return { ok: false, error: 'not-found' }
      if (!response.ok) return { ok: false, error: 'unavailable' }
      return { ok: true, data: await response.json() as unknown }
    } catch { return { ok: false, error: 'unavailable' } }
  }

  function movieResult(result: CatalogResult<unknown>, category: MovieCategory): CatalogResult<Movie> {
    if (!result.ok) return result
    if (!isBackendMovie(result.data)) return { ok: false, error: 'unavailable' }
    if (!matches(result.data, category)) return { ok: false, error: 'not-found' }
    return { ok: true, data: normalize(result.data, category) }
  }

  return {
    async getMoviesByCategory(category: MovieCategory, query = '', page = 1): Promise<CatalogResult<MoviePage>> {
      const params = new URLSearchParams({ media_type: getMediaType(category), q: query, page: String(page) })
      if (category === 'cartoons') params.set('genre_id', '16')
      const result = await request(`discovery/movies?${params}`)
      if (!result.ok) return result
      const data = result.data
      if (!record(data) || !Array.isArray(data.items) || !data.items.every(isBackendMovie) ||
        !data.items.every(movie => matches(movie, category)) || !positive(data.page) ||
        !nonnegative(data.total_pages) || (data.total_results !== null && !nonnegative(data.total_results))) return { ok: false, error: 'unavailable' }
      return { ok: true, data: { movies: data.items.map(movie => normalize(movie, category)),
        page: data.page, totalPages: data.total_pages, totalResults: data.total_results } }
    },
    async getMovieById(id: string, category: MovieCategory): Promise<CatalogResult<Movie>> {
      return movieResult(await request(`movies/${encodeURIComponent(id)}`), category)
    },
    async getMovieByTmdbId(id: string, category: MovieCategory): Promise<CatalogResult<Movie>> {
      return movieResult(await request(`discovery/movies/${getMediaType(category)}/${encodeURIComponent(id)}`), category)
    },
  }
}

export function decodeSavedMovie(value: unknown): Movie | null {
  if (!isBackendMovie(value) || value.id === null) return null
  const category: MovieCategory = value.media_type === 'tv' ? 'series'
    : value.genres.some(genre => genre.tmdb_id === 16) ? 'cartoons' : 'movies'
  return normalize(value, category)
}

export function decodeMoviePreview(value: unknown): Movie | null {
  if (!isBackendMovie(value) || value.id !== null || value.media_type !== 'movie') return null
  return normalize(value, value.genres.some(genre => genre.tmdb_id === 16) ? 'cartoons' : 'movies')
}
