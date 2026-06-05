# Deploy assets

Production stack for **Hostinger VPS KVM 2** + **Docker Compose**.

| File | Purpose |
|------|---------|
| [docker-compose.production.yml](./docker-compose.production.yml) | `nginx`, `api`, optional `ai` / `worker` profiles |
| [nginx.conf](./nginx.conf) | Active HTTP config mounted into nginx |
| [nginx.conf.example](./nginx.conf.example) | HTTPS template (Certbot paths) |
| [.env.production.example](./.env.production.example) | Environment variable template |

**Documentation:** [../docs/DEPLOY-HOSTINGER.md](../docs/DEPLOY-HOSTINGER.md) · [../docs/SYSTEM-ARCHITECTURE.md](../docs/SYSTEM-ARCHITECTURE.md)
