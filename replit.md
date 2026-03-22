# Workspace

## Overview

NeuroSight — CS-LBP Facial Recognition System. A full-stack web app with user authentication, live face detection and recognition, attendance tracking, and CSV import/export.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite
- **Face Recognition**: @vladmandic/face-api (face-api.js) with SSD Mobilenet + FaceNet 128-D descriptors
- **Auth**: Replit Auth (OpenID Connect + PKCE) via `@workspace/replit-auth-web`

## Features

- **5 Modules**: Dashboard, Recognition (image upload + webcam), Live Camera feed, CSV Dataset, Attendance
- **Face Detection**: face-api.js loaded from CDN (SSD MobileNet v1 for detection, FaceNet for 128-D descriptors)
- **CS-LBP + DBN pipeline**: Real implementation in `src/lib/cs-lbp.ts` — face crop → grayscale → CS-LBP codes (4 symmetric neighbor pairs per pixel) → 4×4 spatial histogram (256-D) → combined with FaceNet 128-D → DBN (384→256→128, sigmoid, deterministic seeded weights, L2-normalised) → enhanced 128-D descriptor stored in DB and used for recognition. Backend mirrors DBN in `src/lib/cs-lbp-dbn.ts` to upgrade legacy FaceNet-only descriptors at comparison time.
- **Bounding boxes**: Green for known faces (name + confidence %), red for unknowns
- **Mobile support**: Camera facing mode toggle (front/back camera)
- **Attendance system**: Auto-marks attendance on recognition, CSV export
- **Database storage**: All recognitions and attendance records stored in PostgreSQL

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server with auth + face routes
│   └── face-recognition/   # React + Vite frontend (mounted at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── replit-auth-web/    # Replit Auth browser hook
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- `users` — authenticated users (from Replit OIDC)
- `sessions` — session storage for auth
- `faces` — registered face records (name, label, 128-D descriptor JSON, optional image)
- `recognition_logs` — every recognition event with person name, confidence, timestamp
- `attendance` — attendance records (date, check-in time, status)

## API Routes

- `GET /api/auth/user` — current auth state
- `GET /api/login` / `GET /api/logout` / `GET /api/callback` — OIDC auth flow
- `GET/POST /api/faces` — list/register faces
- `DELETE /api/faces/:id` — delete face
- `POST /api/recognition/identify` — identify face by descriptor
- `GET/POST /api/recognition/log` — recognition event logs
- `GET/POST /api/attendance` — attendance records
- `GET /api/attendance/export` — CSV export
- `POST /api/csv/import` — import persons from CSV
- `GET /api/stats` — system statistics

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only `.d.ts` files emitted during typecheck
- **Project references** — cross-package imports require `references` array in tsconfig

## Root Scripts

- `pnpm run build` — runs typecheck first, then recursively builds
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API types from OpenAPI
