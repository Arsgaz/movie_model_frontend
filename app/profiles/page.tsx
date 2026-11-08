"use client"

import { useState } from 'react'
import LegacyLibraryImport from '@/src/components/LegacyLibraryImport'
import LibraryStatus from '@/src/components/LibraryStatus'
import { useLibraryStore } from '@/src/store/libraryStore'

export default function ProfilesPage() {
  const [name, setName] = useState('')
  const { profiles, activeProfileId, initialized, loading, busy, selectProfile, createProfile } = useLibraryStore()
  async function submit() { if (await createProfile(name)) setName('') }
  return <div className="page">
    <h1 className="page-title">Профили</h1>
    <p className="page-description muted">У каждого профиля своя коллекция и оценки.</p>
    <LibraryStatus />
    <div className="profile-list">{profiles.map(profile => <button type="button" key={profile.id}
      className={profile.id === activeProfileId ? 'button' : 'profile-option'}
      aria-pressed={profile.id === activeProfileId} disabled={busy}
      onClick={() => void selectProfile(profile.id)}>{profile.name}</button>)}</div>
    <form className="search-form" onSubmit={event => { event.preventDefault(); void submit() }}>
      <div className="search-field"><label htmlFor="profile-name">Новый профиль</label>
        <input id="profile-name" value={name} onChange={event => setName(event.target.value)}
          maxLength={80} required placeholder="Имя профиля" disabled={busy || loading || !initialized} /></div>
      <button className="button" type="submit" disabled={busy || loading || !initialized || !name.trim()}>Создать профиль</button>
    </form>
    <LegacyLibraryImport />
  </div>
}
