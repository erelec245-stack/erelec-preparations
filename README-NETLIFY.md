# ERELEC Netlify V4

Version utilisant l'API moderne Netlify Functions (pas `serverless-http` / Lambda compatibility).
La base est obtenue avec `getDatabase()` afin de bénéficier de la configuration automatique de Netlify Database.

Variables à définir dans Netlify (scope Functions) :
- SESSION_SECRET
- ADMIN_PASSWORD

La fonction crée automatiquement les tables nécessaires au premier appel et crée le compte admin si aucun utilisateur n'existe.
Compte de test : admin / valeur de ADMIN_PASSWORD (ou ChangeMoi123! si non définie).

## V5
Ajout dans l'onglet Nouvelle préparation d'un bouton « Ajouter un produit » dans le catalogue. La fonction est réservée à l'administrateur et utilise POST /api/products.

## V6
Suppression du champ Catégorie dans le formulaire d'ajout de produit.

## V7
L'onglet actif du tableau de bord est maintenant affiché en bleu, notamment « Mes préparations » lorsqu'il est sélectionné.

## V8
Dans l'onglet Dépôt, chaque ligne d'article possède une case à cocher. Le bouton « Préparation prête » reste désactivé tant que toutes les lignes ne sont pas cochées. L'onglet Dépôt reste bleu lorsqu'il est sélectionné.

## V9
Ajout d'un onglet Utilisateurs visible uniquement pour les administrateurs. L'administrateur peut créer des comptes utilisateur avec nom, identifiant et mot de passe. Les utilisateurs standards ne voient ni l'onglet Dépôt ni l'onglet Utilisateurs. L'API bloque également l'accès non administrateur au changement de statut et limite les préparations retournées à celles de l'utilisateur.
