# Sistema de Control Docente & Operaciones de Sede (UPN Comas)

Sistema web progresivo y multipágina en producción en **`https://control-doc.pages.dev`**, construido con **React + Vite + Tailwind CSS**, **Cloudflare Pages Functions** con base de datos **Cloudflare D1 Serverless**, y sincronización en vivo con **OneDrive Excel (`CONTROL DOCENTE.xlsx`)**.

---

## Arquitectura del Proyecto

```text
├── functions/api/[[catchall]].js  # API Serverless en Cloudflare Pages + D1 + Microsoft Graph
├── src/
│   ├── App.jsx                    # Enrutamiento multipágina con historial y gestos swipe
│   ├── components/                # Vistas (Asistencia, Operaciones, Préstamos, Métricas, Reservas)
│   └── utils/                     # Autenticación, sincronización OneDrive/Excel y utilidades PDF
├── server/                        # Servidor local Node/Express + SQLite de respaldo
├── scripts/sync_data.cjs          # Sincronizador local hacia SQLite y Cloudflare D1
├── public/                        # Recursos estáticos e iconos PWA
├── wrangler.toml                  # Configuración Cloudflare Pages (control-doc) y binding D1
└── CONTROL DOCENTE.xlsx           # Plantilla maestra Excel
```

---

## Scripts Principales

- **Desarrollo local:** `npm run dev`
- **Compilación de producción:** `npm run build`
- **Despliegue en Cloudflare Pages (`control-doc.pages.dev`):** `npm run deploy`
- **Sincronización completa (GitHub + Cloudflare):** `actualizar.bat`
