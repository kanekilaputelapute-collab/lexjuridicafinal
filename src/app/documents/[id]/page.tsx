'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { FileText, Download, Send, Bot, User, Loader2, ArrowLeft, Info } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { generateFichePDF } from '@/lib/pdf'
import ReactMarkdown from 'react-markdown'

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

  const sanitizeHTML = (html: string) => {
    if (!html) return ''
    
    // Conversion markdown → HTML
    let cleaned = html
      // Titres
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Gras et italique
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Séparateurs
      .replace(/^---$/gm, '<hr/>')
      // Listes à puces (lignes commençant par * ou -)
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Listes numérotées
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Tableaux markdown (ligne séparatrice ignorée)
      .replace(/^\|(.+)\|$/gm, (match) => {
        const cells = match.split('|').filter(c => c.trim() !== '')
        const isHeader = cells.some(c => c.includes('---'))
        if (isHeader) return ''
        const tag = 'td'
        return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>'
      })
      // Regrouper les <li> consécutifs dans des <ul>
      .replace(/(<li>[\s\S]+?<\/li>)(\s*<li>[\s\S]+?<\/li>)*/g, (match) => `<ul>${match}</ul>`)
      // Regrouper les <tr> consécutifs dans des <table>
      .replace(/(<tr>[\s\S]+?<\/tr>)(\s*<tr>[\s\S]+?<\/tr>)*/g, (match) => `<table class="fiche-table">${match}</table>`)
      // Doubles sauts de ligne → paragraphes
      .replace(/\n\n+/g, '</p><p>')
      // Simple saut de ligne → <br>
      .replace(/\n/g, '<br/>')
      // Supprimer les balises dangereuses
      .replace(/<(script|style|iframe|object|embed)[^>]*>([\s\S]*?)<\/\1>/gi, '')
      .replace(/ on\w+="[^"]*"/gi, '')
      .replace(/ on\w+='[^']*'/gi, '')
      .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    
    return `<p>${cleaned}</p>`
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
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(doc.summary_html) }} 
              className="prose prose-invert prose-gold max-w-none"
            />
          </div>
        </div>

        {/* Right: Socratic Tutor Chat */}
        <div className="flex-[0.8] min-w-[450px] flex flex-col h-[calc(100vh-4rem)] sticky top-8 print:hidden">
          <div className="glass-card flex-1 flex flex-col overflow-hidden border-accent/20 shadow-2xl">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-accent/5">
              <div className="flex items-center gap-3 font-bold text-lg">
                <Bot size={24} className="text-accent" />
                Tuteur Socratique
              </div>
              <div className="p-1.5 rounded-full bg-yellow-500/10 text-yellow-500" title="Style strict académique">
                <Info size={16} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-black/20">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] p-4 rounded-2xl text-[15px] leading-relaxed shadow-lg ${
                    msg.role === 'user' 
                      ? 'bg-accent text-black font-semibold rounded-tr-none' 
                      : 'bg-white/10 border border-white/10 text-gray-100 rounded-tl-none'
                  }`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none animate-pulse">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-5 border-t border-white/10 bg-black/40 flex gap-3">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question juridique ici..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-accent transition-all placeholder:text-gray-600"
              />
              <button 
                type="submit"
                disabled={chatLoading}
                className="p-3 bg-accent text-black rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
          
          <p className="mt-4 text-xs text-center text-gray-500 italic opacity-60">
            "Le tuteur ne donne jamais la solution, il guide votre réflexion."
          </p>
        </div>
      </main>

      <style jsx global>{`
        .fiche-content h1 { color: var(--accent); margin-top: 2.5rem; margin-bottom: 1rem; font-weight: 900; font-size: 1.8rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.5rem; }
        .fiche-content h2 { color: #fff; margin-top: 2rem; margin-bottom: 0.75rem; font-weight: 800; font-size: 1.4rem; border-left: 4px solid var(--accent); padding-left: 1rem; }
        .fiche-content h3 { color: var(--accent); margin-top: 1.5rem; margin-bottom: 0.5rem; font-weight: 800; font-size: 1.15rem; }
        .fiche-content h4 { color: #a0a0a0; margin-top: 1rem; margin-bottom: 0.4rem; font-weight: 700; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .fiche-content hr { border-color: rgba(255,255,255,0.1); margin: 2rem 0; }
        .fiche-content p { margin-bottom: 0.75rem; line-height: 1.8; color: #d1d5db; }
        .fiche-content ul { list-style: none; padding-left: 0; margin: 0.75rem 0 1rem 0; }
        .fiche-content li { margin-bottom: 0.6rem; padding-left: 1.5rem; position: relative; line-height: 1.7; color: #d1d5db; }
        .fiche-content li::before { content: "▸"; color: var(--accent); position: absolute; left: 0; font-size: 0.75rem; top: 0.3rem; }
        .fiche-content strong { color: #fff; font-weight: 700; }
        .fiche-content em { color: #c4b5fd; font-style: italic; }
        .fiche-content table.fiche-table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.875rem; }
        .fiche-content table.fiche-table td { border: 1px solid rgba(255,255,255,0.1); padding: 0.6rem 1rem; color: #d1d5db; }
        .fiche-content table.fiche-table tr:first-child td { background: rgba(201,168,76,0.1); color: var(--accent); font-weight: 700; }
        .fiche-content table.fiche-table tr:nth-child(even) td { background: rgba(255,255,255,0.02); }

        @media print {
          body { background: white !important; color: black !important; }
          .glass-card { background: white !important; border: none !important; color: black !important; backdrop-filter: none !important; }
          .fiche-content h1, .fiche-content h2, .fiche-content h3, .fiche-content h4 { color: #000 !important; border-color: #000 !important; }
          .fiche-content li::before { color: #000 !important; }
          .fiche-content strong { color: #000 !important; }
          .fiche-content p, .fiche-content li, .fiche-content td { color: #000 !important; }
        }
      `}</style>
    </div>
  )
}
