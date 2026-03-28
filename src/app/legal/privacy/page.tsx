import Link from 'next/link'
import { Shield, ChevronLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0f0f11] text-gray-300 p-8">
      <div className="max-w-3xl mx-auto glass-card p-12">
        <Link href="/" className="flex items-center gap-2 text-accent mb-10 hover:underline">
          <ChevronLeft size={18} /> Retour à l'accueil
        </Link>
        
        <div className="flex items-center gap-4 mb-8">
          <Shield className="text-accent" size={40} />
          <h1 className="text-3xl font-bold text-white uppercase tracking-tighter">Politique de Confidentialité</h1>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <p>Dernière mise à jour : 28 mars 2026</p>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">1. Collecte des Données</h2>
            <p>Nous collectons votre adresse email pour l'authentification et votre pseudonyme (via Google ou manuellement) pour le classement (Leaderboard).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">2. Utilisation des Données</h2>
            <p>Vos données sont utilisées exclusivement pour assurer le bon fonctionnement du système de révision SRS et pour vous envoyer une newsletter périodique si vous y avez consenti.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">3. Conservation des Données</h2>
            <p>Vos données sont conservées aussi longtemps que votre compte est actif sur la plateforme.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">4. Services Tiers</h2>
            <p>Nous utilisons Supabase pour la base de données et l'authentification, ainsi que Mistral AI et Groq pour les fonctionnalités d'intelligence artificielle.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">5. Vos Droits</h2>
            <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
