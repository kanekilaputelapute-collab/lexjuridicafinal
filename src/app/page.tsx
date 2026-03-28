'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Mail, Lock, Globe, Loader2 } from 'lucide-react'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newsletter, setNewsletter] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      } else {
        if (!newsletter) {
          alert("L'opt-in newsletter est obligatoire pour s'inscrire.")
          setLoading(false)
          return
        }
        
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { 
            data: { newsletter_opt_in: true },
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })
        
        if (error) throw error
        
        if (data?.user) {
          alert("Inscription réussie ! Un email de confirmation vous a été envoyé.")
          setIsLogin(true) // Switch to login after successful signup
        }
      }
    } catch (err: any) {
      alert("Erreur d'authentification : " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/10 via-background to-background">
      <div className="max-w-md w-full glass-card p-8 border-accent/30 shadow-2xl">
        <div className="text-center mb-10">
          <div className="inline-block p-4 bg-accent/20 rounded-2xl text-accent mb-4">
            <Shield size={40} />
          </div>
          <h1 className="text-3xl font-extrabold text-white">LexJuridica</h1>
          <p className="text-gray-400 mt-2">
            {isLogin ? 'Content de vous revoir' : 'Rejoignez l\'élite juridique'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 text-gray-500" size={18} />
            <input 
              type="email" 
              placeholder="Email" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-accent outline-none transition-all text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-gray-500" size={18} />
            <input 
              type="password" 
              placeholder="Mot de passe" 
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-accent outline-none transition-all text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {!isLogin && (
            <label className="flex items-center gap-3 p-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={newsletter}
                onChange={(e) => setNewsletter(e.target.checked)}
                className="w-5 h-5 accent-accent cursor-pointer"
                required
              />
              <span className="text-xs text-gray-400 group-hover:text-gray-200">
                J'accepte de recevoir la newsletter juridique (Obligatoire)
              </span>
            </label>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full btn-premium flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Se connecter' : 'Créer mon compte')}
          </button>
        </form>



        <p className="mt-8 text-center text-sm text-gray-500">
          {isLogin ? "Pas encore de compte ?" : "Déjà membre ?"}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            type="button"
            className="ml-2 text-accent font-bold hover:underline"
          >
            {isLogin ? "S'inscrire" : "Se connecter"}
          </button>
        </p>

        <div className="mt-8 flex justify-center gap-4 text-[10px] text-gray-600">
          <Link href="/legal/cgu" className="hover:text-gray-400">CGU</Link>
          <Link href="/legal/privacy" className="hover:text-gray-400">Confidentialité</Link>
        </div>
      </div>
    </div>
  )
}
