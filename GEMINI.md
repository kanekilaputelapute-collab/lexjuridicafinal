# LexJuridica — Instructions Gemini CLI

## DÉMARRAGE DE SESSION
1. Lire tasks/lessons.md — appliquer toutes les leçons avant de toucher quoi que ce soit
2. Lire tasks/todo.md — comprendre l'état actuel
3. Si aucun des deux n'existe, les créer avant de commencer

## WORKFLOW

### 1. Planifier d'abord
- Passer en mode plan pour toute tâche non triviale (3+ étapes)
- Écrire le plan dans tasks/todo.md avant d'implémenter
- Si quelque chose ne va pas, STOP et re-planifier — ne jamais forcer

### 2. Stratégie sous-agents
- Utiliser des sous-agents pour garder le contexte principal propre
- Une tâche par sous-agent
- Investir plus de compute sur les problèmes difficiles

### 3. Boucle d'auto-amélioration
- Après toute correction : mettre à jour tasks/lessons.md
- Format : [date] | ce qui a mal tourné | règle pour l'éviter
- Relire les leçons à chaque démarrage de session

### 4. Standard de vérification
- Ne jamais marquer comme terminé sans preuve que ça fonctionne
- Lancer les tests, vérifier les logs, comparer le comportement
- Se demander : "Est-ce qu'un staff engineer validerait ça ?"

### 5. Exiger l'élégance
- Pour les changements non triviaux : existe-t-il une solution plus élégante ?
- Si un fix semble bricolé : le reconstruire proprement
- Ne pas sur-ingénieriser les choses simples

### 6. Correction de bugs autonome
- Quand on reçoit un bug : le corriger directement
- Aller dans les logs, trouver la cause racine, résoudre
- Pas besoin d'être guidé étape par étape

## PRINCIPES FONDAMENTAUX
- Simplicité d'abord — toucher un minimum de code
- Pas de paresse — causes racines uniquement, pas de fixes temporaires
- Ne jamais supposer — vérifier chemins, APIs, variables avant utilisation
- Demander une seule fois — une question en amont si nécessaire, 
  ne jamais interrompre en cours de tâche

## GESTION DES TÂCHES
1. Planifier → tasks/todo.md
2. Vérifier → confirmer avant d'implémenter
3. Suivre → marquer comme terminé au fur et à mesure
4. Expliquer → résumé de haut niveau à chaque étape
5. Apprendre → tasks/lessons.md après corrections

## STACK TECHNIQUE
- Framework : Next.js 14 App Router
- Auth + DB : Supabase
- IA principale : Mistral Large latest (mistral-large-latest)
- IA fallback : Groq Mixtral (chat uniquement)
- Hébergement : Vercel Free (timeout 60s max par fonction serverless)
- Styling : Tailwind CSS

## CONTRAINTES ABSOLUES
- Ne JAMAIS modifier la logique ou les prompts des FLASHCARDS (Version 3 : Sélectivité Jurisprudentielle & Fond du Droit) sans demande explicite.
- Ne JAMAIS modifier le modèle Gemini : utiliser exclusivement **models/gemini-3.1-flash-lite-preview**.
- Ne JAMAIS dépasser 55s de traitement dans une fonction serverless Vercel
- Ne JAMAIS envoyer plus de 20 000 chars par appel Mistral (chunking frontend)
- Ne JAMAIS modifier la logique auth/quota Supabase sans validation explicite
- Ne JAMAIS ajouter de packages npm sans demander d'abord
- Ne JAMAIS modifier les noms de marque ou textes UI sans demande explicite