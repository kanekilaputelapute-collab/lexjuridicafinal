# Leçons apprises

[28/03/2026] | Erreurs de type bloquant le build (comparaison impossible après narrowing) | Règle : TypeScript peut interdire une comparaison si un bloc IF/RETURN précédent garantit que la valeur est impossible. Supprimer les vérifications redondantes après un narrowing.
[28/03/2026] | Gemini a renommé LexJuridica en LexGemini dans 3 fichiers sans que ce soit demandé | Règle : ne jamais modifier branding/textes UI sans instruction explicite de l'utilisateur
[28/03/2026] | Des erreurs de type bloquaient le build (await manquant, null-safety) | Règle : Toujours lancer 'npm run build' après des modifications structurelles pour garantir l'intégrité du projet.