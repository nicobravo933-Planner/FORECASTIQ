# infra/aws/README.md — Setup AWS EC2 Free Tier

## Infraestructura de producción

```
forecastiq
├── Frontend      → Vercel (free, permanente)
├── Backend API   → AWS EC2 t2.micro (free 12 meses)
├── Celery Worker → AWS EC2 t2.micro (mismo contenedor)
├── Redis         → Upstash (free, permanente — 10k req/día)
├── Database      → Supabase PostgreSQL (free, permanente)
├── Storage       → Supabase Storage (free, 1 GB)
├── MLflow        → Dagshub (free, permanente)
├── Observability → Grafana Cloud (free, permanente)
└── CI/CD         → GitHub Actions (free)

Costo total: $0/mes de forma indefinida
```

---

## Paso 1 — Crear instancia EC2

1. Entrá a [AWS Console](https://console.aws.amazon.com/ec2) → **Launch Instance**
2. **AMI:** Amazon Linux 2023 (free tier eligible)
3. **Instance type:** t2.micro (free tier: 750 hs/mes por 12 meses)
4. **Key pair:** Crear uno nuevo → descargar `.pem` → guardarlo en lugar seguro
5. **Security Group** — abrir estos puertos:
   - `22` SSH — solo tu IP (My IP)
   - `80` HTTP — anywhere (0.0.0.0/0)
   - `443` HTTPS — anywhere (0.0.0.0/0)
6. **Storage:** 20 GB gp3 (free tier incluye 30 GB)
7. Lanzar instancia → copiar la **Public IPv4 address**

---

## Paso 2 — Setup inicial del servidor

```bash
# Conectarte a la instancia
ssh -i tu-key.pem ec2-user@<EC2_PUBLIC_IP>

# Ejecutar script de setup (instala Docker, nginx, utilidades)
curl -fsSL https://raw.githubusercontent.com/<tu-usuario>/forecastiq/main/infra/aws/setup_ec2.sh | bash

# Desconectate y volvé a conectar (para que el grupo docker tome efecto)
exit
ssh -i tu-key.pem ec2-user@<EC2_PUBLIC_IP>
```

---

## Paso 3 — Subir archivos de configuración

```bash
# Desde tu máquina local — copiar docker-compose y .env al EC2
scp -i tu-key.pem docker-compose.yml ec2-user@<EC2_PUBLIC_IP>:/opt/forecastiq/
scp -i tu-key.pem backend/.env       ec2-user@<EC2_PUBLIC_IP>:/opt/forecastiq/backend.env

# En el EC2 — renombrar y editar variables de producción
ssh -i tu-key.pem ec2-user@<EC2_PUBLIC_IP>
cd /opt/forecastiq
mv backend.env backend/.env   # o crear carpeta backend/ primero

# Editar .env: cambiar ENVIRONMENT=production, CELERY_TASK_ALWAYS_EAGER=False,
#              MLFLOW_TRACKING_URI=https://dagshub.com/<user>/forecastiq.mlflow, etc.
nano backend/.env
```

---

## Paso 4 — Levantar la app

```bash
cd /opt/forecastiq

# Setear la imagen de producción
export IMAGE=ghcr.io/<tu-usuario>/forecastiq-backend:latest

# Login a ghcr.io (usar un GitHub Personal Access Token con scope read:packages)
echo <GITHUB_PAT> | docker login ghcr.io -u <tu-usuario> --password-stdin

# Levantar
docker compose up -d

# Verificar
docker compose ps
curl http://localhost:8000/health
```

---

## Paso 5 — Secrets en GitHub Actions

En tu repo → **Settings → Secrets and variables → Actions**, agregar:

| Secret | Valor |
|--------|-------|
| `EC2_HOST` | IP pública del EC2 (o dominio si tenés) |
| `EC2_USER` | `ec2-user` |
| `EC2_SSH_KEY` | Contenido completo del archivo `.pem` |
| `GHCR_TOKEN` | GitHub Personal Access Token (scopes: `read:packages`, `write:packages`) |

Con esos 4 secrets, cada `git push main` despliega automáticamente al EC2.

---

## Dagshub — MLflow tracking gratuito

1. Crear cuenta en [dagshub.com](https://dagshub.com)
2. Crear repo `forecastiq` (puede ser mirror del repo de GitHub)
3. Ir a **Settings → Tokens** → generar token
4. En `backend/.env` de producción:
   ```
   MLFLOW_TRACKING_URI=https://dagshub.com/<tu-usuario>/forecastiq.mlflow
   MLFLOW_TRACKING_USERNAME=<tu-usuario-dagshub>
   MLFLOW_TRACKING_PASSWORD=<token-dagshub>
   ```
5. URL de la UI de MLflow: `https://dagshub.com/<usuario>/forecastiq/experiments`

---

## Terraform (Fase 14)

El setup manual de arriba se codificará con Terraform en la Fase 14.
Ver `infra/terraform/` cuando llegue esa fase.
