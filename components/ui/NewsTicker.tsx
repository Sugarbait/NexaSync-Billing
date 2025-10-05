'use client'

import React, { useState, useEffect } from 'react'
import { Newspaper } from 'lucide-react'

interface NewsItem {
  title: string
  url: string
  source: string
  publishedAt: string
}

export function NewsTicker() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNews()
    // Refresh every 15 minutes
    const interval = setInterval(fetchNews, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchNews() {
    try {
      // Using NewsAPI - you'll need to add your API key to .env.local as NEXT_PUBLIC_NEWS_API_KEY
      const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY

      if (!apiKey) {
        // Fallback to sample news if no API key
        setNews([
          {
            title: "OpenAI announces GPT-5 with advanced reasoning capabilities",
            url: "#",
            source: "TechCrunch",
            publishedAt: new Date().toISOString()
          },
          {
            title: "Google DeepMind releases new AI model for protein folding",
            url: "#",
            source: "The Verge",
            publishedAt: new Date().toISOString()
          },
          {
            title: "Anthropic's Claude AI reaches 100 million users milestone",
            url: "#",
            source: "VentureBeat",
            publishedAt: new Date().toISOString()
          }
        ])
        setLoading(false)
        return
      }

      const response = await fetch(
        `https://newsapi.org/v2/everything?q=artificial+intelligence+OR+AI+OR+machine+learning+OR+ChatGPT+OR+OpenAI+OR+Claude+OR+LLM&sortBy=publishedAt&language=en&pageSize=10&apiKey=${apiKey}`
      )

      const data = await response.json()

      if (data.articles) {
        const formattedNews = data.articles.map((article: any) => ({
          title: article.title,
          url: article.url,
          source: article.source.name,
          publishedAt: article.publishedAt
        }))
        setNews(formattedNews)
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch news:', error)
      setLoading(false)
    }
  }

  if (loading || news.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white overflow-hidden relative rounded-lg">
      <div className="flex items-center gap-3 py-2 px-4">
        <div className="flex items-center gap-2 shrink-0">
          <Newspaper className="w-4 h-4" />
          <span className="text-sm font-semibold">AI NEWS</span>
          <div className="w-px h-4 bg-white/30"></div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="ticker-wrapper">
            <div className="ticker-content">
              {/* Duplicate the news items to create seamless loop */}
              {[...news, ...news].map((item, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-2 mx-6"
                >
                  <span className="text-sm whitespace-nowrap">{item.title}</span>
                  <span className="text-xs text-white/60 whitespace-nowrap">({item.source})</span>
                  <span className="text-white/40">•</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ticker-wrapper {
          display: flex;
          overflow: hidden;
        }

        .ticker-content {
          display: flex;
          animation: scroll 60s linear infinite;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .ticker-content:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  )
}
