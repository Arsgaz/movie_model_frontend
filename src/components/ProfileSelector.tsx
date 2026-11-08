"use client"

import Link from 'next/link'
import { useLibraryStore } from '../store/libraryStore'

export default function ProfileSelector() {
  const { profiles, activeProfileId, initialized, busy, selectProfile } = useLibraryStore()
  return <div className="profile-selector">
    <label htmlFor="active-profile">Профиль</label>
    <select id="active-profile" value={activeProfileId ?? ''} disabled={!initialized || busy}
      onChange={event => void selectProfile(event.target.value || null)}>
      <option value="">Выберите профиль</option>
      {profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
    </select>
    <Link href="/profiles">Управление профилями</Link>
  </div>
}
