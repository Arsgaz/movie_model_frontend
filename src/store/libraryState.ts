import { create } from 'zustand'
import type { ApiResult, LegacyEntry, LibraryApi, LibrarySnapshot, Profile, RatingEntry } from '../api/library'
import { movieKey, type Movie } from '../movie'

export type ServerLibraryState = {
  profiles: Profile[]; activeProfileId: string | null; loadedProfileId: string | null
  initialized: boolean; loading: boolean; busy: boolean; error: string | null
  favorites: Movie[]; ratings: Record<string, RatingEntry>; importProgress: number
  initialize: (selectedId: string | null) => Promise<void>
  selectProfile: (id: string | null) => Promise<void>
  createProfile: (name: string) => Promise<boolean>
  reload: () => Promise<void>
  toggleFavorite: (movie: Movie) => Promise<void>
  rateMovie: (movie: Movie, value: number) => Promise<void>
  removeRating: (movie: Movie) => Promise<void>
  importLegacy: (entries: LegacyEntry[]) => Promise<boolean>
}

function snapshot(data: LibrarySnapshot) {
  return { favorites: data.favorites.map(entry => entry.movie),
    ratings: Object.fromEntries(data.ratings.map(entry => [movieKey(entry.movie), entry])) }
}

export function createLibraryState(api: LibraryApi, remember: (id: string | null) => void = () => {}) {
  let generation = 0
  let initialization: Promise<void> | null = null
  return create<ServerLibraryState>()((set, get) => {
    async function mutate<T>(operation: (profileId: string) => Promise<ApiResult<T>>, apply: (data: T) => void) {
      const state = get()
      if (state.busy || state.loading || !state.activeProfileId || state.loadedProfileId !== state.activeProfileId) return
      const id = state.activeProfileId, version = generation
      set({ busy: true, error: null })
      try {
        const result = await operation(id)
        if (version !== generation || get().activeProfileId !== id) return
        if (result.ok) apply(result.data)
        else set({ error: result.error })
      } catch { set({ error: 'Не удалось сохранить изменения. Повторите попытку.' }) }
      finally { if (version === generation) set({ busy: false }) }
    }
    return {
      profiles: [], activeProfileId: null, loadedProfileId: null, initialized: false,
      loading: false, busy: false, error: null, favorites: [], ratings: {}, importProgress: 0,
      initialize: async selectedId => {
        if (initialization) return initialization
        initialization = (async () => {
          set({ loading: true, error: null })
          try {
            const result = await api.listProfiles()
            if (!result.ok) { set({ error: result.error, initialized: true, loading: false }); return }
            set({ profiles: result.data, initialized: true, loading: false })
            if (selectedId && result.data.some(profile => profile.id === selectedId)) await get().selectProfile(selectedId)
            else remember(null)
          } catch { set({ error: 'Не удалось загрузить профили.', initialized: true, loading: false }) }
        })()
        await initialization
        initialization = null
      },
      selectProfile: async id => {
        if (get().busy) return
        const version = ++generation
        set({ activeProfileId: id, loadedProfileId: null, favorites: [], ratings: {}, loading: !!id, error: null, importProgress: 0 })
        remember(id)
        if (!id) return
        try {
          const result = await api.getLibrary(id)
          if (version !== generation) return
          if (result.ok) set({ ...snapshot(result.data), loadedProfileId: id, loading: false })
          else set({ loading: false, error: result.error })
        } catch { if (version === generation) set({ loading: false, error: 'Не удалось загрузить коллекцию.' }) }
      },
      createProfile: async name => {
        if (get().busy || get().loading) return false
        set({ busy: true, error: null })
        try {
          const result = await api.createProfile(name)
          if (!result.ok) { set({ error: result.error }); return false }
          set(state => ({ profiles: [...state.profiles, result.data], busy: false }))
          await get().selectProfile(result.data.id)
          return true
        } catch { set({ error: 'Не удалось создать профиль.' }); return false }
        finally { set({ busy: false }) }
      },
      reload: async () => {
        if (!get().initialized || !get().profiles.length) await get().initialize(get().activeProfileId)
        else await get().selectProfile(get().activeProfileId)
      },
      toggleFavorite: async movie => {
        const existing = get().favorites.find(item => movieKey(item) === movieKey(movie))
        if (existing) await mutate(id => api.removeFavorite(id, String(existing.id)), () => set(state => ({
          favorites: state.favorites.filter(item => movieKey(item) !== movieKey(movie)),
        })))
        else await mutate(id => api.putFavorite(id, movie), entry => set(state => ({ favorites: [entry.movie, ...state.favorites] })))
      },
      rateMovie: async (movie, value) => {
        if (!Number.isInteger(value) || value < 1 || value > 5) return
        await mutate(id => api.putRating(id, movie, value), entry => set(state => ({ ratings: { ...state.ratings, [movieKey(entry.movie)]: entry } })))
      },
      removeRating: async movie => {
        const rating = get().ratings[movieKey(movie)]
        if (!rating) return
        await mutate(id => api.removeRating(id, String(rating.movie.id)), () => set(state => {
          const ratings = { ...state.ratings }; delete ratings[movieKey(movie)]
          return { ratings }
        }))
      },
      importLegacy: async entries => {
        const id = get().activeProfileId
        if (!id || get().busy || get().loadedProfileId !== id || !entries.length) return false
        const version = generation
        set({ busy: true, error: null, importProgress: 0 })
        let error: string | null = null
        try {
          for (let start = 0; start < entries.length; start += 10) {
            const result = await api.importLegacy(id, entries.slice(start, start + 10))
            if (!result.ok) { error = result.error; break }
            set({ importProgress: Math.min(start + 10, entries.length) })
          }
          const result = await api.getLibrary(id)
          if (version === generation && result.ok) set(snapshot(result.data))
          else if (!result.ok) error = error ?? result.error
        } catch { error = 'Перенос прерван. Копия в браузере сохранена, перенос можно повторить.' }
        finally { if (version === generation) set({ busy: false, error }) }
        return error === null
      },
    }
  })
}
