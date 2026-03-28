'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { FileText, Download, Send, Bot, User, Loader2, ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { generateFichePDF } from '@/lib/pdf'

export default function DocumentDetailPage() {
  const { id } = useParams()
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis ton tuteur socratique. Je ne te donnerai jamais la réponse directement, mais je t\'aiderai à la trouver par toi-même. De quoi souhaites-tu discuter concernant ce cours ?' }
  ])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    async function fetchDoc() {
      const { data } = await supabase.from('documents').select('*').eq('id', id).single()
      setDoc(data)
      setLoading(false)
    }
    fetchDoc()
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleExportPDF = async () => {
    if (doc) {
      await generateFichePDF(doc)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || chatLoading) return

    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: input, 
          type: 'chat', 
          context: doc.content_raw?.substring(0, 4000), // Envoi du contexte doc
          history: messages 
        })
      })
      
      const { result, error } = await res.json()
      if (error) throw new Error(error)

      setMessages(prev => [...prev, { role: 'assistant', content: result }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Erreur : " + err.message }])
    } finally {
      setChatLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-accent">Analyse du document...</div>
  if (!doc) return <div className="p-8 text-center">Document introuvable.</div>

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 flex gap-8">
        {/* Left: Document Content */}
        <div className="flex-1 max-w-4xl print:max-w-none">
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-accent mb-6 transition-colors print:hidden">
            <ArrowLeft size={16} /> Retour au Dashboard
          </Link>

          <header className="flex justify-between items-start mb-8 print:hidden">
            <div>
              <h1 className="text-3xl font-extrabold mb-2">{doc.title}</h1>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="bg-accent/10 text-accent px-2 py-1 rounded">Fiche IA Générée</span>
                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-accent hover:text-black transition-all font-bold"
            >
              <Download size={18} /> Export PDF
            </button>
          </header>

          <div className="glass-card p-8 min-h-[70vh] fiche-content print:border-none print:p-0">
            <div 
              dangerouslySetInnerHTML={{ __html: doc.summary_html }} 
              className="prose prose-invert prose-gold max-w-none"
            />
          </div>
        </div>

        {/* Right: Socratic Tutor Chat */}
        <div className="w-[400px] flex flex-col h-[calc(100vh-4rem)] sticky top-8 print:hidden">
          <div className="glass-card flex-1 flex flex-col overflow-hidden border-accent/20">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-accent/5">
              <div className="flex items-center gap-2 font-bold">
                <Bot size={20} className="text-accent" />
                Tuteur Socratique
              </div>
              <div className="p-1 rounded-full bg-yellow-500/10 text-yellow-500" title="Style strict académique">
                <Info size={14} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-accent text-black font-medium rounded-tr-none' 
                      : 'bg-white/5 border border-white/10 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none animate-pulse">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pose une question..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-accent"
              />
              <button 
                type="submit"
                disabled={chatLoading}
                className="p-2 bg-accent text-black rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
          
          <p className="mt-4 text-[10px] text-center text-gray-500 italic">
            "Le tuteur ne donne jamais la solution, il guide votre réflexion."
          </p>
        </div>
      </main>

      <style jsx global>{`
        .fiche-content h3 { color: var(--accent); margin-top: 2rem; font-weight: 800; font-size: 1.5rem; border-left: 4px solid var(--accent); padding-left: 1rem; }
        .fiche-content ul { list-style: none; padding-left: 0; margin-top: 1rem; }
        .fiche-content li { margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative; }
        .fiche-content li::before { content: "•"; color: var(--accent); position: absolute; left: 0; font-weight: bold; }
        .fiche-content strong { color: #fff; }
        
        @media print {
          body { background: white !important; color: black !important; }
          .glass-card { background: white !important; border: none !important; color: black !important; backdrop-filter: none !important; }
          .fiche-content h3 { color: #000 !important; border-left-color: #000 !important; }
          .fiche-content li::before { color: #000 !important; }
          .fiche-content strong { color: #000 !important; }
        }
      `}</style>
    </div>
  )
}
