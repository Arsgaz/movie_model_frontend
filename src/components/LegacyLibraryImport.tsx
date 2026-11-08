"use client"

import { useState } from 'react'
import { collectLegacyLibrary } from '../api/legacyLibrary'
import { useLegacyLibraryStore as useLegacyStore } from '../store/legacyLibraryStore'
import { useLibraryStore } from '../store/libraryStore'
import { useLegacyLibraryReady, useLibraryReady } from './LibraryProvider'

export default function LegacyLibraryImport() {
  const legacyReady = useLegacyLibraryReady(), ready = useLibraryReady()
  const favorites = useLegacyStore(state => state.favorites), ratings = useLegacyStore(state => state.ratings)
  const { activeProfileId, profiles, busy, importProgress, importLegacy } = useLibraryStore()
  const [doneProfile, setDoneProfile] = useState<string | null>(null)
  const profile = profiles.find(item => item.id === activeProfileId)
  if (!legacyReady) return null
  const { entries, skipped } = collectLegacyLibrary(favorites, ratings)
  if (!entries.length && !skipped) return null
  async function transfer() {
    const id = activeProfileId
    setDoneProfile(null)
    if (await importLegacy(entries)) setDoneProfile(id)
  }
  return <section className="notice">
    <h2>Коллекция из этого браузера</h2>
    <p>Здесь осталось фильмов: {entries.length}. Перенос добавит их в выбранный профиль. Уже сохранённые серверные оценки останутся прежними. Копия в браузере сохранится.</p>
    {skipped > 0 && <p>Не удалось распознать записей: {skipped}. Они останутся в браузере.</p>}
    {profile ? <button type="button" className="button" disabled={!ready || busy || !entries.length} onClick={() => void transfer()}>
      {busy ? `Переносим: ${importProgress} из ${entries.length}` : `Перенести в профиль «${profile.name}»`}
    </button> : <p>Сначала выберите профиль для переноса.</p>}
    {doneProfile && doneProfile === activeProfileId && <p role="status">Коллекция перенесена в выбранный профиль.</p>}
  </section>
}
