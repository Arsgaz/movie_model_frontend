import Link from 'next/link'
import MovieCarousel from '@/src/components/MovieCarousel'
import { categoryLabels, isMovieCategory, type MovieCategory } from '@/src/movie'
import { getMoviesByCategory } from '@/src/moviesApi'

export const dynamic = 'force-dynamic'

type Params = Record<string, string | string[] | undefined>
type Props = { searchParams: Promise<Params> }
export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 150) : ''
  const category = typeof params.category === 'string' && isMovieCategory(params.category) ? params.category : 'movies'
  const categories: MovieCategory[] = query ? [category] : ['movies', 'series', 'cartoons']
  const sections = await Promise.all(categories.map(async category => {
    const value = params[`${category}_page`]
    const page = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Math.min(Number(value), 500) : 1
    return { category, result: await getMoviesByCategory(category, query, page) }
  }))
  function pageLink(category: MovieCategory, page: number) {
    const values = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) if (typeof value === 'string') values.set(key, value)
    values.set(`${category}_page`, String(page))
    return `/?${values}#${category}`
  }
  return <div className="page">
    <section className="catalog-intro">
      <p className="eyebrow">Ваша коллекция хорошего кино</p>
      <h1 className="page-title">Что посмотрим сегодня?</h1>
      <p className="muted">Находите знакомые фильмы, сохраняйте интересное и оценивайте просмотренное.</p>
      <Link href="/ratings" className="intro-link">Мои впечатления о кино →</Link>
    </section>
    <form action="/" className="search-form" role="search">
      <div className="search-field"><label htmlFor="search">Название</label>
        <input id="search" name="q" type="search" placeholder="Найти фильм или сериал" defaultValue={query} maxLength={150} /></div>
      <div className="search-field"><label htmlFor="category">Где искать</label>
        <select id="category" name="category" defaultValue={category}>
          {Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></div>
      <button type="submit" className="button">Найти</button>
      {query && <Link href="/" className="text-button">Сбросить</Link>}
    </form>
    {query && <h2 className="search-heading">Результаты поиска: «{query}»</h2>}
    {sections.map(({ category, result }) => result.ok
      ? <div key={category} id={category} className="catalog-section">
        <MovieCarousel title={categoryLabels[category]} movies={result.data.movies} category={category} />
        <nav className="catalog-pagination" aria-label={`Страницы: ${categoryLabels[category]}`}>
          {result.data.page > 1 && <Link href={pageLink(category, result.data.page - 1)}>← Назад</Link>}
          <span>Страница {result.data.page} из {Math.max(1, result.data.totalPages)}{result.data.totalResults !== null && ` · Найдено: ${result.data.totalResults}`}</span>
          {result.data.page < result.data.totalPages && <Link href={pageLink(category, result.data.page + 1)}>Далее →</Link>}
        </nav>
        {query && category === 'cartoons' && <p className="muted">Показана анимация из текущей страницы поиска. На других страницах могут быть дополнительные совпадения.</p>}
      </div>
      : <section key={category} className="notice" role="status">
        <h2>{categoryLabels[category]}</h2>
        <p>Каталог временно недоступен. Попробуйте обновить страницу позже.</p>
        <Link href="/favorites">Открыть сохранённые фильмы →</Link>
      </section>)}
    <footer className="catalog-footer">Данные и изображения предоставлены TMDB. Приложение не одобрено и не сертифицировано TMDB.</footer>
  </div>
}
