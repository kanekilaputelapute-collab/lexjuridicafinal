'use client'
import Sidebar from '@/components/Sidebar'
import UserStatusBar from '@/components/UserStatusBar'
import { BookOpen, Zap, Brain, Target, Shield, Info, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function GuidePage() {
  const sections = [
    {
      title: "L'Analyse Juridique IA",
      icon: <Brain className="text-accent" />,
      content: "Uploadez vos cours en PDF ou DOCX. Notre moteur Gemini 1.5 Flash extrait les concepts clés, les délais et la jurisprudence pour créer une fiche de révision structurée et un deck de flashcards intelligent.",
      tip: "Utilisez des documents clairs pour une précision maximale."
    },
    {
      title: "Système de Révision (SRS)",
      icon: <Target className="text-accent" />,
      content: "Basé sur l'algorithme SM-2 (Anki), le site planifie vos révisions. Les cartes que vous maîtrisez reviennent moins souvent, celles qui sont difficiles reviennent plus vite.",
      tip: "Révisez tous les jours pour ne jamais briser votre série (Streak)."
    },
    {
      title: "Duel contre l'IA",
      icon: <Zap className="text-indigo-500" />,
      content: "Testez votre réactivité avec nos mini-cas pratiques de 60 secondes. L'IA génère un scénario basé sur vos propres cours et vous note comme un jury d'examen.",
      tip: "Soyez précis et utilisez les termes juridiques exacts."
    },
    {
      title: "Énergie et XP",
      icon: <Shield className="text-accent" />,
      content: "Chaque interaction IA consomme 1 point d'énergie (40/jour). Gagnez de l'XP en révisant pour monter dans le classement et changer de grade, de Stagiaire à Bâtonnier.",
      tip: "Les quêtes quotidiennes sur le Dashboard offrent des bonus massifs d'XP."
    }
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 transition-all">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10">
            <h1 className="text-4xl font-extrabold mb-2 text-white">Guide d'Utilisation</h1>
            <p className="text-gray-400">Maîtrisez LexJuridica pour réussir vos examens.</p>
          </header>

          <UserStatusBar />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
            {sections.map((section, idx) => (
              <div key={idx} className="glass-card p-8 border-accent/10 hover:border-accent/30 transition-all">
                <div className="p-3 bg-white/5 rounded-2xl w-fit mb-6">
                  {section.icon}
                </div>
                <h2 className="text-xl font-bold mb-4 text-white">{section.title}</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  {section.content}
                </p>
                <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex items-start gap-3">
                  <Info size={16} className="text-accent shrink-0 mt-0.5" />
                  <p className="text-[11px] text-accent font-medium leading-tight">
                    {section.tip}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-8 glass-card bg-indigo-500/5 border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-md">
              <h2 className="text-2xl font-bold mb-2 text-white italic">"Le droit est la plus puissante des armes..."</h2>
              <p className="text-gray-400 text-sm">
                Besoin d'aide supplémentaire ou d'un conseil juridique ? Utilisez le Tuteur Socratique dans la fiche de n'importe quel document.
              </p>
            </div>
            <Link href="/dashboard" className="btn-premium whitespace-nowrap">
              Commencer maintenant
            </Link>
          </div>

          <footer className="mt-12 flex justify-center gap-8 text-xs text-gray-600 font-medium uppercase tracking-widest">
            <Link href="/legal/cgu" className="hover:text-accent transition-colors">CGU</Link>
            <Link href="/legal/privacy" className="hover:text-accent transition-colors">Confidentialité</Link>
          </footer>
        </div>
      </main>
    </div>
  )
}
