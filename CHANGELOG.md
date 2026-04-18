# Changelog

Tous les changements notables de **yt-dl** seront documentés dans ce fichier.

---

## [1.2.2] - 2026-04-18

### Ajouté

- Système de **file d'attente** (queue) avec traitement séquentiel des téléchargements
- Bouton flottant de file d'attente avec anneau de progression circulaire (SVG)
- Badge compteur sur le bouton de file d'attente
- Panneau dropdown de la file d'attente avec détails par item (progression, vitesse, ETA, numéro de playlist)
- Annulation individuelle d'un téléchargement depuis la file d'attente
- Bouton « vider » pour retirer les éléments terminés/annulés de la file d'attente
- Barre de progression principale sous les contrôles de téléchargement
- **Options par vidéo** (per-video settings) : qualité, codec, conteneur vidéo, format et bitrate audio modifiables pour chaque téléchargement sans changer les paramètres globaux
- Bouton toggle pour afficher/masquer les options par vidéo
- **Prévisualisation vidéo** avec miniature, titre, chaîne, durée et taille estimée
- Détection automatique des playlists dans la prévisualisation (badge « Playlist », nombre de vidéos)
- Drag & drop d'URL dans le champ de saisie
- Coller global (detecte un URL YouTube collé en dehors du champ)
- **Console de log** en temps réel dans les paramètres avancés (sortie yt-dlp)
- Bouton « Copier la commande » pour copier la commande yt-dlp exacte
- Bouton « Vider » pour effacer la console de log
- **Historique des téléchargements** avec date, mode (vidéo/audio), titre, dossier
- Bouton « Ouvrir le dossier » dans l'historique
- Bouton « Vider l'historique »
- Limite de 200 entrées dans l'historique
- **Notification système** (Electron Notification) à la fin d'un téléchargement
- **SponsorBlock** : option pour marquer les segments sponsorisés dans la barre de progression
- **Sous-titres** : téléchargement automatique avec choix de langue (en, fr, de, es, ja) et conversion en SRT
- **Piste audio / doublage** : sélection de la langue de la piste audio (par défaut, français, anglais)
- **Intégration de la miniature** dans les fichiers audio (embed thumbnail + conversion en JPG)
- **Mode verbose** : ajoute `-v` aux commandes yt-dlp pour un log détaillé
- **Outils de développement** (DevTools) activables via paramètre (F12)
- **Désactivation de l'accélération GPU** avec avertissement de redémarrage nécessaire
- **Mise à jour des binaires** (yt-dlp, ffmpeg, deno) depuis les paramètres
- Affichage de la version de yt-dlp installée
- **Import / export de la configuration** au format JSON
- **Réinitialisation** de la configuration aux valeurs par défaut
- **Système de thèmes personnalisés** chargés depuis `assets/themes/` avec :
  - Feuille de style CSS (`theme.css`)
  - Image de fond (`background.png`)
  - Icône personnalisée (`icon.png`)
  - Bannière (`banner.png`)
  - Police personnalisée (`font.ttf` ou `font.otf`)
  - Phrases personnalisées aléatoires (`theme.json` → `customPhrases`)
  - Grille de sélection visuelle des thèmes avec cartes (aperçu, icône, bannière)
- Thèmes intégrés :
  - **Deltarune** (phrases thématiques, police personnalisée, fond et icône)
  - **Easter Egg** (phrase personnalisée, fond et icône)
- Bascule **mode sombre / mode clair** (désactivée automatiquement quand un thème custom est actif)
- **i18n** : interface bilingue français / anglais avec détection automatique de la langue système
- Paramètre d'**animations** (activées, minimales, désactivées) avec transitions CSS personnalisables
- **Écran d'initialisation** avec barre de progression lors du premier téléchargement des binaires (yt-dlp, ffmpeg, deno)
- **Gestion des binaires** : téléchargement automatique et extraction (ZIP sur Windows, tar.xz sur Linux) de yt-dlp, ffmpeg et deno
- Support multi-plateforme des chemins de binaires (Windows exe, Linux/Mac binaire)
- Extraction ZIP via PowerShell sur Windows, `unzip`/`tar` sur les autres plateformes
- **Build** : packaging Electron avec electron-builder (NSIS installer + portable .exe) pour Windows
- Fichier ESLint avec configuration pour main (Node.js) et renderer (browser)
- Prettier pour le formatage du code
- Licence GPLv3

### Technique

- Architecture Electron avec **context isolation** et **preload script** sécurisé
- Communication IPC entre main et renderer via `contextBridge`
- Validation des URL YouTube (watch, shorts, embed, v, playlist, youtu.be, music.youtube.com)
- Construction dynamique des arguments yt-dlp selon le mode, codec, qualité, conteneur, piste audio
- Format de sortie vidéo : `bestvideo[codec][height]+bestaudio[language]` avec fallbacks
- Format de sortie audio : extraction + conversion + bitrate personnalisé
- Nettoyage des artefacts de téléchargement en cas d'annulation (fichiers .part, .ytdl)
- Arrêt forcé des processus via `taskkill /T /F` sur Windows, `SIGKILL` sur les autres OS
- Parsing en temps réel de la sortie yt-dlp (progression %, taille, vitesse, ETA, item playlist)
- Sanitization des noms de dossiers de playlist (caractères interdits, longueur max 150)
- Politique de sécurité du contenu (CSP) dans le HTML
- Variables CSS personnalisées pour les thèmes (dark/light + custom)
- Design monospace (Space Mono) avec palette minimaliste noir et blanc
- Navigation par onglets dans les paramètres (Général, Apparence, Vidéo, Audio, Avancé, Historique)
- Transition animée entre l'écran principal et l'écran des paramètres

---

## [1.2.1] - 2026-04-XX

### Ajouté

- Build NSIS installer et portable pour Windows (v1.2.1)

---

## [1.0.0] - Initial Release

### Ajouté

- Application Electron de base pour le téléchargement YouTube
- Champ de saisie d'URL avec bouton « Coller »
- Bascule mode vidéo / audio
- Bouton de téléchargement et d'annulation
- Sélection du dossier de destination
- Téléchargement automatique des binaires (yt-dlp, ffmpeg)
- Thème sombre par défaut
- Paramètres de base (qualité vidéo, codec, format audio, bitrate)
- Écran de paramètres avec navigation
