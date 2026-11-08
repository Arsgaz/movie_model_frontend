/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner transpiles TypeScript in memory. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename)
const { collectLegacyLibrary } = require('../src/api/legacyLibrary.ts')
const { movieKey } = require('../src/movie.ts')
const film = { id: 123, category: 'movies', title: 'Film', overview: '', poster_path: null, release_date: '', vote_average: 0 }

test('legacy favorites and ratings merge by media type and TMDB identity', () => {
  const canonical = { ...film, id: 'c9b6a844-febe-4bd2-9687-0fab1b16e871', tmdb_id: 123, category: 'cartoons' }
  assert.equal(movieKey(canonical), movieKey(film))
  const data = collectLegacyLibrary([film, canonical, { ...film, category: 'series' }], {
    'movie:123': { movie: canonical, value: 4, updatedAt: '2020-01-01T00:00:00Z' },
  })
  assert.equal(data.entries.length, 2)
  assert.deepEqual(data.entries[0], { media_type: 'movie', tmdb_id: 123, favorite: true, rating: 4, rated_at: '2020-01-01T00:00:00.000Z' })
  assert.equal(data.entries[1].media_type, 'tv')
})

test('unresolvable legacy identities and invalid ratings are reported without discarding the source', () => {
  const favorites = [{ ...film, id: 'missing-tmdb-id' }]
  const ratings = { bad: { movie: film, value: 8, updatedAt: '' } }
  const data = collectLegacyLibrary(favorites, ratings)
  assert.equal(data.skipped, 2)
  assert.equal(favorites.length, 1)
  assert.equal(ratings.bad.value, 8)
})

test('legacy browser storage is read-only', async () => {
  const original = JSON.stringify({ state: { favorites: [film], ratings: {} }, version: 1 })
  const memory = new Map([['kinoteka-library-v1', original]])
  global.window = { localStorage: {
    getItem: key => memory.get(key) ?? null,
    setItem: () => { throw new Error('Legacy data must not be rewritten') },
    removeItem: () => { throw new Error('Legacy data must not be deleted') },
  } }
  const { useLegacyLibraryStore: store } = require('../src/store/legacyLibraryStore.ts')
  await store.persist.rehydrate()
  assert.equal(store.getState().favorites[0].title, 'Film')
  assert.equal(memory.get('kinoteka-library-v1'), original)
})
