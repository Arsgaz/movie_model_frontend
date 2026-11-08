"use client"

import { movieKey, type Movie } from '../movie'
import { useLibraryStore } from '../store/libraryStore'
import { useLibraryReady } from './LibraryProvider'

export default function FavoriteButton({ movie }: { movie: Movie }) {
  const ready = useLibraryReady()
  const favorite = useLibraryStore(state => state.favorites.some(item => movieKey(item) === movieKey(movie)))
  const { busy, toggleFavorite } = useLibraryStore()
  return <div><button type="button" className={`favorite-button favorite-button--${movie.category}`}
    disabled={!ready || busy} aria-pressed={favorite} onClick={() => void toggleFavorite(movie)}>
    {busy ? 'Сохраняем…' : favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
  </button>
  </div>
}
