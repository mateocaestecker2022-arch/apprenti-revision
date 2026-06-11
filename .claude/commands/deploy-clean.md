Déploie le projet avec nettoyage complet des node_modules sur le serveur (204.168.238.39).

À utiliser quand le build plante avec **MODULE_NOT_FOUND** ou des erreurs de modules manquants dans node_modules.

Exécute dans l'ordre :
1. **`git push origin main`** — pousse les commits locaux sur GitHub
2. Sur le serveur via SSH :
   - **`cd /var/www/apprenti-revision`**
   - **`find node_modules -delete`** — supprime proprement les node_modules corrompus
   - **`npm ci`** — réinstallation propre depuis package-lock.json
   - **`bash /var/www/apprenti-revision/deploy.sh`** — pull, build, redémarre PM2
3. Si le worker (course-worker) est en **erreur** après le deploy, le redémarrer avec **`pm2 restart course-worker`**

Affiche le statut PM2 final pour confirmer que tout est **online**.
