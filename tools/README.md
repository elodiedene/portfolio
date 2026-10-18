# Outil de création de projets

Un petit outil local pour ajouter un nouveau projet au portfolio sans écrire de HTML.

## Lancer l'outil

Depuis la racine du portfolio, dans le Terminal :

```bash
python3 tools/nouveau-projet.py
```

Le navigateur s'ouvre automatiquement sur le formulaire (`http://localhost:4321`).
Aucune installation nécessaire — Python 3 est déjà présent sur le Mac.

Pour arrêter l'outil : `Ctrl+C` dans le Terminal.

## Ce que fait l'outil quand tu cliques sur « Créer le projet »

1. Crée un nouveau fichier `projetN.html` (numéro suivant automatique) à partir du
   gabarit de tes pages existantes (styles repris tels quels).
2. Ajoute la card correspondante dans `index.html` (au début ou à la fin de la grille).
3. Met à jour la navigation « projet précédent / suivant » entre les pages.
4. Enregistre les images téléversées dans le dossier `images/`.

## Le formulaire

- **En-tête** : titre, tags, entreprise, rôle, année.
- **Card d'accueil** : titre, description, tags, image, position dans la grille.
- **Contenu** : autant de sections que tu veux, chacune remplie de blocs modulaires :
  texte, sous-titre, grille d'objectifs/chiffres, insights, How Might We, encadré,
  deux colonnes avec image, décisions clés, priorisation MoSCoW, image simple,
  galerie d'images. Les blocs et sections se réordonnent avec les flèches ↑ ↓.

### Mise en forme du texte

Dans les champs de texte : `*mot*` donne un *italique*, `**mot**` donne un **gras**.
Dans les blocs « texte », une ligne vide sépare deux paragraphes.

## Note technique

L'insertion des cards repose sur deux commentaires repères dans `index.html` :
`<!-- CARDS:START -->` et `<!-- CARDS:END -->`. Ne pas les supprimer.
