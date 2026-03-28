'use client'
import { useState, useEffect } from 'react'

export default function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) setShow(true)
  }, [])

  const accept = () => {
    localStorage.setItem('cookie-consent', 'true')
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl glass-card p-6 z-[100] border-accent/40 shadow-2xl flex flex-col md:flex-row items-center gap-6">
      <div className="flex-1">
        <h4 className="font-bold text-white mb-1">🍪 Respect de votre vie privée</h4>
        <p className="text-xs text-gray-400">
          LexJuridica utilise des cookies pour améliorer votre expérience et sécuriser votre session. 
          En continuant, vous acceptez notre politique de confidentialité.
        </p>
      </div>
      <div className="flex gap-3 shrink-0">
        <button onClick={accept} className="btn-premium py-2 text-xs">Accepter tout</button>
      </div>
    </div>
  )
}
