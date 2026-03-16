# Flex Up — Tracker Commandes Fournisseurs

Suivi des commandes ouvertes, livraisons et reliquats pour Circular Stream SL / F.one.

## Stack
- React + Vite
- Supabase (Postgres)
- Vercel (déploiement)

## Setup

### 1. Supabase
1. Va sur [supabase.com](https://supabase.com) > ton projet "Order tracker"
2. SQL Editor > New query > colle le contenu de `supabase-schema.sql` > Run
3. Récupère les clés dans Settings > API

### 2. Variables d'environnement
Copie `.env.example` en `.env` et remplis :
```
VITE_SUPABASE_URL=https://cnhkxjinyaaokwobbphg.supabase.co
VITE_SUPABASE_ANON_KEY=ta-clé-anon
```

### 3. Lancer en local
```bash
npm install
npm run dev
```

### 4. Déployer sur Vercel
```bash
# Connecte ton repo GitHub à Vercel
# Ajoute les variables d'env dans Vercel Dashboard
# Deploy automatique à chaque git push
```

## Premier démarrage
Au premier lancement, l'app détecte une base vide et propose d'importer les données SS26. Clique "Importer données SS26".

## Structure
```
src/
  App.jsx          # Composant principal + logique
  App.css          # Styles globaux
  lib/
    supabase.js    # Client Supabase
    seedData.js    # Données SS26 initiales
```
