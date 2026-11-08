"use client"

import Link from 'next/link'
import { useLibraryStore } from '../store/libraryStore'

export default function LibraryStatus() {
  const { initialized, loading, activeProfileId, error, reload } = useLibraryStore()
  if (error) return <div className="notice" role="alert"><p>{error}</p><button type="button" className="button" onClick={() => void reload()}>Повторить</button></div>
  if (!initialized || loading) return <p role="status">Загружаем коллекцию…</p>
  if (!activeProfileId) return <div className="notice"><p>Выберите профиль, чтобы сохранять фильмы и оценки.</p><Link href="/profiles">Выбрать или создать профиль →</Link></div>
  return null
}
