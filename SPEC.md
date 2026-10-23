# ZE Order & Billing System — Specification

Version 1.2 · 2026-10-20

This document is the single source of truth for what the app does and how it is built. Domain terms live in [GLOSSARY.md](GLOSSARY.md). If code and this spec disagree, one of them is wrong — fix it or update the spec.

**Changes since 1.1:** Products are customer-specific with one supplier and their own prices (Customer Products / Supplier Products removed) · everything is priced per piece (units removed) · editable per-document dates · sent WOs are cancelled, never deleted · Challan gets a Needs re-send flag · Share counts only when completed · optimistic locking on orders · Admin-only Activity Log replacing the status and download logs.

---

## 1. Business context

**Zahir Enterprise (ZE)** is a back-to-back trading business. It supplies packaging products (poly packets, boxes, etc.) to shops and businesses, but owns no factory.

How a deal works:

1. A **Customer** (e.g. *Highway Sweets*) orders a product from ZE (e.g. bread poly packets).
2. ZE places a **Work Order** with the **Supplier** factory that makes that product (e.g. *Suzinas*), in ZE's own name.
3. The supplier delivers the goods to ZE.
4. ZE takes the goods directly to the customer with a **Challan** (delivery note).
5. ZE sends the customer an **Invoice**. The customer pays ZE.
6. ZE pays the supplier. The difference between the sell price and buy price is ZE's **margin**.
7. ZE marks the order **Completed**.

The app replaces paper/Excel for this flow: it stores which products each customer buys, who makes them and at which prices, and generates the three documents for every order.

**What it is not:** not an ERP. No inventory/stock, no accounting ledger, no payment tracking, no VAT, no manufacturing, no HR. Customers and suppliers never log in.

---

## 2. Glossary

Definitions are in [GLOSSARY.md](GLOSSARY.md). Use those exact terms in code, UI and docs. Never use "client" — it is ambiguous. ZE staff may say "bill"; the app always says **Invoice**.

Code names:

| Term | Code name |
|---|---|
| User | `profiles` |
| Customer | `customers` |
| Supplier | `suppliers` |
| Product | `products` |
| Order | `orders` |
| Order Item | `order_items` |
| Work Order (WO) | `work_orders` |
| Challan | fields on `orders` (`challan_*`) |
| Invoice | fields on `orders` (`invoice_*`) |
| Sell price / Buy price | `sell_price` / `buy_price` |
| Margin | `margin` (computed, never stored) |
| Activity Log | `activity_log` |

---

## 3. Users and roles

No public sign-up. Admins create users. Three roles:

| Permission | Admin | Manager | Staff |
|---|:-:|:-:|:-:|
| Manage users (create, deactivate, change role, reset password) | ✅ | ❌ | ❌ |
| Edit company settings (letterhead, logo, signature) | ✅ | ❌ | ❌ |
| View the Activity Log and History tabs | ✅ | ❌ | ❌ |
| Create / edit customers, suppliers, products (incl. prices) | ✅ | ✅ | ❌ (view only) |
| Add a product inline from the order form | ✅ | ✅ | ❌ |
| Create and edit orders (before lock) | ✅ | ✅ | ✅ |
| Override sell/buy price on an order line, refresh prices from products | ✅ | ✅ | ❌ |
| Download / share WO, Challan, Invoice; set document date | ✅ | ✅ | ✅ |
| Change order status manually — forward | ✅ | ✅ | ✅ (not to Completed/Cancelled) |
| Change order status manually — backward | ✅ | ✅ | ❌ |
| Mark order Completed or Cancelled | ✅ | ✅ | ❌ |
| See margin on orders, dashboard and reports | ✅ | ✅ | ❌ |
| Unlock an invoiced or completed order | ✅ | ❌ | ❌ |
| Delete customers, suppliers, products (only if never used in an order) | ✅ | ❌ | ❌ |

Orders are **never deleted** by anyone — only cancelled.

Staff can see buy prices (they appear on the Work Order). What Staff cannot see is margin and profit.

Deactivated users cannot log in. Their name stays on history records.

---

## 4. Master data

### 4.1 Customers

Fields: code (auto, e.g. `C-0001`), name*, contact person, phone*, WhatsApp number, email, address*, notes, active flag.

Customer detail page has a **Products** tab listing that customer's Products (name, supplier, sell price, and for Admin/Manager buy price and margin). Admin/Manager can add Products here.

### 4.2 Suppliers

Fields: code (auto, e.g. `S-0001`), name*, contact person, phone*, WhatsApp number*, email, address*, notes, active flag.

Supplier detail page has a read-only **Products** tab listing the Products this supplier makes (product, customer, buy price).

### 4.3 Products

A Product belongs to **one Customer** and is made by **one Supplier**. The same physical item sold to two customers is two Products.

Fields: code (auto, e.g. `P-0001`, one global sequence), customer*, supplier*, name* (the name the customer uses; printed on all documents), size, thickness (micron/gauge), colour, print details, description, sell price*, buy price*, active flag.

- All quantities and prices are **per piece**. There is no unit field.
- Product detail page shows the customer, supplier, both prices, and for Admin/Manager the margin per piece and margin %.
- **Duplicate for another customer** (Admin/Manager): creates a new Product with the same specs and supplier; the user picks the new customer and sets the sell price (buy price is pre-filled, editable).
- Changing a Product's supplier is allowed (Admin/Manager). It applies only to order lines added afterwards.

### 4.4 Rules

- Prices: BDT, 2 decimal places, must be > 0.
- A customer, supplier or product that appears in any order **cannot be deleted**, only deactivated. Deactivated records are hidden from pickers but still show on old orders.
- Deactivating a customer or supplier does not deactivate its products automatically, but such products are not offered on the order form (the product's customer and supplier must both be active).
- Changing a Product's price or supplier **never changes existing orders** (values are copied onto the order — see §5.3).

---

## 5. Orders

### 5.1 Order fields

- Order number (auto, see §7)
- Customer* — name, phone and address are **copied onto the order** at creation so old documents never change if the customer's details change
- Order date* (default today)
- Delivery date (expected, optional)
- Customer reference (optional — the customer's own PO/order number if they gave one)
- Delivery address (defaults to customer address, editable)
- Notes (internal, never printed)
- Invoice note (optional, printed on the Invoice)
- Status (see §6)
- Items (see §5.2)

### 5.2 Order form flow

1. **Select Customer.** Only active customers.
2. **Add item → select Product.** The dropdown lists only that customer's active Products whose supplier is also active. Sell price, buy price and supplier fill in from the Product.
   - Admin/Manager see **+ New product for this customer**, which opens the product form inline (customer pre-set) and adds the new Product to the line.
   - Staff see the hint "Product missing? Ask a manager to add it."
3. **Enter Quantity** — whole pieces, > 0.
4. Line shows: product, supplier, quantity, sell total, and for Admin/Manager also buy total and margin.
5. Repeat for more items. The same Product cannot appear twice in one order.
6. Footer shows order sell total, and for Admin/Manager also buy total and margin (amount and %).
7. **Save.** The order gets status `created`, and one Work Order is created for each distinct supplier in the items.

Changing the customer after items are added clears the items (after a confirmation).

Screen design: three-step flow (Customer → Items → Review), see [docs/DESIGN.md §7a](docs/DESIGN.md#7a-order-form-steps).

### 5.3 Snapshot

Each Order Item stores its own `sell_price`, `buy_price`, `supplier_id`, product name and spec text, copied from the Product when the line is added. All documents and reports use these values, never the current Product.

- Editing an existing line (e.g. quantity) keeps its snapshot.
- Admin/Manager may override sell/buy price per line (e.g. a one-off discount). Staff see prices read-only.
- Admin/Manager have **Refresh prices from products** on an editable order: re-copies sell and buy price from each line's Product. It never changes a line's supplier. To move a line to a Product's new supplier, remove the line and add it again.
- If a line's Product, customer or supplier has since been deactivated, the line keeps working and shows a **Deactivated** tag. It cannot be re-picked for new lines.

### 5.4 Multiple suppliers per order

An order can contain Products from several suppliers. The system creates **one Work Order per supplier** in the order. Example:

```
Order ORD-2026-0012 (Highway Sweets)
 ├─ Bread poly packet × 5,000   (Suzinas)        ┐ WO-2026-0012-A (to Suzinas)
 ├─ Sweet box 1 kg   × 1,000    (Suzinas)        ┘
 └─ Carry bag large  × 2,000    (Rahim Plastics) → WO-2026-0012-B (to Rahim Plastics)
```

There is still **one Challan and one Invoice per order**: all goods reach the customer together (no partial deliveries).

### 5.5 Editing and locking

| Order state | Who can edit | Effect |
|---|---|---|
| `created`, no WO sent | Everyone (Staff without price override) | Free edit. WOs are added/removed automatically as suppliers change. |
| At least one WO sent, or Challan downloaded, not yet invoiced | Everyone | Warning before save listing what no longer matches. Every affected WO that was already sent, and the Challan if already downloaded, gets **Needs re-send**. A *pending* WO whose supplier no longer has items is deleted; a *sent* one becomes `cancelled` (see §6.2). |
| `invoiced` or `completed` | Nobody | Order is **locked**. Admin can **Unlock** (reason required, logged). Once unlocked it behaves like the row above; downloading the Invoice again re-locks it. |
| `cancelled` | Nobody | Read only. Admin/Manager can restore it to its previous status. |

- Header fields (dates, reference, notes, delivery address) and document dates follow the same lock rules.
- Documents carry no "revised" marking. After an unlock, staff must check the re-generated Invoice before sending it.
- **Concurrent edits:** the edit form carries the order's `updated_at`. If someone else saved in the meantime, the save fails with "This order was changed by <user> at <time>. Reload to see their changes." Nothing is overwritten.

---

## 6. Status

### 6.1 Order status

```
created ──▶ wo_sent ──▶ delivered ──▶ invoiced ──▶ completed
   │           │            │           │
   └───────────┴────────────┴───────────┴──▶ cancelled
```

| Status | Label | Meaning | Set by |
|---|---|---|---|
| `created` | Created | Order saved | On save |
| `wo_sent` | WO Sent | All Work Orders sent to suppliers | Auto, when the last pending WO is downloaded/shared |
| `delivered` | Delivered | Goods taken to customer with Challan | Auto, on Challan download/share |
| `invoiced` | Invoiced | Invoice sent to customer | Auto, on Invoice download/share |
| `completed` | Completed | Customer has paid and supplier is paid | **Manual only** (Admin/Manager) |
| `cancelled` | Cancelled | Order called off | Manual only (Admin/Manager), reason required |

- While some but not all WOs are sent, the order stays `created` and the list shows a progress badge like **WO 1/2**. Cancelled WOs are not counted.
- If an edit adds a new supplier after the order is `wo_sent` (or later), the status does **not** move back. The badge shows **WO 2/3** and the dashboard lists the pending WO.

### 6.2 Work Order status

Each WO has its own status: `pending` → `sent`, or `cancelled`.

- Downloading or sharing the WO PDF marks it `sent`.
- A sent WO can carry **Needs re-send** (§5.5); downloading/sharing it again clears the flag.
- A sent WO is **never deleted**. When its supplier has no items left, or the order is cancelled, it becomes `cancelled` and the documents panel shows "Tell <supplier> that WO-… is cancelled." A pending WO in the same situation is simply deleted.
- Restoring a cancelled order puts its cancelled WOs back to `sent`.

### 6.3 Auto-update rules

- A download/share only ever moves status **forward**. Downloading an older document again (e.g. the WO when the order is already `invoiced`) never moves the status back.
- Every document has a **Preview** (opens the PDF, no status change, not logged) and a **Download** / **Share** (status change + logged).
- **Share counts only when it completes.** If the user closes the share sheet without sharing, nothing changes.
- Downloading the Challan while some WOs are still pending shows a warning ("2 Work Orders not sent yet. Continue?"). If confirmed, status moves to `delivered`; the pending WOs stay pending.
- Downloading the Invoice before the Challan shows a similar warning.
- Downloading the Invoice locks the order (§5.5).

### 6.4 Manual changes

- Order detail page has a **Change status** control.
- Staff: forward steps only, excluding `completed` and `cancelled`.
- Admin/Manager: any status, forward or back. Moving to `cancelled` requires a reason.
- Every change — auto or manual — is recorded in the Activity Log (§11) with from, to, source (`auto`/`manual`), triggering document (if any), note, user and time. The order detail page shows this order's status and document history to all roles.

---

## 7. Numbering

All order documents share the **order's sequence number**, so one number ties everything together:

| Document | Format | Example |
|---|---|---|
| Order | `ORD-YYYY-NNNN` | ORD-2026-0012 |
| Work Order | `WO-YYYY-NNNN-X` (X = A, B, C… per supplier) | WO-2026-0012-A |
| Challan | `CH-YYYY-NNNN` | CH-2026-0012 |
| Invoice | `INV-YYYY-NNNN` | INV-2026-0012 |

- `YYYY` is the year the order was created; `NNNN` restarts at 0001 each year.
- The number is assigned when the order is saved, using an atomic database counter (no duplicates under concurrent saves).
- Orders are never deleted; cancelled orders keep their number; numbers are never reused.
- WO letters are assigned in the order suppliers were added and are never reused within an order (if WO-…-B is deleted or cancelled, the next new supplier gets C).
- Master data codes (`C-0001`, `S-0001`, `P-0001`) are global sequences, not per year.

---

## 8. Documents (PDF)

All PDFs: A4 portrait, English, ZE letterhead at top (logo, name, address, phone, email — from Settings), document title, number and **document date**, page numbers ("Page 1 of 2") on multi-page documents. Currency printed as `Tk` with Bangladeshi lakh/crore digit grouping (e.g. `Tk 1,25,000.00`, `Tk 1,00,00,000.00`); amounts in words also use lakh/crore. The same grouping is used everywhere in the app UI, including quantities (`5,000 pcs`, `1,20,000 pcs`). Generated on the server with `@react-pdf/renderer`.

File names: `WO-2026-0012-A_Suzinas.pdf`, `CH-2026-0012_Highway-Sweets.pdf`, `INV-2026-0012_Highway-Sweets.pdf`.

### 8.0 Document date

Each WO, the Challan and the Invoice has its own stored date.

- The Download / Share dialog has a date field. On the first download it defaults to **today** (Asia/Dhaka); the user may change it to any date.
- Re-downloads default to the **stored** date, not today. Changing it updates the stored date.
- Warning (not a block) if the date is before the order date or in the future.
- When the order is locked, document dates are locked too.
- Preview uses the stored date, or today if the document was never downloaded.
- Every date change is logged.

### 8.1 Work Order (to supplier)

- Title "WORK ORDER", WO number, WO date, order delivery date (as "Required by")
- **To:** supplier name, address, phone
- **Deliver to:** ZE address (goods come to ZE)
- Table: #, product name, specification (size / thickness / colour / print), quantity (pcs), **buy price** per piece, line total
- Total quantity, total amount, total in words
- Notes / instructions (optional, editable per WO)
- Signature block: "Authorised signature — Zahir Enterprise" with signature image from Settings
- **Never shows:** customer name, sell price, margin

### 8.2 Challan (to customer)

- Title "DELIVERY CHALLAN", challan number, challan date, order number, customer reference
- **To:** customer name, delivery address, phone
- Table: #, product name, specification, quantity (pcs)
- Total quantity (e.g. "Total: 8,000 pcs")
- Two signature blocks: "Received by (customer)" with blank name/date lines, and "Delivered by — Zahir Enterprise"
- **Never shows:** any price, supplier name

### 8.3 Invoice (to customer)

- Title "INVOICE", invoice number, invoice date, order number, challan number, customer reference
- **Invoice to:** customer name, address, phone
- Table: #, product name, specification, quantity (pcs), **sell price** per piece, line total
- Grand total = sum of line totals. **No discount, delivery charge, VAT or any other adjustment line.** A one-off price change is done by overriding the line's sell price (§5.3).
- Amount in words (e.g. "Taka One Lakh Twenty-Five Thousand Only"; paisa when present: "… and Fifty Paisa Only")
- Invoice note (from order, optional) and payment instructions (from Settings, optional)
- Signature block with signature image
- **Never shows:** buy price, supplier name, margin

### 8.4 Sharing via WhatsApp

- On phones (Web Share API with files supported): the **Share** button fetches the PDF, opens the system share sheet with it attached; user picks WhatsApp. Only when the share completes is it recorded as sent (§12.2). Cancelling the sheet changes nothing.
- On desktop / unsupported browsers: **Download** saves the PDF and is recorded immediately; the user attaches it in WhatsApp manually. An optional "Open WhatsApp chat" button opens `wa.me/<number>` for the supplier/customer with a pre-filled text message (text only — a file cannot be attached this way).

---

## 9. Screens

| Route | Screen | Roles |
|---|---|---|
| `/login` | Email + password login, forgot password | Public |
| `/` | **Dashboard** | All (margin cards Admin/Manager only) |
| `/orders` | Order list: search (number, customer, reference), filters (status, customer, supplier, date range), status badges, WO x/y badge, Needs re-send badge | All |
| `/orders/new` | Order form (§5.2) | All |
| `/orders/[id]` | Order detail: header, items, totals, documents panel (each WO + Challan + Invoice with Preview / Download / Share, date, sent / needs re-send / cancelled state), change status, order history | All |
| `/orders/[id]/edit` | Edit order (subject to lock) | All |
| `/customers`, `/customers/[id]` | List + detail with Products tab | All (edit Admin/Manager) |
| `/suppliers`, `/suppliers/[id]` | List + detail with Products tab | All (edit Admin/Manager) |
| `/products`, `/products/[id]` | List (filter by customer, supplier) + detail | All (edit Admin/Manager) |
| `/reports` | Reports (§10) | Admin/Manager |
| `/activity` | Activity Log (§11) | Admin |
| `/settings/company` | Letterhead, logo, signature, payment instructions | Admin |
| `/settings/users` | User management | Admin |
| `/account` | Own name and password | All |

Every record detail page (order, customer, supplier, product, user) has a **History** tab for Admin, showing that record's Activity Log entries.

UI requirements (look and feel: [docs/DESIGN.md](docs/DESIGN.md)):

- Mobile-first and fully usable on a phone (sharing to WhatsApp happens on phones).
- Installable to the phone home screen (PWA manifest, standalone display). No offline mode.
- Tables become stacked cards on small screens.
- Every list paginated (25 per page) with search.
- Confirm dialogs for destructive or status-changing actions.
- Toast messages for success and error.
- Dates shown as `16 Oct 2026`; times as `16 Oct 2026, 3:45 PM`; timezone Asia/Dhaka.

---

## 10. Dashboard and reports

### Dashboard

- Count of orders by status (clickable → filtered order list)
- Orders needing action: WOs pending, WOs or Challans needing re-send, cancelled WOs not yet acknowledged, delivered but not invoiced, invoiced but not completed
- This month: number of orders, sell total; Admin/Manager also buy total and margin
- Admin/Manager: chart of the last 6 months — sell total, buy total and margin per month
- Last 10 orders

### Reports (Admin/Manager)

All with a date range filter (by order date), excluding cancelled orders, exportable to CSV.

- **Margin by order** — order, customer, sell total, buy total, margin, margin %
- **By month** — orders, sell, buy, margin per month
- **By customer** — orders, sell total, margin per customer
- **By supplier** — WOs, quantity, buy total per supplier
- **By product** — customer, quantity, sell, buy, margin per product
- **Open orders** — everything not `completed` or `cancelled`, with age in days

Margin % = margin ÷ sell total.

---

## 11. Activity Log

A permanent, append-only record of every change any User makes. Admin only (except the order history panel, §6.4).

### 11.1 What is recorded

| Kind | Examples | Captured by |
|---|---|---|
| Data changes | Create, update, delete of customers, suppliers, products, orders, order items, work orders, company settings, users. Updates store **field-by-field before → after** (price overrides, quantity changes, address edits, deactivations, role changes…). | Database triggers (§12.5) |
| Status changes | Order and WO status, from → to, source (auto/manual), triggering document, note/reason | App event |
| Documents | Download, share (completed), document date change | App event |
| Locking | Lock (on Invoice download), Unlock with reason, cancel with reason, restore | App event |
| Auth | Login, failed login (with the email tried), logout, password change, password reset | App event |

Previews are not recorded. `updated_at` / `updated_by` changes alone are not shown as diffs.

### 11.2 Activity screen (`/activity`)

- Entries grouped by **day** (Asia/Dhaka), newest first, with a day header ("Mon, 19 Oct 2026 — 42 changes").
- Each entry: time, user, action, record (e.g. "Order ORD-2026-0012", "Product P-0031 Bread poly packet 10×14"), one-line summary. Expand to see the full field diff or event details.
- Changes made in one save are grouped as one entry (e.g. "Edited order ORD-2026-0012: 3 items changed, WO-B needs re-send").
- Filters: date range, user, record type, action type, search by record number/code/name. Filters are kept in the URL so a filtered view can be bookmarked.
- Paginated; CSV export of the filtered result.

### 11.3 Guarantees

- Append-only: nobody — Admin included — can edit or delete entries. Enforced in the database, not only in the app.
- Kept forever.
- A write that cannot be logged fails (the log entry is part of the same transaction as the change).
- User names are copied onto entries, so deactivated or renamed users still show correctly.

---

## 12. Settings

Single company record (Admin only):

- Company name, address, phone, email
- Logo (PNG/JPG/SVG, stored in Supabase Storage). Defaults to `brand/ze-logo-navy.svg` until replaced
- Authorised signature image (PNG with transparent background)
- Payment instructions (free text, printed on Invoice, e.g. bank/bKash details)
- Default WO note (pre-filled on new WOs)

---

## 13. Tech stack and architecture

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript, React Server Components + Server Actions |
| Database | Supabase Postgres |
| ORM / migrations | Drizzle ORM + drizzle-kit (triggers and functions in SQL migrations) |
| Auth | Supabase Auth (email + password), via `@supabase/ssr` |
| File storage | Supabase Storage (private bucket `company-assets` for logo and signature) |
| PDF | `@react-pdf/renderer`, rendered in Route Handlers |
| UI | Tailwind CSS + shadcn/ui |
| Forms / validation | react-hook-form + Zod (same Zod schemas validate on the server) |
| Hosting | Vercel (app) + Supabase (DB, auth, storage); Supabase daily backups |
| Package manager / runtime | pnpm; Node LTS pinned in `.nvmrc`; latest stable Next.js, React, Tailwind at scaffold time |
| Charts | shadcn/ui charts (Recharts) |
| Dates | date-fns + `@date-fns/tz` (Asia/Dhaka) |
| Font | Geist via `next/font` |
| PWA | Next.js built-in `manifest` metadata, no extra library |
| Unit / integration tests | Vitest |
| End-to-end tests | Playwright (desktop + phone viewports) |
| Lint / format | ESLint + Prettier |

### 13.0 Environments and testing

- **Two hosted Supabase projects:** `ze-dev` (development, tests, previews) and `ze-prod` (live). No local Supabase/Docker.
- Drizzle migrations run against `ze-dev` first, then `ze-prod` on release. Vercel preview deployments use `ze-dev`; production uses `ze-prod`.
- **Unit tests** (Vitest) cover pure logic with no database: status rules, numbering format, money and amount-in-words, permission checks, activity diff formatting.
- **Database tests** (Vitest) run against `ze-dev` for triggers, the immutable Activity Log, numbering under concurrency and lock rules. Each test runs in a transaction that is rolled back, or uses rows tagged with a unique test run id that are cleaned up afterwards. They never run against `ze-prod` (guard: refuse to run unless `DATABASE_URL` matches the dev project ref).
- **End-to-end tests** (Playwright) run against a local `next dev` connected to `ze-dev`, with seeded test users per role, at desktop and phone viewports. Core flow: create order with two suppliers → download WOs → Challan → Invoice → Completed, plus Staff margin-hiding.


### 13.1 Data access and security

- All data reads/writes go through **server code only** (Server Components, Server Actions, Route Handlers) using Drizzle over the Supabase connection string. The browser never queries tables directly; the Supabase browser client is used only for the auth session.
- **Authorisation is enforced on the server** in every action/handler: load the current user's profile, check `is_active` and role against §3. One helper (e.g. `requireRole('admin','manager')`) used everywhere.
- **Row Level Security is enabled on every table with no policies for `anon`/`authenticated`**, so even a leaked anon key cannot read data through the Supabase REST API. (Drizzle connects with a server-side role that bypasses RLS.)
- Margin and buy totals are removed from responses for Staff on the server, not just hidden in the UI.
- User creation/role changes use the Supabase Admin API with the service-role key, server-side only. The service-role key and database URL never reach the browser.
- Login, logout and password reset go through Server Actions (not the browser client) so they can be logged, including failed logins.
- Public sign-up is disabled in Supabase Auth settings.

### 13.2 Document endpoints

Path: `/api/orders/[id]/documents/[type]` where type is `wo/[woId]`, `challan` or `invoice`.

- `GET ?date=YYYY-MM-DD` — renders the PDF only. No side effects, not logged. Used by Preview and by Share (to get the file before opening the share sheet). `date` defaults to the stored date or today.
- `POST` with body `{ date, via: 'download' | 'share' }` — in one transaction: check auth and lock rules, store the document date, update WO/order status per §6.3, clear Needs re-send, write the activity events, lock the order if Invoice. For `download` the response is the PDF; for `share` it returns `204` (the client already has the file).
- Share flow on the client: `GET` → `navigator.share({ files })` → on success `POST { via: 'share' }`; on `AbortError` do nothing.
- POST is used for anything with side effects so link prefetching can never change status.

### 13.3 Writes and the Activity Log

Every write runs inside `withUser(user, async tx => …)`, which opens a transaction and sets `app.user_id` and `app.user_name` (via `set_config(…, true)`, transaction-local, safe with the Supabase transaction pooler). Database triggers read these to attribute changes. See [ADR 0001](docs/adr/0001-activity-log-via-db-triggers.md).

### 13.4 Suggested folder structure

```
src/
  app/
    (auth)/login/
    (app)/            # authenticated layout: sidebar, header
      page.tsx        # dashboard
      orders/ customers/ suppliers/ products/ reports/ activity/ settings/ account/
    api/orders/[id]/documents/
  db/
    schema.ts         # Drizzle schema
    migrations/       # incl. SQL for activity triggers
    with-user.ts      # transaction wrapper that sets app.user_id
  lib/
    auth.ts           # getCurrentUser, requireRole
    status.ts         # status transition rules (pure functions, unit-tested)
    numbering.ts
    money.ts          # formatting, amount in words (lakh/crore)
    activity.ts       # app event logging + diff formatting
  pdf/
    WorkOrderPdf.tsx ChallanPdf.tsx InvoicePdf.tsx components/
  components/         # shadcn/ui + app components
  actions/            # server actions per domain
```

### 13.5 Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only
DATABASE_URL=                   # Supabase pooled connection string, server only
```

---

## 14. Database schema

All tables (except `activity_log`): `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz`. Money is `numeric(12,2)`; quantity is `integer`. `created_by` / `updated_by` reference `profiles.id` where shown.

### Enums

```
user_role:       admin | manager | staff
order_status:    created | wo_sent | delivered | invoiced | completed | cancelled
wo_status:       pending | sent | cancelled
status_source:   auto | manual
document_type:   work_order | challan | invoice
activity_kind:   data | event
```

### Tables

**profiles** — one row per auth user
| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| full_name | text not null | |
| email | text not null | copy for display |
| role | user_role not null | |
| is_active | boolean default true | |

**company_settings** — single row
| column | type |
|---|---|
| name, address, phone, email | text |
| logo_path, signature_path | text (Storage paths) |
| payment_instructions | text |
| default_wo_note | text |

**customers**
| column | type | notes |
|---|---|---|
| code | text unique | `C-0001` |
| name | text not null | |
| contact_person, email, whatsapp, notes | text | |
| phone | text not null | |
| address | text not null | |
| is_active | boolean default true | |
| created_by, updated_by | uuid → profiles | |

**suppliers** — same shape as customers (`S-0001`), `whatsapp` not null.

**products**
| column | type | notes |
|---|---|---|
| code | text unique | `P-0001` |
| customer_id | uuid → customers not null | |
| supplier_id | uuid → suppliers not null | |
| name | text not null | customer's name for the item |
| size, thickness, colour, print_details, description | text | |
| sell_price | numeric(12,2) not null, > 0 | per piece |
| buy_price | numeric(12,2) not null, > 0 | per piece |
| is_active | boolean default true | |
| created_by, updated_by | uuid → profiles | |

**code_sequences** — master data codes
| column | type | notes |
|---|---|---|
| prefix | text PK | `C`, `S`, `P` |
| last_value | int not null | incremented atomically |

**number_sequences** — order numbers
| column | type | notes |
|---|---|---|
| year | int PK | |
| last_value | int not null | incremented atomically: `update … set last_value = last_value + 1 returning last_value` |

**orders**
| column | type | notes |
|---|---|---|
| year, seq | int | unique (year, seq) |
| order_no | text unique | `ORD-2026-0012` |
| challan_no, invoice_no | text unique | `CH-…`, `INV-…`, set at creation |
| customer_id | uuid → customers | |
| customer_name, customer_phone, customer_address | text | snapshot |
| delivery_address | text | |
| order_date | date not null | |
| delivery_date | date | |
| customer_ref | text | |
| notes | text | internal |
| invoice_note | text | printed on Invoice |
| status | order_status not null default `created` | |
| status_before_cancel | order_status | for restore |
| cancel_reason | text | |
| is_locked | boolean default false | |
| challan_date, invoice_date | date | document dates (§8.0) |
| challan_downloaded_at, invoice_downloaded_at | timestamptz | first download/share |
| challan_needs_resend | boolean default false | |
| completed_at, cancelled_at | timestamptz | |
| created_by, updated_by | uuid → profiles | |

`updated_at` is the optimistic-lock token (§5.5).

**work_orders**
| column | type | notes |
|---|---|---|
| order_id | uuid → orders | |
| supplier_id | uuid → suppliers | |
| letter | char(1) | A, B, C… |
| wo_no | text unique | `WO-2026-0012-A` |
| supplier_name, supplier_phone, supplier_address | text | snapshot |
| status | wo_status default `pending` | |
| needs_resend | boolean default false | |
| wo_date | date | document date (§8.0) |
| note | text | printed on WO |
| sent_at, cancelled_at | timestamptz | |
| | unique (order_id, letter); partial unique (order_id, supplier_id) where status ≠ `cancelled` | |

**order_items**
| column | type | notes |
|---|---|---|
| order_id | uuid → orders | |
| work_order_id | uuid → work_orders | |
| product_id | uuid → products | |
| supplier_id | uuid → suppliers | snapshot from product |
| product_name, spec_text | text | snapshot |
| quantity | integer not null, > 0 | pieces |
| sell_price, buy_price | numeric(12,2) not null | snapshot, overridable |
| sell_total, buy_total | numeric(14,2) generated | quantity × price |
| sort_order | int | |
| | unique (order_id, product_id) | |

**activity_log** — append-only (§11)
| column | type | notes |
|---|---|---|
| id | bigint generated always as identity PK | |
| occurred_at | timestamptz not null default now() | |
| tx_id | bigint not null default txid_current() | groups rows from one save |
| kind | activity_kind not null | `data` (trigger) or `event` (app) |
| action | text not null | data: `insert`/`update`/`delete`; event: `status_change`, `document_download`, `document_share`, `document_date_change`, `lock`, `unlock`, `cancel`, `restore`, `login`, `login_failed`, `logout`, `password_change`, `password_reset` |
| user_id | uuid → profiles, nullable | null for failed login / system |
| user_name | text | snapshot |
| entity_type | text | table name, e.g. `orders` |
| entity_id | uuid | |
| entity_label | text | e.g. `ORD-2026-0012`, `P-0031 Bread poly packet` |
| order_id | uuid, nullable | set for orders, order_items, work_orders and order events — drives the order history panel |
| changes | jsonb | data rows: `{ field: { from, to } }` (full row on insert/delete) |
| details | jsonb | event rows: e.g. `{ from, to, source, document, work_order_id, reason, date, email }` |

Indexes: `orders(status)`, `orders(customer_id)`, `orders(order_date)`, `order_items(order_id)`, `order_items(supplier_id)`, `work_orders(order_id)`, `products(customer_id)`, `products(supplier_id)`, `activity_log(occurred_at desc)`, `activity_log(user_id, occurred_at desc)`, `activity_log(entity_type, entity_id)`, `activity_log(order_id)`, `activity_log(tx_id)`.

No `on delete cascade` from orders (orders are never deleted).

### Triggers

- `log_row_change()` — `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` on every table except `activity_log`, `code_sequences`, `number_sequences`. Writes a `data` row with the field diff (ignoring `updated_at`/`updated_by`), the entity label and `order_id`. Raises an error if `app.user_id` is not set, unless `app.actor = 'system'` (migrations, seed).
- `activity_log_immutable()` — `BEFORE UPDATE OR DELETE` on `activity_log` raises an error. `UPDATE`, `DELETE`, `TRUNCATE` also revoked from the app role.

---

## 15. Build phases

Each phase ends with something usable and reviewed with ZE.

**Phase 1 — Foundation**
Project setup (Next.js, Tailwind, shadcn/ui, Drizzle, Supabase), auth (login, logout, forgot password) via Server Actions, profiles + roles + `requireRole`, `withUser` transaction wrapper, activity triggers and immutability, app layout, company settings with logo/signature upload, user management.
*Done when:* Admin can log in, create a Manager and a Staff user, each sees only what §3 allows, and those actions appear in the database activity log.

**Phase 2 — Master data**
Customers, suppliers, products CRUD with prices, Duplicate for another customer, deactivate rules.
*Done when:* ZE can enter Highway Sweets, Suzinas and a bread poly packet product for Highway Sweets made by Suzinas, with sell and buy prices.

**Phase 3 — Orders**
Numbering, order form with inline product add, snapshot and override, refresh prices, automatic WO split per supplier, order list with filters, order detail, edit/lock rules, optimistic locking.
*Done when:* an order with products from two suppliers creates two WOs, correct totals and margin, and Staff cannot see margin.

**Phase 4 — Documents and status**
WO, Challan and Invoice PDFs; document dates; preview vs download vs share; status auto-update, warnings, manual change, order history panel; Needs re-send; cancelled WOs.
*Done when:* the full flow Created → WO Sent → Delivered → Invoiced → Completed runs on a phone, including sharing a WO to WhatsApp.

**Phase 5 — Dashboard, reports, Activity Log screen**
Dashboard cards and action lists; all reports in §10 with CSV export; `/activity` with day grouping, filters, diffs, CSV; History tabs.

**Phase 6 — Polish and launch**
Mobile pass, empty states, loading/error states, unit tests for status rules / numbering / amount-in-words / activity diff, production Supabase project, backups check, handover. ZE has no existing data to import; all master data is entered fresh through the app.

---

## 16. Out of scope (v1)

Customer/supplier logins or portals · invoice-level discounts, delivery charges or other adjustment lines · units other than pieces · data import from Excel/CSV · payment tracking, ledgers, dues · VAT / Mushak · inventory/stock · partial deliveries · "Revised" marking on documents · Bangla language · SMS/WhatsApp API sending · multiple companies/branches · purchase of goods ZE keeps in stock.

Any of these can be added later; the schema does not block them.

---

## 17. Decisions log

Decisions confirmed with ZE, so they are not re-opened during the build.

| # | Decision |
|---|---|
| 1 | Customers and suppliers never log in. Only ZE users (Admin, Manager, Staff). |
| 2 | An order can have products from multiple suppliers → one Work Order per supplier; one Challan and one Invoice per order. |
| 3 | No payment tracking. "Completed" is set manually once money has been received and paid. |
| 4 | No VAT / Mushak. |
| 5 | English only. |
| 6 | No discount, delivery charge or other adjustment lines on the Invoice. Total = sum of lines. |
| 7 | Amounts use Bangladeshi lakh/crore grouping (`1,25,000.00`) and lakh/crore in words. |
| 8 | No existing data to import. |
| 9 | The customer-facing payment document is called **Invoice** (printed title "INVOICE", number `INV-YYYY-NNNN`), in UI and code. |
| 10 | Stack: Next.js + Supabase (Postgres, Auth, Storage) + Drizzle + `@react-pdf/renderer` + shadcn/ui, hosted on Vercel. |
| 11 | Everything is bought and sold per piece. No units. |
| 12 | A Product belongs to one Customer and has one Supplier, with its own sell and buy price. Same item for two customers = two Products. |
| 13 | Document date defaults to the download date and can be changed to any date. |
| 14 | No "Revised" marking on documents; staff check before re-sending. |
| 15 | Sent WOs are cancelled, never deleted. Orders are never deleted. |
| 16 | Admin-only, append-only Activity Log of every change, captured by database triggers (ADR 0001). |
| 17 | Hosted Supabase for development (`ze-dev`) and production (`ze-prod`); no local Docker. Tests: Vitest (unit + DB against `ze-dev`) and Playwright (E2E). |

No open questions at this time.
