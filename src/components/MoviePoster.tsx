"use client"

import Image from 'next/image'
import { useState } from 'react'

export default function MoviePoster({ path, title, large = false }: { path: string | null; title: string; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (!path || failed) return <div className="poster-placeholder" role="img" aria-label={`Нет постера: ${title}`}><span aria-hidden="true">🎬</span><span>Постер недоступен</span></div>
  return <Image src={`https://image.tmdb.org/t/p/${large ? 'w500' : 'w300'}${path}`}
    alt={title} width={large ? 320 : 170} height={large ? 480 : 255}
    className={large ? 'movie-details__image' : 'movie-card__image'}
    unoptimized onError={() => setFailed(true)} />
}
