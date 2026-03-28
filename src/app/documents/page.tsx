'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { FileText, Search, Clock, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchDocs()
  }, [])

  async function fetchDocs() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setDocs(data || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce document et ses flashcards ?')) return
    
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (!error) {
      setDocs(docs.filter(d => d.id !== id))
    }
  }

  const filteredDocs = docs.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 transition-all">
        <div className="max-w-6xl mx-auto">
          <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold mb-2">Mes Documents</h1>
              <p className="text-gray-400">Gérez vos cours et fiches de révision</p>
            </div>
            
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-4 top-3 text-gray-500" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher un cours..."
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
          ) : filteredDocs.length === 0 ? (
            <div className="text-center p-20 glass-card">
              <FileText size={48} className="mx-auto text-gray-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">Aucun document trouvé</h3>
              <p className="text-gray-400">Uploadez votre premier cours depuis le tableau de bord.</p>
              <Link href="/dashboard" className="btn-premium inline-block mt-6">
                Retour au Dashboard
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="glass-card p-6 group hover:border-accent/50 transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-accent/10 text-accent rounded-lg">
                      <FileText size={24} />
                    </div>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <h3 className="font-bold text-lg mb-2 line-clamp-1">{doc.title}</h3>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-6">
                    <span className="flex items-center gap-1"><Clock size={12}/> {new Date(doc.created_at).toLocaleDateString()}</span>
                    <span>{Math.round(doc.size / 1024)} KB</span>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex gap-3">
                    <Link 
                      href={`/documents/${doc.id}`}
                      className="flex-1 text-center py-2 bg-white/5 hover:bg-accent hover:text-black rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                    >
                      Ouvrir la fiche <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
