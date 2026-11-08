import type { LegacyEntry } from './library'
import { getMediaType, type Movie } from '../movie'

type LegacyRating = { movie: Movie; value: number; updatedAt: string }
export function collectLegacyLibrary(favorites: Movie[], ratings: Record<string, LegacyRating>) {
  const entries = new Map<string, LegacyEntry>()
  let skipped = 0
  function entryFor(movie: Movie): LegacyEntry | null {
    const id = movie.tmdb_id ?? movie.id
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) { skipped++; return null }
    const media = getMediaType(movie.category), key = `${media}:${id}`
    if (!entries.has(key)) entries.set(key, { media_type: media, tmdb_id: id, favorite: false, rating: null, rated_at: null })
    return entries.get(key)!
  }
  for (const movie of favorites) { const entry = entryFor(movie); if (entry) entry.favorite = true }
  for (const rating of Object.values(ratings)) {
    if (!Number.isInteger(rating.value) || rating.value < 1 || rating.value > 5) { skipped++; continue }
    const entry = entryFor(rating.movie)
    if (entry) {
      entry.rating = rating.value
      entry.rated_at = Number.isFinite(Date.parse(rating.updatedAt)) ? new Date(rating.updatedAt).toISOString() : null
    }
  }
  return { entries: [...entries.values()], skipped }
}
