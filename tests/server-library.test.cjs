/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner transpiles TypeScript in memory. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename)

const { createLibraryState } = require('../src/store/libraryState.ts')
const { movieKey } = require('../src/movie.ts')
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const stamp = '2020-01-01T00:00:00Z'
const film = { id: 'c9b6a844-febe-4bd2-9687-0fab1b16e871', tmdb_id: 603, category: 'movies', title: 'Film', overview: '', poster_path: null, release_date: '', vote_average: 8 }
const empty = () => ({ favorites: [], ratings: [] })
const ok = data => ({ ok: true, data: structuredClone(data) })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
function fakeApi() {
  const db = new Map([[A, empty()], [B, empty()]])
  const writes = []
  const api = {
    listProfiles: async () => ok([{ id: A, name: 'A', created_at: stamp }, { id: B, name: 'B', created_at: stamp }]),
    createProfile: async name => ok({ id: B, name, created_at: stamp }),
    getLibrary: async id => ok(db.get(id)),
    putFavorite: async (id, movie) => { writes.push(['favorite', id]); const entry = { movie: { ...movie, id: film.id, tmdb_id: 603 }, created_at: stamp }; db.get(id).favorites.push(entry); return ok(entry) },
    putRating: async (id, movie, value) => { writes.push(['rate', id]); const entry = { movie: { ...movie, id: film.id, tmdb_id: 603 }, value, updated_at: stamp }; db.get(id).ratings = [entry]; return ok(entry) },
    removeFavorite: async (id, movieId) => { writes.push(['unfavorite', id]); db.get(id).favorites = db.get(id).favorites.filter(entry => entry.movie.id !== movieId); return ok(null) },
    removeRating: async (id, movieId) => { writes.push(['unrate', id]); db.get(id).ratings = db.get(id).ratings.filter(entry => entry.movie.id !== movieId); return ok(null) },
    importLegacy: async (_id, entries) => ok(entries.length),
  }
  return { api, db, writes }
}

test('no profile means no writes; successful responses populate only the selected profile cache', async () => {
  const { api, db, writes } = fakeApi()
  const store = createLibraryState(api)
  await store.getState().initialize(null)
  await store.getState().toggleFavorite(film)
  assert.deepEqual(writes, [])
  await store.getState().selectProfile(A)
  await store.getState().toggleFavorite({ ...film, id: 603 })
  assert.equal(store.getState().favorites[0].id, film.id)
  await store.getState().rateMovie(film, 4)
  assert.equal(store.getState().ratings[movieKey(film)].updated_at, stamp)
  assert.deepEqual(db.get(B), empty())
  await store.getState().selectProfile(B)
  assert.deepEqual(store.getState().favorites, [])
  assert.deepEqual(store.getState().ratings, {})
  await store.getState().selectProfile(A)
  assert.equal(store.getState().favorites.length, 1)
})

test('late responses from a previous profile cannot replace the active library', async () => {
  const { api } = fakeApi(), slow = deferred()
  api.getLibrary = id => id === A ? slow.promise : Promise.resolve(ok(empty()))
  const store = createLibraryState(api)
  const first = store.getState().selectProfile(A)
  await store.getState().selectProfile(B)
  slow.resolve(ok({ favorites: [{ movie: film, created_at: stamp }], ratings: [] }))
  await first
  assert.equal(store.getState().activeProfileId, B)
  assert.equal(store.getState().loadedProfileId, B)
  assert.deepEqual(store.getState().favorites, [])
})

test('profile changes clear the old cache immediately, even if the next request fails', async () => {
  const { api, db } = fakeApi(), slow = deferred()
  db.get(A).favorites.push({ movie: film, created_at: stamp })
  const store = createLibraryState(api)
  await store.getState().selectProfile(A)
  api.getLibrary = () => slow.promise
  const next = store.getState().selectProfile(B)
  assert.deepEqual(store.getState().favorites, [])
  assert.equal(store.getState().loadedProfileId, null)
  slow.resolve({ ok: false, error: 'offline' })
  await next
  assert.deepEqual(store.getState().favorites, [])
  assert.equal(store.getState().error, 'offline')
})

test('failed writes never confirm a new rating or favorite', async () => {
  const { api } = fakeApi()
  api.putFavorite = api.putRating = async () => ({ ok: false, error: 'offline' })
  const store = createLibraryState(api)
  await store.getState().selectProfile(A)
  await store.getState().toggleFavorite(film)
  await store.getState().rateMovie(film, 5)
  assert.deepEqual(store.getState().favorites, [])
  assert.deepEqual(store.getState().ratings, {})
  assert.equal(store.getState().busy, false)
  assert.equal(store.getState().error, 'offline')
})

test('delete actions affect only the captured profile and wait for confirmation', async () => {
  const { api, db, writes } = fakeApi()
  for (const id of [A, B]) db.get(id).ratings.push({ movie: film, value: 4, updated_at: stamp })
  const store = createLibraryState(api)
  await store.getState().selectProfile(A)
  await store.getState().removeRating(film)
  assert.deepEqual(writes, [['unrate', A]])
  assert.equal(db.get(B).ratings.length, 1)
  assert.deepEqual(store.getState().ratings, {})
})

test('profile selection is locked during an in-flight mutation', async () => {
  const { api } = fakeApi(), pending = deferred()
  api.putFavorite = () => pending.promise
  const store = createLibraryState(api)
  await store.getState().selectProfile(A)
  const mutation = store.getState().toggleFavorite(film)
  await store.getState().selectProfile(B)
  assert.equal(store.getState().activeProfileId, A)
  pending.resolve(ok({ movie: film, created_at: stamp }))
  await mutation
  assert.equal(store.getState().busy, false)
})

test('legacy import uses bounded batches and reloads server state after partial failure', async () => {
  const { api, db } = fakeApi(), batches = []
  let failSecond = true
  api.importLegacy = async (id, entries) => {
    batches.push(entries.length)
    if (batches.length === 2 && failSecond) return { ok: false, error: 'temporary failure' }
    for (const entry of entries) if (!db.get(id).favorites.some(item => item.movie.tmdb_id === entry.tmdb_id)) {
      db.get(id).favorites.push({ movie: { ...film, id: String(entry.tmdb_id), tmdb_id: entry.tmdb_id }, created_at: stamp })
    }
    return ok(entries.length)
  }
  const entries = Array.from({ length: 11 }, (_, i) => ({ media_type: 'movie', tmdb_id: i + 1, favorite: true, rating: null, rated_at: null }))
  const original = JSON.stringify(entries)
  const store = createLibraryState(api)
  await store.getState().selectProfile(A)
  assert.equal(await store.getState().importLegacy(entries), false)
  assert.deepEqual(batches, [10, 1])
  assert.equal(store.getState().favorites.length, 10)
  failSecond = false
  assert.equal(await store.getState().importLegacy(entries), true)
  assert.equal(store.getState().favorites.length, 11)
  assert.equal(JSON.stringify(entries), original)
})
