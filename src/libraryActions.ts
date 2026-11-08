"use server"

import { createLibraryApi, type RecommendationMode, type LegacyEntry } from './api/library'
import type { Movie } from './movie'

const api = () => createLibraryApi(process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000')
export async function listProfiles() { return api().listProfiles() }
export async function createProfile(name: string) { return api().createProfile(name) }
export async function getLibrary(id: string) { return api().getLibrary(id) }
export async function putFavorite(id: string, movie: Movie) { return api().putFavorite(id, movie) }
export async function putRating(id: string, movie: Movie, value: number) { return api().putRating(id, movie, value) }
export async function removeFavorite(id: string, movieId: string) { return api().removeFavorite(id, movieId) }
export async function removeRating(id: string, movieId: string) { return api().removeRating(id, movieId) }
export async function importLegacy(id: string, entries: LegacyEntry[]) { return api().importLegacy(id, entries) }

export async function getRecommendations(id: string, mode: RecommendationMode = 'personalized') { return api().getRecommendations(id, mode) }
