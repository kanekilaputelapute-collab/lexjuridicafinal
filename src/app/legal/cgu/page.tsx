import Link from 'next/link'
import { Shield, ChevronLeft } from 'lucide-react'

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-[#0f0f11] text-gray-300 p-8">
      <div className="max-w-3xl mx-auto glass-card p-12">
        <Link href="/" className="flex items-center gap-2 text-accent mb-10 hover:underline">
          <ChevronLeft size={18} /> Retour à l'accueil
        </Link>
        
        <div className="flex items-center gap-4 mb-8">
          <Shield className="text-accent" size={40} />
          <h1 className="text-3xl font-bold text-white uppercase tracking-tighter">Conditions Générales d'Utilisation</h1>
        </div>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-2">1. Objet</h2>
            <p>LexJuridica propose une plateforme de révision juridique assistée par intelligence artificielle (SRS + IA).</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">2. Accès au service</h2>
            <p>L'accès est réservé aux étudiants et professionnels du droit. L'inscription nécessite une adresse email valide.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">3. Propriété Intellectuelle</h2>
            <p>Tous les contenus générés ou fournis restent la propriété de LexJuridica ou de leurs auteurs respectifs.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">4. Limitation de Responsabilité</h2>
            <p>L'IA peut générer des erreurs. LexJuridica ne saurait être tenu responsable des conséquences juridiques liées à l'utilisation des contenus.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">5. Modification</h2>
            <p>Nous nous réservons le droit de modifier ces CGU à tout moment pour nous adapter aux évolutions du service.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
