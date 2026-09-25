# ERELEC — version Netlify V3

Cette version utilise Netlify Database (PostgreSQL) et Netlify Functions.

## Variables d'environnement
- `SESSION_SECRET` : clé secrète longue et aléatoire
- `ADMIN_PASSWORD` : mot de passe du compte `admin`

La Function utilise `getConnectionString()` de `@netlify/database`, puis passe explicitement la connexion à `getDatabase()`. Cette configuration est nécessaire lorsque la Function est exécutée en mode Lambda compatibility.

## Déploiement
1. Remplacer les fichiers du dépôt GitHub par cette version.
2. Vérifier que la base existe dans Netlify : Data & Storage > Database.
3. Vérifier `SESSION_SECRET` et `ADMIN_PASSWORD` dans les variables d'environnement.
4. Déclencher un nouveau déploiement.

La migration `netlify/database/migrations/0001_create_erelec_tables.sql` crée les tables `users`, `products`, `orders` et `order_items`.

Compte initial :
- identifiant : `admin`
- mot de passe : valeur de `ADMIN_PASSWORD`

Si `ADMIN_PASSWORD` n'est pas défini, la valeur de test par défaut est `ChangeMoi123!`. Pour la production, définir impérativement `ADMIN_PASSWORD`.
