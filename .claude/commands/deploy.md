Déploie le projet sur le serveur de production (204.168.238.39).

Exécute dans l'ordre :
1. **`git push origin main`** — pousse les commits locaux sur GitHub
2. **`ssh root@204.168.238.39 "bash /var/www/apprenti-revision/deploy.sh"`** — le serveur pull, build et redémarre PM2

Si le push échoue (rien à pousser), continue quand même avec le deploy.
Affiche le statut PM2 final pour confirmer que tout est **online**.
