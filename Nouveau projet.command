#!/bin/bash
# Lanceur double-clic de l'outil de création de projets.
# Se place à la racine du portfolio, quel que soit l'endroit d'où on le lance.
cd "$(dirname "$0")" || exit 1
echo "Démarrage de l'outil de création de projets…"
python3 tools/nouveau-projet.py
