#!/bin/bash
# infra/aws/setup_ec2.sh
# ──────────────────────────────────────────────────────────────────────────────
# Script de setup inicial para instancia EC2 t2.micro (Amazon Linux 2023)
# Ejecutar UNA SOLA VEZ después de lanzar la instancia.
#
# Uso:
#   ssh -i tu-key.pem ec2-user@<EC2_PUBLIC_IP>
#   curl -fsSL https://raw.githubusercontent.com/<user>/forecastiq/main/infra/aws/setup_ec2.sh | bash
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "==> [1/6] Actualizando sistema..."
sudo dnf update -y

echo "==> [2/6] Instalando Docker..."
sudo dnf install -y docker
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

echo "==> [3/6] Instalando Docker Compose plugin..."
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "==> [4/6] Instalando utilidades..."
sudo dnf install -y git curl htop

echo "==> [5/6] Creando directorio de la app..."
sudo mkdir -p /opt/forecastiq
sudo chown ec2-user:ec2-user /opt/forecastiq

echo "==> [6/6] Configurando nginx como reverse proxy..."
sudo dnf install -y nginx
sudo systemctl enable nginx

# Config nginx → proxy a FastAPI en puerto 8000
sudo tee /etc/nginx/conf.d/forecastiq.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE — chunked streaming para el chat IA
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }
}
EOF

sudo systemctl start nginx

echo ""
echo "✅ Setup completo."
echo ""
echo "Próximos pasos:"
echo "  1. Desconectate y reconectate SSH (para que docker group surta efecto)"
echo "  2. Copiá el docker-compose.yml y backend/.env a /opt/forecastiq/"
echo "  3. cd /opt/forecastiq && docker compose up -d"
echo ""
echo "  Para HTTPS gratuito con Let's Encrypt (después de apuntar el dominio):"
echo "  sudo dnf install -y certbot python3-certbot-nginx"
echo "  sudo certbot --nginx -d tu-dominio.com"
