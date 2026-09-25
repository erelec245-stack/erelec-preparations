# ERELEC Netlify V4

Version utilisant l'API moderne Netlify Functions (pas `serverless-http` / Lambda compatibility).
La base est obtenue avec `getDatabase()` afin de bénéficier de la configuration automatique de Netlify Database.

Variables à définir dans Netlify (scope Functions) :
- SESSION_SECRET
- ADMIN_PASSWORD

La fonction crée automatiquement les tables nécessaires au premier appel et crée le compte admin si aucun utilisateur n'existe.
Compte de test : admin / valeur de ADMIN_PASSWORD (ou ChangeMoi123! si non définie).
