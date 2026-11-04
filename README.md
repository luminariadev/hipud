<div align="center">
  <h1>🍡 Hipud Pre-Order Platform</h1>
  <p><strong>Full-stack Monorepo for Batch-Based Homemade Mochi Pre-Orders & Order Management</strong></p>

  <p>
    <a href="https://github.com/luminariadev/hipud/actions/workflows/ci.yml"><img src="https://github.com/luminariadev/hipud/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
    <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=flat-square&logo=react" alt="React 19"/>
    <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js" alt="Node.js"/>
    <img src="https://img.shields.io/badge/Prisma-5.x-2D3748?style=flat-square&logo=prisma" alt="Prisma ORM"/>
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql" alt="PostgreSQL"/>
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker"/>
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"/>
  </p>

  <p>
    <a href="https://hipud-profile.vercel.app/">🌐 Live Demo: hipud-profile.vercel.app</a>
  </p>
</div>

---

## 📌 Overview

**Hipud** is an end-to-end web platform designed for homemade culinary businesses to handle batch-based pre-orders, down payments (DP), customer reviews, and administrative operations. Built as a typed monorepo separating a React SPA frontend and an Express/Prisma REST API, it solves the logistical challenges of perishable food production schedules.

---

## ✨ Key Features

- 🛒 **Batch-Based Ordering**: Customers order against defined production batches (Online delivery, Booth/Stand, and Danus sales).
- 💳 **DP Checkout & Verification**: Down payment workflows with payment receipt uploads and automated order confirmation.
- 📋 **Order Tracking & Invoicing**: Real-time order progress tracking with automated PDF receipt generation via PDFKit.
- 💬 **Moderated Review System**: Verified customer feedback system with administrative approval controls.
- 🛡️ **Role-Based Admin Portal**: Secure dashboard to manage menus, adjust batch capacities, verify payments, and generate fulfillment sheets.
- 📱 **Mobile-First Experience**: High-performance UI built with React 19, Vite, and Tailwind CSS v4.

---

## 🛠️ Architecture & Tech Stack

```plaintext
┌─────────────────────────┐          HTTP / JSON          ┌─────────────────────────┐
│    frontend-preorder    │ ◄───────────────────────────► │    backend-preorder     │
│ React 19 + Tailwind CSS │                               │  Express 5 + Prisma ORM │
└─────────────────────────┘                               └────────────┬────────────┘
                                                                       │
                                                                       ▼
                                                          ┌─────────────────────────┐
                                                          │   PostgreSQL Database   │
                                                          └─────────────────────────┘
```

- **Frontend (`frontend-preorder`)**:
  - React 19, Vite 8, TypeScript
  - Tailwind CSS v4, Lucide React, SweetAlert2
  - Axios HTTP client & React Router 7
- **Backend (`backend-preorder`)**:
  - Express.js 5, TypeScript, Node.js 20
  - Prisma ORM & PostgreSQL
  - JWT Authentication, bcryptjs password hashing
  - PDFKit for invoice rendering & Node-Cron for scheduled routines
- **Infrastructure**:
  - Docker & Docker Compose (Multi-container stack with PostgreSQL 16)
  - GitHub Actions CI (Type checking and build verification)

---

## 🚀 Quickstart

### Option 1: Docker Compose (Recommended)

Run the full stack (Frontend + Backend + PostgreSQL) with a single command:

```bash
docker compose up -d
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)
- **PostgreSQL**: `localhost:5432`

---

### Option 2: Local Development Setup

#### 1. Backend Setup

```bash
cd backend-preorder
npm install
copy .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

#### 2. Frontend Setup

```bash
cd frontend-preorder
npm install
npm run dev
```

---

## 📁 Repository Structure

```plaintext
hipud/
├── backend-preorder/          # REST API Backend
│   ├── prisma/                # Database schema & migrations
│   ├── src/                   # Controllers, routes, and services
│   ├── Dockerfile             # Multi-stage Node.js build
│   └── package.json
├── frontend-preorder/         # Client SPA
│   ├── src/                   # React components, pages, and hooks
│   ├── Dockerfile             # Multi-stage build with Nginx
│   └── package.json
├── .github/workflows/
│   └── ci.yml                 # Monorepo CI pipeline
├── docker-compose.yml         # Full-stack container orchestration
├── LICENSE                    # MIT License
└── README.md
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
