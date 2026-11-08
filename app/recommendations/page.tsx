"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ApiResult, RecommendationMode, Recommendations } from '@/src/api/library'
import { getRecommendations } from '@/src/libraryActions'
import { useLibraryReady } from '@/src/components/LibraryProvider'
import LibraryStatus from '@/src/components/LibraryStatus'
import MovieCard from '@/src/components/MovieCard'
import { useLibraryStore } from '@/src/store/libraryStore'
import { movieKey } from '@/src/movie'

function Results({ profileId, mode }: { profileId: string; mode: RecommendationMode }) {
  const [result, setResult] = useState<ApiResult<Recommendations> | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    void getRecommendations(profileId, mode).then(result => {
      if (active) setResult(result)
    }).catch(() => {
      if (active) setResult({ ok: false, error: 'Не удалось загрузить рекомендации. Повторите попытку.' })
    })
    return () => { active = false }
  }, [profileId, mode, retry])
  if (!result) return <p role="status">Подбираем фильмы…</p>
  if (!result.ok) return <div className="notice" role="alert">
    <p>{result.error}</p>
    <button type="button" className="button" onClick={() => { setResult(null); setRetry(value => value + 1) }}>Повторить</button>
  </div>
  const data = result.data
  return <>
    <div className="notice">
      {mode === 'surprise' ? <><p>Случайная подборка с учётом ваших оценок: похожие фильмы и неожиданные открытия.</p>{data.strategy === 'exploration' && <p>Пока не нашли достаточно связей с вашими оценками — показываем случайные фильмы. Оцените несколько знакомых на 4–5.</p>}<p className="muted">Каждый запрос создаёт новую подборку. Между подборками фильмы могут повторяться.</p><button type="button" className="button" onClick={() => { setResult(null); setRetry(value => value + 1) }}>Ещё подборку</button></> : data.strategy === 'hybrid' ? <p>Подборка учитывает ваши оценки, жанры и описания понравившихся фильмов.</p>
        : data.strategy === 'content' ? <p>Подобрали фильмы по жанрам и описаниям тех, которые вам понравились.</p>
        : data.strategy === 'item_knn' ? <p>Подборка по вашим оценкам фильмов. В ней учтены предпочтения зрителей с похожими вкусами.</p>
        : data.fallback_reason === 'baseline_selected' ? <p>Популярные фильмы по оценкам зрителей.</p>
          : <p>Пока показываем популярные фильмы. Оцените несколько знакомых фильмов на 4–5, чтобы мы могли подобрать похожие.</p>}
      {data.movie_ratings > data.known_ratings && <p>Оценки новых фильмов тоже учитываются в подборе по содержанию.</p>}
      <p className="muted">Оценённые фильмы исключены из подборки. Рекомендации пока доступны только для фильмов.</p>
      {data.degraded && <p>Часть источников сейчас недоступна. Показываем доступную подборку.</p>}
      {data.metadata_partial && <p>Часть описаний и постеров сейчас недоступна. Список рекомендаций сохранён.</p>}
    </div>
    {data.items.length ? <div className="library-grid">{data.items.map(({ movie }) => <MovieCard key={movieKey(movie)} movie={movie} />)}</div>
      : <div className="empty-state"><p>Подходящих фильмов пока не нашлось.</p><Link href="/" className="button">Открыть каталог</Link></div>}
  </>
}

export default function Page() {
  const [mode, setMode] = useState<RecommendationMode>('personalized')
  const ready = useLibraryReady()
  const profileId = useLibraryStore(state => state.activeProfileId)
  const ratings = useLibraryStore(state => state.ratings)
  const signature = Object.values(ratings).map(entry => `${movieKey(entry.movie)}:${entry.value}`).sort().join(',')
  return <div className="page">
    <h1 className="page-title">Для вас</h1>
    <p className="page-description muted">Фильмы, которые могут вам понравиться.</p>
    <div role="group" aria-label="Режим рекомендаций" className="recommendation-modes">
      <button type="button" className="button" aria-pressed={mode === 'personalized'} onClick={() => setMode('personalized')}>Для вас</button>
      <button type="button" className="button" aria-pressed={mode === 'surprise'} onClick={() => setMode('surprise')}>Удиви меня</button>
    </div>
    <LibraryStatus />
    {ready && profileId && <Results key={`${profileId}:${signature}:${mode}`} profileId={profileId} mode={mode} />}
  </div>
}
