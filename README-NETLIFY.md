# ERELEC — déploiement Netlify

Cette version transforme le serveur Express + SQLite d'origine en Netlify Functions + Netlify Database (Postgres).

## Déploiement
1. Créer un dépôt GitHub et y mettre le contenu de ce dossier.
2. Dans Netlify : Add new project > Import an existing project > GitHub.
3. Laisser `public` comme Publish directory. Le fichier `netlify.toml` configure les Functions.
4. Dans Netlify, créer la base via Data & Storage > Database, ou avec `netlify database init`.
5. Ajouter les variables d'environnement :
   - `SESSION_SECRET` : une longue valeur aléatoire
   - `ADMIN_PASSWORD` : mot de passe admin initial
6. Déployer.

## Important
La version d'origine utilise SQLite dans un volume Docker. Ce stockage local n'est pas adapté aux Functions Netlify. Cette version utilise donc Postgres via Netlify Database.
