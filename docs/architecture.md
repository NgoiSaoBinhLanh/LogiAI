# TÀI LIỆU KIẾN TRÚC HỆ THỐNG (SINGLE SOURCE OF TRUTH)

Tài liệu này xác định chuẩn kiến trúc kỹ thuật và quy tắc cấu trúc cho dự án Full-stack theo quy định tại `AGENT_RULES.md`.

## 1. Tổng quan Kiến trúc

Hệ thống được tổ chức theo mô hình Monorepo gồm 2 phân hệ độc lập:
- `/frontend`: Ứng dụng Next.js (App Router), React, TypeScript (strict mode), Tailwind CSS, Shadcn/UI.
- `/backend`: RESTful API & WebSocket Server sử dụng Node.js, Express.js, TypeScript, Prisma ORM, PostgreSQL và Redis.

```
project_CS445/
├── AGENT_RULES.md           # Bộ quy tắc làm việc cho AI Agent
├── docker-compose.yml       # Hạ tầng local (PostgreSQL 16, Redis 7)
├── .env.example             # Biến môi trường mẫu gốc
├── package.json             # Root monorepo workspace scripts
├── docs/                    # Single Source of Truth
│   └── architecture.md
├── backend/                 # Phân hệ Backend Express.js
│   ├── prisma/
│   │   └── schema.prisma    # Schema ORM & Database Migration
│   ├── src/
│   │   ├── config/          # Cấu hình môi trường (Zod), Prisma, Logger
│   │   ├── middlewares/     # Middleware bảo mật, Zod validation, Error handling, RBAC
│   │   ├── modules/         # Các module chức năng (Domain-driven / Feature-based)
│   │   │   └── health/      # Health check module
│   │   ├── jobs/            # Background schedulers
│   │   ├── sockets/         # WebSocket handlers (Socket.io)
│   │   ├── utils/           # Utilities & Response helpers
│   │   ├── app.ts           # Cấu hình Express app
│   │   └── server.ts        # Server entry point (HTTP/HTTPS)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/                # Phân hệ Frontend Next.js (App Router)
    ├── src/
    │   ├── app/             # App Router pages & layouts
    │   ├── components/      # UI components (Shadcn/UI) & Business components
    │   │   └── ui/          # Core Shadcn components (button, card, badge, table, dialog, sonner)
    │   ├── hooks/           # Custom React hooks
    │   ├── lib/             # Utility functions (`cn()`)
    │   ├── services/        # API service clients
    │   ├── store/           # Frontend state management
    │   └── types/           # TypeScript type definitions
    ├── components.json      # Cấu hình Shadcn/UI
    ├── tailwind.config.ts   # Cấu hình Tailwind CSS
    ├── .env.example
    ├── package.json
    └── tsconfig.json
```

## 2. Quy chuẩn Kỹ thuật

### 2.1. Backend
- **TypeScript**: Strict mode (`"strict": true`, cấm `any`, cấm `@ts-ignore`).
- **Validation**: Mọi input (params, query, body) đều phải được validate qua Zod schema middleware.
- **Chuẩn hóa API Response**:
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Mô tả kết quả (tùy chọn)",
    "timestamp": "2026-11-25T10:30:00.000Z"
  }
  ```
- **Chuẩn hóa Error Response**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Chi tiết lỗi",
      "details": []
    },
    "timestamp": "2026-11-25T10:30:00.000Z"
  }
  ```
- **Bảo mật**: Sử dụng `helmet`, cấu hình `cors` theo whitelist, không bao giờ để lộ stack trace ở production.

### 2.2. Frontend
- **Framework**: Next.js App Router, React Server Components kết hợp Client Components (`"use client"`) khi có state/interactivity.
- **Styling & UI**: Tailwind CSS kết hợp Shadcn/UI (`cva`, `clsx`, `tailwind-merge`).
- **Icons**: `lucide-react`.
- **Notifications**: `sonner` (Shadcn toast).
