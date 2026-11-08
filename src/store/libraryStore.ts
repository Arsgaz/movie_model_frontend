import * as api from '../libraryActions'
import { createLibraryState } from './libraryState'

export const useLibraryStore = createLibraryState(api, id => {
  try {
    if (id) window.localStorage.setItem('kinoteka-profile-v1', id)
    else window.localStorage.removeItem('kinoteka-profile-v1')
  } catch { /* Server data remains available even when browser storage is disabled. */ }
})
