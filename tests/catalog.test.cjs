/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner transpiles TypeScript in memory. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename)
const { createCatalogApi } = require('../src/api/catalog.ts')
const { movieKey } = require('../src/movie.ts')
const film = { id: 'c9b6a844-febe-4bd2-9687-0fab1b16e871', tmdb_id: 123, media_type: 'movie',
  title: 'Коко', overview: '', poster_path: null, backdrop_path: null, release_date: null,
  vote_average: 8.2, genres: [{ tmdb_id: 16, name: 'Анимация' }] }
const response = body => new Response(JSON.stringify(body), { status: 200 })

test('catalog GET translates category and pagination without import or credential', async () => {
  const api = createCatalogApi('http://backend:8000', async (url, options) => {
    assert.equal(url.origin, 'http://backend:8000')
    assert.equal(url.pathname, '/api/v1/discovery/movies')
    assert.equal(url.searchParams.get('genre_id'), '16')
    assert.equal(url.searchParams.get('q'), 'Коко & кино')
    assert.equal(url.searchParams.get('page'), '2')
    assert.equal(options.method, 'GET')
    assert.equal(options.body, undefined)
    assert.equal(url.searchParams.has('api_key'), false)
    return response({ items: [film], page: 2, total_pages: 3, total_results: 41 })
  })
  const result = await api.getMoviesByCategory('cartoons', 'Коко & кино', 2)
  assert.equal(result.ok, true)
  assert.equal(result.data.movies[0].id, film.id)
  assert.equal(result.data.movies[0].tmdb_id, 123)
  assert.equal(movieKey(result.data.movies[0]), 'movie:123')
  assert.equal(result.data.movies[0].release_date, '')
  assert.equal(result.data.totalPages, 3)
})

test('details use UUID while legacy lookup uses the scoped TMDB identity', async () => {
  const paths = []
  const api = createCatalogApi('http://backend:8000', async url => { paths.push(url.pathname); return response(film) })
  assert.equal((await api.getMovieById(film.id, 'movies')).ok, true)
  assert.equal((await api.getMovieByTmdbId('123', 'movies')).ok, true)
  assert.deepEqual(paths, [`/api/v1/movies/${film.id}`, '/api/v1/discovery/movies/movie/123'])
  assert.deepEqual(await api.getMovieById(film.id, 'series'), { ok: false, error: 'not-found' })
})

test('invalid backend data is reported instead of silently dropping catalog items', async () => {
  const api = createCatalogApi('http://backend:8000', async () => response({ items: [{ ...film, id: 'bad-id' }], page: 1, total_pages: 1, total_results: 1 }))
  assert.deepEqual(await api.getMoviesByCategory('movies'), { ok: false, error: 'unavailable' })
})

test('network and HTTP failures keep not-found distinct from unavailable', async () => {
  for (const status of [404, 500, 503]) {
    const api = createCatalogApi('http://backend:8000', async () => new Response('', { status }))
    assert.deepEqual(await api.getMovieById(film.id, 'movies'), { ok: false, error: status === 404 ? 'not-found' : 'unavailable' })
  }
  const api = createCatalogApi('http://backend:8000', async () => { throw new Error('connection refused') })
  assert.deepEqual(await api.getMoviesByCategory('movies'), { ok: false, error: 'unavailable' })
})

test('invalid server address is rejected before making a request', async () => {
  const api = createCatalogApi('file:///etc/', async () => { throw new Error('must not fetch') })
  assert.deepEqual(await api.getMoviesByCategory('movies'), { ok: false, error: 'configuration' })
})


test('remote previews need no database UUID and genre-filtered totals may be unknown', async () => {
  const api = createCatalogApi('http://backend:8000', async () => response({ items: [{ ...film, id: null }], page: 1, total_pages: 3, total_results: null }))
  const result = await api.getMoviesByCategory('cartoons', 'Коко')
  assert.equal(result.ok, true)
  assert.equal(result.data.movies[0].id, 123)
  assert.equal(result.data.totalResults, null)
})
