'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { BookOpen, FileText, ChevronRight, Search, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { generateFichePDF } from '@/lib/pdf'

export default function RevisionFichesPage() {
  const [fiches, setFiches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function fetchFiches() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('documents')
        .select('id, title, summary_html, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setFiches(data || [])
      setLoading(false)
    }
    fetchFiches()
  }, [])

  const filteredFiches = fiches.filter(f => 
    f.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDownload = (e: React.MouseEvent, fiche: any) => {
    e.preventDefault()
    e.stopPropagation()
    generateFichePDF(fiche)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold mb-2 flex items-center gap-3">
                <BookOpen className="text-accent" size={40} />
                Fiches de Révision
              </h1>
              <p className="text-gray-400">Vos cours transformés en fiches structurées par l'IA.</p>
            </div>
            
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-4 top-3 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher une fiche..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 focus:border-accent outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </header>

          <UserStatusBar />

          {loading ? (
            <div className="flex justify-center p-20">
              <Loader2 className="animate-spin text-accent" size={40} />
            </div>
          ) : filteredFiches.length === 0 ? (
            <div className="text-center p-20 glass-card">
              <FileText size={48} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Aucune fiche disponible</h3>
              <p className="text-gray-400">Uploadez un document pour que l'IA génère automatiquement sa fiche.</p>
              <Link href="/dashboard" className="btn-premium inline-block mt-6">
                Générer une fiche
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredFiches.map(fiche => (
                <Link 
                  key={fiche.id} 
                  href={`/documents/${fiche.id}`}
                  className="glass-card p-6 group hover:border-accent transition-all flex flex-col relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-accent/10 text-accent rounded-lg group-hover:bg-accent group-hover:text-black transition-all">
                      <FileText size={24} />
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                      Générée le {new Date(fiche.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-xl mb-3 group-hover:text-accent transition-colors">{fiche.title}</h3>
                  
                  <div className="text-sm text-gray-500 line-clamp-3 mb-6 leading-relaxed">
                    {/* On nettoie un peu le HTML pour l'aperçu */}
                    {fiche.summary_html?.replace(/<[^>]*>/g, '').substring(0, 150)}...
                  </div>

                  <div className="mt-auto flex items-center justify-between text-accent font-bold text-sm">
                    <span className="flex items-center gap-2">Consulter la fiche <ChevronRight size={16} /></span>
                    <button 
                      onClick={(e) => handleDownload(e, fiche)}
                      className="p-2 hover:bg-accent/10 rounded-full transition-all z-10"
                      title="Télécharger en PDF"
                    >
                      <Download size={16} className="text-gray-600 group-hover:text-accent transition-colors" />
                    </button>
                  </div>
                  
                  {/* Background Decoration */}
                  <div className="absolute -bottom-4 -right-4 text-white/5 transform rotate-12 group-hover:scale-110 transition-transform">
                    <BookOpen size={100} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
