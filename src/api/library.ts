import { decodeMoviePreview, decodeSavedMovie } from './catalog'
import { getMediaType, isCatalogId, type Movie } from '../movie'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }
export type Profile = { id: string; name: string; created_at: string }
export type FavoriteEntry = { movie: Movie; created_at: string }
export type RatingEntry = { movie: Movie; value: number; updated_at: string }
export type LibrarySnapshot = { favorites: FavoriteEntry[]; ratings: RatingEntry[] }
export type RecommendationSource = 'collaborative' | 'content' | 'popularity'
export type RecommendationMode = 'personalized' | 'surprise'
export type Recommendations = {
  mode: RecommendationMode; seed: number | null
  items: { movie: Movie; score: number; sources: RecommendationSource[]; exploratory: boolean }[]
  strategy: 'item_knn' | 'popularity' | 'content' | 'hybrid' | 'exploration'; model_version: string | null
  known_ratings: number; movie_ratings: number; fallback_reason: string | null; metadata_partial: boolean
  sources: { source: RecommendationSource; status: 'not_configured' | 'ready' | 'unavailable' | 'partial' }[]
  degraded: boolean
}
export type LegacyEntry = { media_type: 'movie' | 'tv'; tmdb_id: number; favorite: boolean; rating: number | null; rated_at: string | null }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const timestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const fail = (): ApiResult<never> => ({ ok: false, error: 'Сервис вернул некорректные данные.' })
function profile(value: unknown): value is Profile {
  return record(value) && typeof value.id === 'string' && isCatalogId(value.id) && typeof value.name === 'string' && timestamp(value.created_at)
}
function favorite(value: unknown): FavoriteEntry | null {
  if (!record(value) || !timestamp(value.created_at)) return null
  const movie = decodeSavedMovie(value.movie)
  return movie ? { movie, created_at: value.created_at } : null
}
function rating(value: unknown): RatingEntry | null {
  if (!record(value) || !timestamp(value.updated_at) || !Number.isInteger(value.value) || Number(value.value) < 1 || Number(value.value) > 5) return null
  const movie = decodeSavedMovie(value.movie)
  return movie ? { movie, value: Number(value.value), updated_at: value.updated_at } : null
}

export function createLibraryApi(baseUrl: string, fetcher: typeof fetch = fetch) {
  async function request(path: string, method = 'GET', body?: object): Promise<ApiResult<unknown>> {
    try {
      const url = new URL(`api/v1/${path}`, `${baseUrl.replace(/\/+$/, '')}/`)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { ok: false, error: 'Не настроен адрес сервиса.' }
      const response = await fetcher(url, { method, cache: 'no-store', signal: AbortSignal.timeout(path.endsWith('/import') ? 120000 : path.includes('/recommendations') ? 60000 : 25000),
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
      if (!response.ok) return { ok: false, error: response.status === 404 ? 'Профиль или фильм не найден.' : response.status === 422 ? 'Проверьте введённые данные.' : 'Не удалось обратиться к сервису. Попробуйте ещё раз.' }
      return { ok: true, data: response.status === 204 ? null : await response.json() as unknown }
    } catch { return { ok: false, error: 'Сервис недоступен. Попробуйте ещё раз.' } }
  }
  const path = (id: string) => `profiles/${encodeURIComponent(id)}`
  function reference(movie: Movie): { suffix: string; body: object } | null {
    if (typeof movie.id === 'string' && isCatalogId(movie.id)) return { suffix: `/${movie.id}`, body: {} }
    const tmdbId = movie.tmdb_id ?? movie.id
    return typeof tmdbId === 'number' && Number.isSafeInteger(tmdbId) && tmdbId > 0
      ? { suffix: '', body: { media_type: getMediaType(movie.category), tmdb_id: tmdbId } } : null
  }
  return {
    async listProfiles(): Promise<ApiResult<Profile[]>> {
      const profiles: Profile[] = []
      for (let offset = 0; ; offset += 100) {
        const result = await request(`profiles?limit=100&offset=${offset}`)
        if (!result.ok) return result
        if (!record(result.data) || !Array.isArray(result.data.items) || !result.data.items.every(profile)) return fail()
        profiles.push(...result.data.items)
        if (result.data.items.length < 100) return { ok: true, data: profiles }
      }
    },
    async createProfile(name: string): Promise<ApiResult<Profile>> {
      const result = await request('profiles', 'POST', { name: name.trim() })
      return !result.ok ? result : profile(result.data) ? { ok: true, data: result.data } : fail()
    },
    async getLibrary(id: string): Promise<ApiResult<LibrarySnapshot>> {
      if (!isCatalogId(id)) return fail()
      const result = await request(`${path(id)}/library`)
      if (!result.ok) return result
      if (!record(result.data) || !Array.isArray(result.data.favorites) || !Array.isArray(result.data.ratings)) return fail()
      const favorites = result.data.favorites.map(favorite)
      const ratings = result.data.ratings.map(rating)
      if (favorites.some(item => item === null) || ratings.some(item => item === null)) return fail()
      return { ok: true, data: { favorites: favorites as FavoriteEntry[], ratings: ratings as RatingEntry[] } }
    },
    async putFavorite(id: string, movie: Movie): Promise<ApiResult<FavoriteEntry>> {
      const ref = reference(movie)
      if (!isCatalogId(id) || !ref) return fail()
      const result = await request(`${path(id)}/favorites${ref.suffix}`, 'PUT', ref.body)
      if (!result.ok) return result
      const entry = favorite(result.data)
      return entry ? { ok: true, data: entry } : fail()
    },
    async putRating(id: string, movie: Movie, value: number): Promise<ApiResult<RatingEntry>> {
      const ref = reference(movie)
      if (!isCatalogId(id) || !ref || !Number.isInteger(value) || value < 1 || value > 5) return fail()
      const result = await request(`${path(id)}/ratings${ref.suffix}`, 'PUT', { ...ref.body, value })
      if (!result.ok) return result
      const entry = rating(result.data)
      return entry ? { ok: true, data: entry } : fail()
    },
    async removeFavorite(id: string, movieId: string): Promise<ApiResult<null>> {
      if (!isCatalogId(id) || !isCatalogId(movieId)) return fail()
      const result = await request(`${path(id)}/favorites/${movieId}`, 'DELETE')
      return result.ok ? { ok: true, data: null } : result
    },
    async removeRating(id: string, movieId: string): Promise<ApiResult<null>> {
      if (!isCatalogId(id) || !isCatalogId(movieId)) return fail()
      const result = await request(`${path(id)}/ratings/${movieId}`, 'DELETE')
      return result.ok ? { ok: true, data: null } : result
    },
    async getRecommendations(id: string, mode: RecommendationMode = 'personalized'): Promise<ApiResult<Recommendations>> {
      if (!isCatalogId(id) || !['personalized', 'surprise'].includes(mode)) return fail()
      const limit = mode === 'personalized' ? 30 : 10
      const result = await request(`${path(id)}/recommendations?limit=${limit}&mode=${mode}`)
      if (!result.ok) return result
      const data = result.data
      if (!record(data) || data.mode !== mode || (mode === 'surprise' ? !Number.isSafeInteger(data.seed) || Number(data.seed) < 0 || Number(data.seed) >= 2 ** 32 : data.seed !== null) || !Array.isArray(data.items) || !['item_knn', 'popularity', 'content', 'hybrid', 'exploration'].includes(String(data.strategy)) ||
        (data.model_version !== null && (typeof data.model_version !== 'string' || !data.model_version)) || typeof data.metadata_partial !== 'boolean' || typeof data.degraded !== 'boolean' || !Array.isArray(data.sources) ||
        !data.sources.every(entry => record(entry) && ['collaborative', 'content', 'popularity'].includes(String(entry.source)) && ['not_configured', 'ready', 'unavailable', 'partial'].includes(String(entry.status))) ||
        !Number.isSafeInteger(data.known_ratings) || Number(data.known_ratings) < 0 ||
        !Number.isSafeInteger(data.movie_ratings) || Number(data.movie_ratings) < Number(data.known_ratings) ||
        ![null, 'baseline_selected', 'no_known_positive_ratings', 'no_positive_candidates', 'model_not_configured', 'model_unavailable'].includes(data.fallback_reason as string | null)) return fail()
      if (new Set(data.sources.map(entry => (entry as Record<string, unknown>).source)).size !== data.sources.length) return fail()
      const items: Recommendations['items'] = []
      for (const item of data.items) {
        if (!record(item) || typeof item.exploratory !== 'boolean' || typeof item.score !== 'number' || !Number.isFinite(item.score) || !Array.isArray(item.sources) || !item.sources.length || !item.sources.every(source => ['collaborative', 'content', 'popularity'].includes(String(source))) || new Set(item.sources).size !== item.sources.length) return fail()
        const movie = decodeMoviePreview(item.movie)
        if (!movie) return fail()
        items.push({ movie, score: item.score, sources: item.sources as RecommendationSource[], exploratory: item.exploratory })
      }
      if (items.length > limit || new Set(items.map(item => item.movie.tmdb_id)).size !== items.length) return fail()
      return { ok: true, data: { items, mode, seed: data.seed as number | null, strategy: data.strategy as Recommendations['strategy'],
        model_version: data.model_version as string | null, known_ratings: Number(data.known_ratings), movie_ratings: Number(data.movie_ratings),
        fallback_reason: data.fallback_reason as string | null, metadata_partial: data.metadata_partial,
        sources: data.sources as Recommendations['sources'], degraded: data.degraded } }
    },
    async importLegacy(id: string, entries: LegacyEntry[]): Promise<ApiResult<number>> {
      if (!isCatalogId(id)) return fail()
      const result = await request(`${path(id)}/library/import`, 'POST', { entries })
      if (!result.ok) return result
      return record(result.data) && Number.isInteger(result.data.processed) ? { ok: true, data: Number(result.data.processed) } : fail()
    },
  }
}
export type LibraryApi = ReturnType<typeof createLibraryApi>
