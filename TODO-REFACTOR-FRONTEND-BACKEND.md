Act as a senior fullstack architect with 10+ years experience building scalable SaaS systems.

Saya memiliki project production dengan stack berikut:

Frontend (bitxen-inheritance-old-backup/frontend):
- Next.js (App Router / Pages Router: sebutkan)
- React
- (TypeScript / JavaScript)
- State management: (Zustand / Redux / Context / none)
- Styling: (Tailwind / CSS Module / MUI / dll)

Backend (bitxen-inheritance-old-backup/backend):
- Express.js
- (TypeScript / JavaScript)
- Database: (PostgreSQL / MySQL / MongoDB)
- ORM: (Prisma / Sequelize / Mongoose)
- Auth: (JWT / Session / OAuth)
- Deployment: (Docker / PM2 / VPS / Kubernetes)

Tugas Anda:

Lakukan ARCHITECTURE & CODE AUDIT menyeluruh dan refactor dengan pendekatan enterprise-grade.

---

## STEP 1 — Architecture Audit

Identifikasi secara detail:

1. Code Smell
2. Tight Coupling
3. Hidden Technical Debt
4. Security Risk (XSS, CSRF, injection, validation gap, dll)
5. Performance Bottleneck (render, API latency, N+1 query, dll)
6. Scalability Risk
7. Folder structure issue
8. Anti-pattern (React & Express)
9. Over-engineering atau under-engineering
10. Potensi race condition atau memory leak

Jelaskan masalahnya secara teknis dan spesifik.
Jangan beri teori umum.

---

## STEP 2 — Refactor Design (Clean Architecture Approach)

Refactor menggunakan prinsip:

- Feature-based modular structure
- Clean architecture (domain-driven separation)
- Dependency inversion
- Single responsibility principle
- Reusable abstraction
- Proper layering

Untuk Backend:
- routes
- controller
- service
- repository
- validation
- middleware
- error handler
- response formatter

Untuk Frontend:
- feature folder structure
- separation UI & business logic
- custom hooks
- proper server/client boundary
- centralized API layer
- error & loading strategy
- data caching strategy

Berikan:
- Struktur folder baru
- Contoh implementasi setiap layer
- Flow request dari UI → API → DB

---

## STEP 3 — Performance Optimization

Optimasi:
- Database query
- API response time
- React rendering
- Bundle size
- Caching strategy
- Lazy loading
- Code splitting
- Memoization strategy
- Server Actions vs API route (jika Next.js App Router)

Jelaskan trade-off tiap optimasi.

---

## STEP 4 — Security Hardening

Tambahkan:
- Input validation layer
- Rate limiting
- Helmet config
- CORS strategy
- Auth best practice
- Token storage strategy
- Secure cookie strategy
- Logging & audit trail
- Env management best practice

---

## STEP 5 — Production Readiness

Tambahkan:
- Logging strategy (winston/pino)
- Monitoring strategy
- Error reporting
- Docker optimization
- CI/CD improvement suggestion
- Horizontal scaling strategy
- Stateless design strategy

---

OUTPUT FORMAT WAJIB:

1. Audit Summary
2. Risk Level (Low / Medium / High)
3. Refactored Architecture Structure
4. Sample Refactored Code
5. Performance Improvements
6. Security Improvements
7. Scalability Strategy
8. Trade-off Discussion
9. Final Architecture Diagram (text-based)

Jangan mengubah logic bisnis.
Fokus pada struktur, kualitas, dan robustness.