'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const LOGIN_PATH = '/login'
const DEFAULT_AFTER_LOGIN_PATH = '/'
const PARTNERS_PATH = '/cadastros/parceiros'

function getSafeNextPath(): string {
  if (typeof window === 'undefined') return DEFAULT_AFTER_LOGIN_PATH

  const next = new URLSearchParams(window.location.search).get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//')) return DEFAULT_AFTER_LOGIN_PATH
  if (next === LOGIN_PATH || next.startsWith(`${LOGIN_PATH}?`) || next.startsWith(`${LOGIN_PATH}/`)) {
    return DEFAULT_AFTER_LOGIN_PATH
  }

  return next
}

function warnPartnerRedirect(targetPath: string) {
  if (process.env.NODE_ENV !== 'production' && targetPath.startsWith(PARTNERS_PATH)) {
    console.warn('[redirect-debug] origem login-page -> /cadastros/parceiros', {
      rota: window.location.pathname,
      motivo: 'login-success-next',
      next: targetPath
    })
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Sessão JWT gravada nos cookies pelo @supabase/ssr → redireciona para app
    const targetPath = getSafeNextPath()
    warnPartnerRedirect(targetPath)
    router.replace(targetPath)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-gray-900">Sela Sistem</h1>
            <p className="text-sm text-gray-500 mt-1">Entre com sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
