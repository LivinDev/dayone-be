# Day01 — Backend Build Instructions

**Purpose of this doc:** Hand this to whoever (or whatever AI agent) is building the backend. It covers the business idea in full, the tech stack, the data model, and the build order — enough that decisions can be made independently without needing to ask basic questions back.

---

## 1. The business idea

Day01 is a small, self-funded Indian streetwear brand (domain: **day01.store**) selling **premium heavyweight T-shirts**, each with an **embedded NFC tag**. Tap the tag → it opens a link the owner controls.

- **V1 (build this now):** the tag opens a simple, owner-editable redirect — like a personal link-in-bio, but physical. The owner sets one URL from their dashboard; tapping the tag redirects there.
- **V2 (later, do NOT build yet):** the tag opens a private, moderated personal timeline — the owner uploads photos/notes tied to moments they wore the shirt (a trip, a date, a trek). Gated behind V1 proving real demand. The data model has a placeholder for this (`TimelineEntry`) but it stays unused until explicitly instructed.

The product is a **physical garment** fused with a **small personal digital layer** the owner controls over time — not a static "digital business card" (like competitor TapWear) and not gym/performance branding (like competitor BeastX). The digital layer is personal and reflective, and it grows over time under the owner's control.

---

## 2. Stage and constraints (affects technical decisions)

- **Validation-stage project**, not a funded company — testing real demand with strangers, not scaling yet.
- **First batch: 20-50 physical shirts**, 1-2 designs. Not a large catalog.
- **Founder builds and runs everything alone** — no dev team, no ops team. Favor simple, low-maintenance infra over "enterprise-scale" architecture. Avoid premature complexity (e.g. microservices, queues, caching layers) — a well-structured monolith is the right call at this stage.
- **India-only.** GST invoicing is mandatory (not optional) for every order — this is a real compliance requirement, not a nice-to-have feature.
- **Own website only** — no marketplace integrations (Amazon/Flipkart), no multi-currency, no international shipping.

---

## 3. Account model

**One universal account (email + password)** used across the entire product:
- Shopping: cart, checkout, order history
- NFC feature: viewing purchased shirts, claiming tags, editing redirect destination, and later (V2) adding timeline entries

No OTP-only login, no separate "claim flow" account, no social login required for V1. Standard signup / login / forgot-password with hashed passwords and JWT sessions.

**Staff roles (added 2026-09-07, not in the original spec):** the same `User` table also holds staff accounts via a `role` field — `CUSTOMER` (default, self-signup), `MANAGER`, `ADMIN`. Kept in one table rather than a separate staff table since this is a solo founder + at most one manager, not an org — matches §2's "avoid premature complexity." `/auth/signup` always forces `role: CUSTOMER` server-side no matter what's in the request body; `MANAGER`/`ADMIN` accounts can only be created by an existing `ADMIN` via `POST /users/staff`, or (for the very first admin, bootstrapping) a one-time seed script. See `dayone-be/CLAUDE.md` for the exact permission matrix and implementation detail.

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | NestJS | Structured, modular Node framework |
| ORM | Prisma | Type-safe DB access and migrations |
| Database | PostgreSQL | Relational data fits orders/users/tags well |
| Auth | Passport.js + JWT (`@nestjs/passport`, `@nestjs/jwt`) | Standard NestJS pattern for email+password sessions |
| Password hashing | bcrypt | Secure password storage |
| Payments | Razorpay or Cashfree SDK | India-first, GST-invoice-friendly gateways |
| PDF generation | pdf-lib (or similar) | GST invoice PDFs |
| File storage (V2 only) | AWS S3 | Timeline photos — not needed for V1 |
| Validation | class-validator + class-transformer | Request body validation, built into Nest |
| Hosting | AWS EC2 | Per existing infra plan |

Frontend (already scoped separately) is Next.js + Tailwind + shadcn/ui — this doc is backend-only.

---

## 5. Data model (Prisma schema)

```prisma
enum Role {
  CUSTOMER
  MANAGER
  ADMIN
}

model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  password              String                     // bcrypt hash
  phone                 String?
  name                  String?
  role                  Role      @default(CUSTOMER)
  passwordResetToken    String?   @unique           // sha256 of the raw token sent to the user
  passwordResetExpires  DateTime?
  createdAt             DateTime  @default(now())
  orders                Order[]
  nfcTags               NfcTag[]
  addresses             Address[]
}

// Saved, reusable shipping addresses — added 2026-09-07 for Account Home's
// "Shipping & Addresses" tab, not on the original model list. A user can
// have several, one marked isDefault. `Order.shippingAddress` below stays a
// JSON snapshot taken at checkout — editing/deleting a saved Address here
// must never rewrite a past order's address.
model Address {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  label     String?                    // e.g. "Home", "Work" — optional
  fullName  String
  phone     String
  line1     String
  line2     String?
  city      String
  state     String                     // feeds future GST CGST+SGST vs IGST logic
  pincode   String
  country   String   @default("India")
  isDefault Boolean  @default(false)   // a user's first address auto-becomes default
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Product {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  description   String
  priceInPaise  Int              // store money as integer paise, never float
  gsm           Int?             // e.g. 240
  fit           String?          // e.g. "Oversized Drop Shoulder"
  images        String[]
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  orderItems    OrderItem[]
}

model Order {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  status           OrderStatus @default(PENDING)
  items            OrderItem[]
  shippingAddress  Json
  totalInPaise     Int
  gstAmountInPaise Int
  paymentGatewayId String?
  paymentStatus    PaymentStatus @default(PENDING)
  invoice          Invoice?
  createdAt        DateTime @default(now())
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

// One row = one physical shirt = at most one NfcTag. No `quantity` field —
// every unit is individually NFC-serialized, so "buy 2" means 2 OrderItem
// rows, not one row with quantity 2 (there'd be nowhere to hang the second tag).
model OrderItem {
  id           String  @id @default(cuid())
  orderId      String
  order        Order   @relation(fields: [orderId], references: [id])
  productId    String
  product      Product @relation(fields: [productId], references: [id])
  priceInPaise Int      // snapshot price at time of order
  size         String
  nfcTag       NfcTag?
}

model Invoice {
  id            String   @id @default(cuid())
  orderId       String   @unique
  order         Order    @relation(fields: [orderId], references: [id])
  invoiceNumber String   @unique   // sequential per financial year, e.g. DAY01/2026/0001
  cgstInPaise   Int
  sgstInPaise   Int
  igstInPaise   Int
  hsnCode       String
  pdfUrl        String?
  createdAt     DateTime @default(now())
}

model NfcTag {
  id              String   @id @default(cuid())
  code            String   @unique          // short code written on the physical tag
  status          TagStatus @default(UNCLAIMED)
  orderItemId     String?  @unique          // the one physical shirt this tag is fused to
  orderItem       OrderItem? @relation(fields: [orderItemId], references: [id])
  ownerId         String?
  owner           User?    @relation(fields: [ownerId], references: [id])
  destination     Destination?
  timelineEntries TimelineEntry[]   // V2 only — leave unused in V1
  createdAt       DateTime @default(now())
}

enum TagStatus {
  UNCLAIMED     // manufactured, not linked to a sale
  ASSIGNED      // linked to an order item (one physical shirt), not yet claimed
  CLAIMED       // buyer verified ownership, can edit destination
}

model Destination {
  id        String   @id @default(cuid())
  tagId     String   @unique
  tag       NfcTag   @relation(fields: [tagId], references: [id])
  url       String
  updatedAt DateTime @updatedAt
}

// ============ V2 ONLY — do not build until instructed ============
model TimelineEntry {
  id        String   @id @default(cuid())
  tagId     String
  tag       NfcTag   @relation(fields: [tagId], references: [id])
  photoUrl  String
  caption   String?
  entryDate DateTime
  status    EntryStatus @default(PENDING)
  createdAt DateTime @default(now())
}

enum EntryStatus {
  PENDING    // never auto-publish
  APPROVED
  REJECTED
}
```

---

## 6. Core modules

```
src/
  auth/          → signup, login, forgot/reset password, JWT strategy, guards
  users/         → user CRUD, profile
  products/      → product catalog (admin write, public read)
  orders/        → order creation, history, status
  cart/          → cart logic (likely client-side, synced at checkout)
  payments/      → Razorpay/Cashfree webhook handling, payment verification
  invoices/      → GST invoice generation (tax split, PDF, sequential numbering)
  nfc-tags/      → tag admin tooling, claim flow, tap-redirect logic
  admin/         → admin-only routes (bulk tag generation, order-to-tag linking)
```

---

## 7. Key business logic notes (don't get these wrong)

- **Money is always stored as integer paise**, never float — avoids rounding errors.
- **GST tax split logic:** if buyer's state == seller's state → CGST + SGST; if different → IGST only. This must be correct per order, it's a legal requirement.
- **Invoice numbers are sequential per financial year** (e.g. `DAY01/2026/0001`) — not random.
- **The tap-redirect route (`/t/[code]`) must be fast** — a direct NestJS route doing a DB lookup and 302 redirect, not routed through Next.js SSR (adds latency for no benefit).
  - If `status` is `UNCLAIMED` or `ASSIGNED` → redirect to the claim page
  - If `status` is `CLAIMED` → redirect to `Destination.url`
- **Claim flow verifies ownership via Order ID + email match** — this creates/links the `User` and flips tag status to `CLAIMED`.
- **A tag is permanently bound to its original buyer** — no resale/ownership-transfer logic, ever, for V1 or V2.
- **V2's `TimelineEntry` must never auto-publish** — every entry starts `PENDING` and needs manual admin approval before it's publicly visible. This is a legal requirement (India IT Act intermediary rules), not a style choice — but again, don't build this yet.

---

## 8. Build order

1. **Foundation** — `nest new day01-api`, install Prisma, connect to Postgres, run first migration with the schema above
2. **Auth module** — signup/login/forgot-password, bcrypt, JWT (unblocks frontend auth screens)
3. **Products module** — CRUD, admin write / public read (unblocks Home/Shop/Product Detail)
4. **Orders + Payments** — cart → checkout → Razorpay/Cashfree → order creation on webhook
5. **Invoicing** — auto-generate GST invoice on order confirmation
6. **NFC tag system** — admin bulk-generate → link to the specific order item (one physical shirt) at fulfillment → claim flow → `/t/[code]` redirect
7. **Account/Dashboard APIs** — order history, claimed tags, edit-destination endpoint

**Do not start on V2 (TimelineEntry, moderation queue, timeline pages) until explicitly instructed** — it's gated behind V1 shipping and showing real signal.

---

## 9. Explicit non-goals

- No resale/ownership-transfer flow
- No public social feed or public profile pages
- No social login for V1
- No multi-currency, no international shipping
- No marketplace integrations (Amazon/Flipkart)
- No premature scale infrastructure (microservices, queues, heavy caching) — this is a solo-founder, small-batch validation project
