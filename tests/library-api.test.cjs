/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner transpiles TypeScript in memory. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename)

const { createLibraryApi } = require('../src/api/library.ts')
const A = '11111111-1111-4111-8111-111111111111'
const film = { id: 'c9b6a844-febe-4bd2-9687-0fab1b16e871', tmdb_id: 603, media_type: 'movie', title: 'Film', overview: '', poster_path: null, backdrop_path: null, release_date: null, vote_average: 8, genres: [] }
const response = body => new Response(JSON.stringify(body), { status: 200 })
const stamp = '2020-01-01T00:00:00Z'

test('library writes external identities directly to profile endpoints, without separate imports', async () => {
  const api = createLibraryApi('http://backend:8000', async (url, options) => {
    assert.equal(url.pathname, `/api/v1/profiles/${A}/favorites`)
    assert.equal(options.method, 'PUT')
    assert.deepEqual(JSON.parse(options.body), { media_type: 'movie', tmdb_id: 603 })
    return response({ movie: film, created_at: stamp })
  })
  const result = await api.putFavorite(A, { id: 603, category: 'movies', title: 'Untrusted title' })
  assert.equal(result.data.movie.id, film.id)
  assert.equal(result.data.movie.title, 'Film')
})

test('rating updates by UUID send only the rating value', async () => {
  const api = createLibraryApi('http://backend:8000', async (url, options) => {
    assert.equal(url.pathname, `/api/v1/profiles/${A}/ratings/${film.id}`)
    assert.deepEqual(JSON.parse(options.body), { value: 4 })
    return response({ movie: film, value: 4, updated_at: stamp })
  })
  assert.equal((await api.putRating(A, { ...film, category: 'movies' }, 4)).data.value, 4)
})

test('delete handles a 204 body and remains scoped to the profile', async () => {
  const api = createLibraryApi('http://backend:8000', async (url, options) => {
    assert.equal(options.method, 'DELETE')
    assert.equal(url.pathname, `/api/v1/profiles/${A}/favorites/${film.id}`)
    return new Response(null, { status: 204 })
  })
  assert.deepEqual(await api.removeFavorite(A, film.id), { ok: true, data: null })
})

test('malformed library data is rejected instead of becoming an empty successful cache', async () => {
  const api = createLibraryApi('http://backend:8000', async () => response({ favorites: [{ movie: { ...film, id: null }, created_at: stamp }], ratings: [] }))
  assert.equal((await api.getLibrary(A)).ok, false)
})

const recommendations = () => ({ items: [{ movie: { ...film, id: null }, score: 0.7, sources: ['collaborative'], exploratory: false }],
  mode: 'personalized', seed: null,
  strategy: 'item_knn', model_version: 'test-v1', known_ratings: 1, movie_ratings: 2,
  fallback_reason: null, metadata_partial: false, degraded: false, sources: [{ source: 'collaborative', status: 'ready' }] })

test('recommendations stay scoped to the profile and normalize external movie previews', async () => {
  const api = createLibraryApi('http://backend:8000', async (url, options) => {
    assert.equal(url.pathname, `/api/v1/profiles/${A}/recommendations`)
    assert.equal(url.searchParams.get('limit'), '30')
    assert.equal(options.method, 'GET')
    return response(recommendations())
  })
  const result = await api.getRecommendations(A)
  assert.equal(result.ok, true)
  assert.equal(result.data.items[0].movie.id, 603)
  assert.equal(result.data.strategy, 'item_knn')
  assert.equal(result.data.known_ratings, 1)
})

test('recommendations reject duplicate items and malformed scores, counters, and fallback reasons', async () => {
  const good = recommendations()
  for (const body of [
    { ...good, items: [...good.items, ...good.items] },
    { ...good, items: [{ ...good.items[0], score: '0.7' }] },
    { ...good, known_ratings: 3 },
    { ...good, strategy: 'unknown' },
    { ...good, fallback_reason: 'invented' },
    { ...good, items: [{ ...good.items[0], movie: { ...film, id: null, media_type: 'tv' } }] },
  ]) {
    const api = createLibraryApi('http://backend:8000', async () => response(body))
    assert.equal((await api.getRecommendations(A)).ok, false)
  }
})


test('content recommendations work without a model version and expose degraded sources', async () => {
  const body = { ...recommendations(), strategy: 'content', model_version: null, known_ratings: 0,
    degraded: true, items: [{ movie: { ...film, id: null }, score: 0.01, sources: ['content'], exploratory: false }],
    sources: [{ source: 'collaborative', status: 'unavailable' }, { source: 'content', status: 'ready' }] }
  const api = createLibraryApi('http://backend:8000', async () => response(body))
  const result = await api.getRecommendations(A)
  assert.equal(result.ok, true)
  assert.equal(result.data.model_version, null)
  assert.equal(result.data.degraded, true)
})


test('surprise sends the mode and validates the seed and exploration flag', async () => {
  const good = { ...recommendations(), mode: 'surprise', seed: 0, strategy: 'exploration' }
  const api = createLibraryApi('http://backend:8000', async url => {
    assert.equal(url.searchParams.get('mode'), 'surprise')
    assert.equal(url.searchParams.get('limit'), '10')
    return response(good)
  })
  const result = await api.getRecommendations(A, 'surprise')
  assert.equal(result.ok, true)
  assert.equal(result.data.seed, 0)
  for (const body of [
    { ...good, seed: null }, { ...good, seed: -1 }, { ...good, seed: 2 ** 32 },
    { ...good, mode: 'personalized' },
    { ...good, items: [{ ...good.items[0], exploratory: 'yes' }] },
  ]) {
    const invalid = createLibraryApi('http://backend:8000', async () => response(body))
    assert.equal((await invalid.getRecommendations(A, 'surprise')).ok, false)
  }
})


test('personalized recommendations accept thirty unique results and reject excess', async () => {
  const body = recommendations()
  body.items = Array.from({ length: 30 }, (_, index) => ({ ...body.items[0], movie: { ...body.items[0].movie, tmdb_id: 1000 + index } }))
  const api = createLibraryApi('http://backend:8000', async () => response(body))
  assert.equal((await api.getRecommendations(A)).data.items.length, 30)
  body.items.push({ ...body.items[0], movie: { ...body.items[0].movie, tmdb_id: 9999 } })
  assert.equal((await api.getRecommendations(A)).ok, false)
})
