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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    fetchNews()
    // Refresh every 15 minutes
    const interval = setInterval(() => {
      console.log('[NewsTicker] Refreshing news (15-minute interval)')
      fetchNews()
    }, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchNews() {
    try {
      console.log('[NewsTicker] Fetching latest AI news...')
      // Using NewsAPI - you'll need to add your API key to .env.local as NEXT_PUBLIC_NEWS_API_KEY
      const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY

      if (!apiKey) {
        console.log('[NewsTicker] No API key found, using fallback news')
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
          },
          {
            title: "Microsoft integrates GPT-4 into Office 365 suite",
            url: "#",
            source: "The Verge",
            publishedAt: new Date().toISOString()
          },
          {
            title: "Meta AI releases Llama 3 with improved multilingual support",
            url: "#",
            source: "TechCrunch",
            publishedAt: new Date().toISOString()
          },
          {
            title: "Google Gemini Ultra surpasses GPT-4 in benchmark tests",
            url: "#",
            source: "VentureBeat",
            publishedAt: new Date().toISOString()
          },
          {
            title: "Researchers achieve breakthrough in AI safety alignment",
            url: "#",
            source: "MIT Technology Review",
            publishedAt: new Date().toISOString()
          },
          {
            title: "AI-powered drug discovery leads to new cancer treatment",
            url: "#",
            source: "Nature",
            publishedAt: new Date().toISOString()
          },
          {
            title: "OpenAI launches AI agent framework for enterprise applications",
            url: "#",
            source: "TechCrunch",
            publishedAt: new Date().toISOString()
          },
          {
            title: "Neural networks achieve human-level performance in medical diagnosis",
            url: "#",
            source: "Science Daily",
            publishedAt: new Date().toISOString()
          }
        ])
        setLoading(false)
        setLastUpdate(new Date())
        return
      }

      const response = await fetch(
        `https://newsapi.org/v2/everything?q=artificial+intelligence+OR+AI+OR+machine+learning+OR+ChatGPT+OR+OpenAI+OR+Claude+OR+LLM+OR+GPT+OR+neural+network+OR+deep+learning+OR+Gemini+OR+Anthropic+OR+Google+AI+OR+Microsoft+AI+OR+Meta+AI+OR+AI+model+OR+generative+AI&sortBy=publishedAt&language=en&pageSize=50&apiKey=${apiKey}`
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
        console.log(`[NewsTicker] Loaded ${formattedNews.length} articles`)
      }

      setLoading(false)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('[NewsTicker] Failed to fetch news:', error)
      setLoading(false)
    }
  }

  if (loading || news.length === 0) {
    return null
  }

  const formatUpdateTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="ticker-gradient text-white overflow-hidden relative rounded-lg">
      <div className="flex items-center gap-3 py-2 px-4">
        <div className="flex items-center gap-2 shrink-0">
          <Newspaper className="w-4 h-4" />
          <span className="text-sm font-semibold">AI NEWS</span>
          <span className="text-xs text-white/60">({formatUpdateTime(lastUpdate)})</span>
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
        .ticker-gradient {
          background: linear-gradient(90deg, #2563eb 0%, #7c3aed 25%, #2563eb 50%, #7c3aed 75%, #2563eb 100%);
          background-size: 400% 100%;
          animation: gradient-shift 15s linear infinite;
        }

        @keyframes gradient-shift {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }

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
