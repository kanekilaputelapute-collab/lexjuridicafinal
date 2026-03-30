import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/dashboard'

  // SÉCURITÉ : Empêcher les redirections ouvertes
  // On ne permet que les chemins relatifs commençant par /
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/dashboard'
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // En cas d'erreur, on redirige vers la page d'accueil avec un message
  return NextResponse.redirect(`${origin}/?error=verification_failed`)
}
