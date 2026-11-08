"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { useLegacyLibraryStore } from '../store/legacyLibraryStore'

const LegacyContext = createContext(false)
export const useLegacyLibraryReady = () => useContext(LegacyContext)
export const useLibraryReady = () => useLibraryStore(state => !!state.activeProfileId &&
  state.loadedProfileId === state.activeProfileId && !state.loading)

export default function LibraryProvider({ children }: { children: React.ReactNode }) {
  const initialize = useLibraryStore(state => state.initialize)
  const [legacyReady, setLegacyReady] = useState(false)
  useEffect(() => {
    let selected: string | null = null
    try { selected = window.localStorage.getItem('kinoteka-profile-v1') } catch { /* Selection is optional. */ }
    void initialize(selected)
    void Promise.resolve(useLegacyLibraryStore.persist?.rehydrate()).finally(() => setLegacyReady(true))
  }, [initialize])
  return <LegacyContext.Provider value={legacyReady}>{children}</LegacyContext.Provider>
}
