#!/bin/bash
# Script de setup initial du serveur Hetzner (Ubuntu 22.04)
# À exécuter une seule fois en tant que root : bash setup-server.sh

set -e

echo "=== Setup serveur Apprenti Révision ==="

# 1. Mise à jour système
apt update && apt upgrade -y

# 2. Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. PM2
npm install -g pm2

# 4. PostgreSQL
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# 5. Redis
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server

# 6. Nginx
apt install -y nginx
systemctl enable nginx

# 7. Certbot (HTTPS)
apt install -y certbot python3-certbot-nginx

# 8. Git
apt install -y git

# 9. Créer l'utilisateur app
useradd -m -s /bin/bash appuser || true
usermod -aG sudo appuser

# 10. Créer le dossier app
mkdir -p /var/www/apprenti-revision
chown -R appuser:appuser /var/www/apprenti-revision

# 11. PostgreSQL : créer la base et l'utilisateur
sudo -u postgres psql <<SQL
CREATE USER appuser WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE apprenti_revision OWNER appuser;
GRANT ALL PRIVILEGES ON DATABASE apprenti_revision TO appuser;
SQL

echo ""
echo "=== Installation terminée ==="
echo "Prochaines étapes :"
echo "1. Cloner le repo : cd /var/www/apprenti-revision && git clone https://github.com/mateocaestecker2022-arch/apprenti-revision ."
echo "2. Créer le fichier .env (voir .env.example)"
echo "3. Configurer Nginx (voir nginx.conf)"
echo "4. Lancer : npm ci && npm run db:migrate && npm run build && pm2 start npm --name 'apprenti-revision' -- start"
echo "5. HTTPS : certbot --nginx -d TON_DOMAINE.com"
