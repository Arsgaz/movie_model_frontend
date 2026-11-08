import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Movie } from '../movie'

export type LegacyRating = { movie: Movie; value: number; updatedAt: string }
type LegacyLibrary = { favorites: Movie[]; ratings: Record<string, LegacyRating> }

// Read-only access to the previous browser format; importing never clears or rewrites the source.
export const useLegacyLibraryStore = create<LegacyLibrary>()(persist<LegacyLibrary>(() => ({ favorites: [], ratings: {} }), {
  name: 'kinoteka-library-v1', version: 1, skipHydration: true,
  storage: createJSONStorage(() => ({
    getItem: key => window.localStorage.getItem(key),
    setItem: () => {},
    removeItem: () => {},
  })),
}))
