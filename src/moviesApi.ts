import 'server-only'
import { createCatalogApi } from './api/catalog'
import type { MovieCategory } from './movie'

const api = () => createCatalogApi(process.env.BACKEND_API_URL ?? 'http://127.0.0.1:8000')
export const getMoviesByCategory = (category: MovieCategory, query = '', page = 1) => api().getMoviesByCategory(category, query, page)
export const getMovieById = (id: string, category: MovieCategory) => api().getMovieById(id, category)
export const getMovieByTmdbId = (id: string, category: MovieCategory) => api().getMovieByTmdbId(id, category)
