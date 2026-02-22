# Refactor Bitxen Backend & Frontend

## Backend Refactoring (Phase 1)
- [x] Create clean `app.ts` (Express setup, CORS, Helmet, Pino, Global Error Handler)
- [x] Create clean `server.ts` (Server startup, shutdown, basic database connections)
- [x] Extract `modules/vault/vault.schema.ts` (Zod schemas)
- [x] Extract `modules/vault/vault.helpers.ts` (Rate limiting, nonce computation, answer verification, score lookup logic)
- [x] Extract `modules/vault/vault.controller.ts` (Route handlers extracted into named async functions)
- [x] Extract `modules/vault/vault.route.ts` (Thin router)
- [x] Extract `modules/transactions/transactions.controller.ts` (Arweave relay logic, unified uploadWithRetry)
- [x] Extract `modules/transactions/transactions.route.ts` (Thin router)
- [x] Add global error handler middleware (`middlewares/error.middleware.ts`)
- [x] Review and update `package.json` / `tsconfig.json` for new backend module pathing if required
- [x] Review and update `Dockerfile` for production-ready backend 
- [x] Implement/update unit tests for the newly refactored backend modules

## Frontend Refactoring (Phase 1)
- [x] Extract low-level ABI encoding logic from `metamaskWallet.ts` into a new `lib/abi-encoder.ts` module.
- [x] Update `metamaskWallet.ts` to import definitions from `abi-encoder.ts` to remove duplicated logic. 
- [x] Extract generic Arweave upload functionality from `wanderWallet.ts` (IndexedDB, XHR, SSE listen) into `lib/arweave-upload.ts`.
- [x] Re-export newly separated utility functions from existing files to maintain backward compatibility.
- [x] Clean up remaining duplicate code inside Frontend wallets, or adapt to fully consume newly decoupled packages safely (Successfully verified by NextJS Build).

## Backend Refactoring (Phase 2 - Clean Architecture & Layering)
- [ ] Implement `Domain/Entity` layer (or interface models) to distance schema logic from controller logic.
- [ ] Implement `Repository Layer` for storage interaction (e.g., Arweave, internal DB interactions) isolating the API/controller from database context.
- [ ] Abstract cryptographic algorithms into a dedicated `CryptoService` injected where needed.
- [ ] Implement generic `ResponseFormatter` for uniform API responses instead of adhoc `res.json()`.
- [ ] Refine Pino logging to capture structured logs without exposing PII (Security Hardening).
- [ ] Configure `Helmet` correctly with restrictive CSP rules.

## Frontend Refactoring (Phase 2 - Modularization & Performance)
- [ ] Refactor UI components into a `features/*` folder structure (e.g., `features/vault`, `features/wizard`).
- [x] Isolate business logic into custom hooks (`useVaultClaim`, `useVaultEdit`, `useVaultCreation`, `useArweaveUpload`) separating it from pure UI rendered components.
- [ ] Optimize React renders (Identifying unnecessary re-renders in deep wizard steps).
- [ ] Enhance loading & error states to be more fine-grained and user-friendly (boundary catching).
- [ ] Cleanup centralized API layer (Axios/Fetch wrappers) to handle generic error mapping seamlessly instead of inline `try/catch` per component.

## General
- [x] Update environment files or settings that changed due to refactoring.
- [ ] Introduce integration tests mapping UI actions to backend interactions.
