# Day01 — API

The backend for **[Day01](https://day01.store)**, an independent Indian streetwear label making premium heavyweight T-shirts with an **embedded NFC tag**. Tap the garment with a phone and it opens whatever its owner chooses: a link, or a personal, photo-led *Story*.

This repository is the NestJS REST API. The Next.js storefront lives in a separate repository, [`dayone-web`](https://github.com/LivinDev/dayone-web).

---

## Features

- **Auth and roles**: email/password signup and login, forgot/reset password, JWT (Passport) and bcrypt. There are three roles: `CUSTOMER` (self-signup), `MANAGER` and `ADMIN`. They are enforced by a `RolesGuard` on every protected route.
- **Catalog**: products, colour/size variants with per-variant stock, admin-managed categories, MRP/discount pricing, and soft deactivation.
- **Image uploads**: multipart uploads to AWS S3, auto-compressed with `sharp` (resized to a 2000px cap, JPEG quality 82, transparency kept as PNG).
- **Orders**: checkout with server-computed GST (CGST+SGST within the seller's state, IGST otherwise), sequential invoice numbers, and atomic stock decrement. Payment is cash on delivery for now.
- **GST invoice PDFs**: generated with `pdf-lib` on first request and cached to S3.
- **Reviews**: a customer can review only a product they have actually ordered, one review per product, and eligibility is re-checked server-side on every write.
- **Addresses**: a saved address book with a default address.
- **NFC tags**: bulk generation, assignment to an order item at fulfilment, and claiming by the logged-in owner. `GET /t/:code` is a tap redirect that degrades gracefully to the storefront. Claim routes are rate-limited.
- **Stories**: a tag can point to a public timeline of dated, multi-section, captioned image moments with theme presets and occasion tags.
- **Garment tag requests**: a retrofit service for fitting a tag to a garment the customer already owns, with a staff fulfilment workflow.
- **Staff management**: admin-only creation and listing of staff accounts.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | NestJS 11, TypeScript |
| Database | PostgreSQL, Prisma 7 (`@prisma/adapter-pg`) |
| Auth | `@nestjs/jwt`, Passport JWT, bcrypt |
| Validation | class-validator, class-transformer |
| Rate limiting | `@nestjs/throttler` |
| Files | AWS S3 (`@aws-sdk/client-s3`), Multer, sharp, pdf-lib |
| Package manager | pnpm |

## Getting started

### Prerequisites

- Node.js 20+ and pnpm
- PostgreSQL
- An S3 bucket, needed only for image uploads and invoice PDFs

### Setup

```bash
git clone https://github.com/LivinDev/dayone-be.git
cd dayone-be
pnpm install
cp .env.example .env              # fill in your own values
pnpm exec prisma migrate deploy   # apply migrations
pnpm exec prisma generate
pnpm run seed                     # creates the first ADMIN from SEED_ADMIN_* vars
pnpm run start:dev
```

The API listens on `PORT`, which defaults to 4000 so it doesn't clash with the storefront's dev server on 3000.

### Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port |
| `FRONTEND_ORIGIN` | Storefront URL, used for CORS and tag redirects |
| `CORS_EXTRA_ORIGINS` | Optional comma-separated extra CORS origins |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Token signing secret and lifetime |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | First admin account, used by `pnpm run seed` only |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 uploads |
| `SELLER_*` | Registered seller details printed on GST invoices |

Never commit `.env`. Use a long random `JWT_SECRET` (for example `openssl rand -base64 48`). Give the AWS key the narrowest IAM policy that still allows putting and getting objects in the one bucket.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm run start:dev` | Start in watch mode |
| `pnpm run build` / `pnpm run start:prod` | Build and run compiled output |
| `pnpm run seed` | Create the first admin account |
| `pnpm run lint` / `pnpm run format` | ESLint and Prettier |
| `pnpm test` / `pnpm run test:e2e` | Unit and e2e tests |

## Project structure

```
prisma/
  schema.prisma        Data model
  migrations/          SQL migrations
  seed.ts              First-admin bootstrap
src/
  auth/                Signup, login, password reset, JWT strategy
  users/               Profile (/users/me) and staff management
  products/, variants/, categories/, reviews/
  orders/, invoices/   Checkout, GST calculation, invoice PDFs
  addresses/
  nfc-tags/            Tag generation, assignment, claim, /t/:code redirect
  timeline/            Story entries, sections, images
  garment-tag-requests/
  common/              Guards, decorators, config, utilities
```

## Deployment notes

- Run `pnpm install` on every deploy. `sharp` and `bcrypt` are native modules and must be built on the target machine.
- If a reverse proxy such as nginx sits in front of the API, raise its request body limit (for example `client_max_body_size 10M;`). The default of about 1 MB rejects image uploads before they reach the app's own 5 MB limit.

## Licence

Copyright © Day01. All rights reserved. The source is published for reference. No licence is granted to reuse the brand or code without permission.
