'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { GraduationCap, MessageSquare, ArrowRight, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function ChatSelectionPage() {
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDocs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
        return
      }

      const { data } = await supabase
        .from('documents')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setDocs(data || [])
      setLoading(false)
    }
    fetchDocs()
  }, [])

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 transition-all">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl font-extrabold mb-2 flex items-center gap-3">
              <GraduationCap className="text-accent" size={40} />
              Tuteur Socratique
            </h1>
            <p className="text-gray-400">Sélectionnez un cours pour démarrer une session d'apprentissage guidée par l'IA.</p>
          </header>

          <UserStatusBar />

          <div className="mt-12">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MessageSquare size={20} className="text-accent" />
              Vos cours disponibles
            </h2>

            {loading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-accent" size={32} />
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center p-12 glass-card border-dashed border-2">
                <FileText size={40} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 mb-6">Vous n'avez pas encore de documents pour discuter.</p>
                <Link href="/dashboard" className="btn-premium inline-block">
                  Uploader un cours
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {docs.map(doc => (
                  <Link 
                    key={doc.id} 
                    href={`/documents/${doc.id}`}
                    className="flex items-center justify-between p-6 glass-card hover:border-accent/50 hover:bg-white/5 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-accent/10 text-accent rounded-lg">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-accent transition-colors">{doc.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Ajouté le {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-accent font-bold text-sm opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                      Démarrer le chat <ArrowRight size={16} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12 p-8 glass-card bg-accent/5 border-accent/20">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <span className="text-accent">💡</span> Comment fonctionne le tuteur ?
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Le tuteur socratique est conçu pour vous aider à réfléchir. Au lieu de vous donner les réponses, il vous posera des questions basées sur votre cours pour vous amener à trouver la solution juridique par vous-même. C'est la méthode la plus efficace pour mémoriser le droit sur le long terme.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
