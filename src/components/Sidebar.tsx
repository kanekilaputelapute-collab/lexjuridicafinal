'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Brain, GraduationCap, Trophy, LogOut, BookOpen, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { name: 'Fiches de Révision', icon: BookOpen, href: '/revision-fiches' },
  { name: 'Documents', icon: FileText, href: '/documents' },
  { name: 'Revision SRS', icon: Brain, href: '/revision' },
  { name: 'Tuteur IA', icon: GraduationCap, href: '/chat' },
  { name: 'Duel IA', icon: Zap, href: '/challenge' },
  { name: 'Classement', icon: Trophy, href: '/leaderboard' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <>
      {/* Sidebar Desktop */}
      <aside className="fixed left-0 top-0 h-full w-64 glass-nav hidden md:flex flex-col p-4 z-50">
        <div className="text-2xl font-extrabold text-accent mb-12 px-4 uppercase tracking-tight">
          LexJuridica
        </div>
        
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive ? 'bg-accent text-black font-bold' : 'hover:bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <button 
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={20} />
          <span>Déconnexion</span>
        </button>
      </aside>

      {/* Bottom Nav Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 glass-nav md:hidden flex items-center justify-around px-2 z-50 border-t border-white/5 pb-safe">
        {navItems.slice(0, 5).map((item) => {
          const isActive = pathname === item.href
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                isActive ? 'text-accent' : 'text-gray-500'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.name.split(' ')[0]}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
