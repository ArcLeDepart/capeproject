# ⚔️ Minecraft Cape Creator

Créez et personnalisez votre propre cape Minecraft directement dans votre navigateur.

## Fonctionnalités

- **3 formats de texture** : 512×256, 256×128, 128×64
- **Éditeur pixel** avec outils de dessin :
  - ✏️ Crayon (raccourci : P)
  - 🧹 Gomme (raccourci : E)
  - 🪣 Remplissage (raccourci : F)
  - 💧 Pipette (raccourci : I)
- **Taille de pinceau** ajustable (1-8 px)
- **Palette de couleurs** avec 20 couleurs prédéfinies + sélecteur libre
- **Import d'image** : l'image est automatiquement appliquée sur la face avant et inversée sur la face arrière
- **Grille pixel** et **zones colorées** pour visualiser les faces de la cape
- **Zoom** avec la molette de la souris
- **Annuler** (Ctrl+Z) avec historique jusqu'à 40 actions
- **Téléchargement** en PNG au format texture Minecraft

## Utilisation

1. Ouvrir `index.html` dans un navigateur
2. Choisir un format de texture
3. Dessiner sur la cape ou importer une image
4. Télécharger le fichier PNG

## Structure du projet

```
index.html   - Page principale
style.css    - Styles (thème sombre)
script.js    - Logique de l'application
```

## Format de texture Minecraft

La cape utilise le format standard de texture Minecraft (base 64×32) :

```
    0  1          11 12         22
  0 ┌──┬──────────┬──┬──────────┐
    │  │   Haut   │  │   Bas    │
  1 ├──┼──────────┼──┼──────────┤
    │G │  Avant   │D │ Arrière  │
    │  │  10×16   │  │  10×16   │
 17 └──┴──────────┴──┴──────────┘
```

Les résolutions disponibles sont des multiples de cette base :
- 128×64 (×2)
- 256×128 (×4)
- 512×256 (×8)