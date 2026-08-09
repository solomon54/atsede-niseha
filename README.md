# ዐጸደ ንስሐ — Atsede Niseha

Progressive Web App for Ethiopian Orthodox spiritual father–child stewardship: **appointments**, **private guidance**, and a **common house** for the flock — never a place to record confession content.

## Docs

| Doc | Role |
| :-- | :--- |
| [`docs/PRODUCT.md`](./docs/PRODUCT.md) | **Product source of truth** |
| [`docs/SRS.md`](./docs/SRS.md) | Technical requirements |
| [`docs/architecture.md`](./docs/architecture.md) | Church operational guide (Amharic) |
| [`TaskPriority.md`](./TaskPriority.md) | Build order |

## Core model

- **Governor** authorizes Fathers  
- **Father** registers Children (EOTC UID) → Child **claims** account  
- **Private Room** — Father ↔ one Child  
- **Common House** — Father + entire flock  
- **Appointments + notifications** — primary loop for in-person confession/counseling logistics  

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Requires Firebase, Pusher, and Cloudinary env vars (see server/client Firebase and messaging config).

## Stack

Next.js · Firebase · Pusher · Dexie · Serwist (PWA) · Tailwind
