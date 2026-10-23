# Design — "Navy Ledger"

Look and feel of the ZE Order & Billing System. Agreed with ZE on 2026-10-20.

**Idea:** a private bank's back office. Calm, exact, confident. The premium feel comes from restraint: one brand colour, crisp type, perfectly aligned numbers, generous white space, and the logo's diagonal cut as the only graphic motif.

**Never:** gradients, glassmorphism, heavy shadows, bouncy motion, cartoon illustrations, more than one accent per screen.

---

## 1. Colour tokens

Define these once as CSS variables (shadcn/ui theme) and use only the token names in components.

### Brand

| Token | Hex | Use |
|---|---|---|
| `navy` | `#081F3F` | Logo colour. Sidebar, primary buttons, headings, PDF ink |
| `navy-hover` | `#0D2A54` | Primary button hover, sidebar item hover |
| `navy-active` | `#12305C` | Sidebar active item background |
| `brass` | `#B08D57` | Accent, **sparingly**: active nav marker, margin figure, login diagonals, dashboard margin line |
| `brass-soft` | `#F3ECE1` | Rare tint behind a brass element |

Brass appears at most once or twice per screen, and never on PDFs.

### Neutrals

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#F7F7F5` | Page background (warm off-white) |
| `surface` | `#FFFFFF` | Cards, tables, top bar, dialogs |
| `border` | `#E5E5E0` | 1px hairlines, table rows |
| `border-strong` | `#D4D4CE` | Inputs, table header bottom rule |
| `ink` | `#0E1A2B` | Body text |
| `ink-muted` | `#5B6472` | Secondary text, labels |
| `ink-subtle` | `#8A929E` | Placeholders, disabled |
| `sidebar-text` | `#C9D2E0` | Inactive nav text on navy |

### Feedback

| Token | Hex |
|---|---|
| `danger` | `#B91C1C` |
| `success` | `#15803D` |
| `warning` | `#B45309` |

Focus ring: 2px `navy` with 2px offset on every focusable element.

### Status pills

Soft tinted pill: pale background, dark text, 6px dot in the text colour.

| Status | Background | Text / dot |
|---|---|---|
| Created | `#F1F5F9` | `#475569` |
| WO Sent | `#EFF6FF` | `#1D4ED8` |
| Delivered | `#F0FDFA` | `#0F766E` |
| Invoiced | `#FFFBEB` | `#B45309` |
| Completed | `#F0FDF4` | `#15803D` |
| Cancelled | `#FEF2F2` | `#B91C1C` (muted) |

- **WO x/y** progress badge: Created pill style with the count.
- **Needs re-send**: amber outline badge (1px `#B45309`, transparent background).
- **Cancelled WO**: row text struck through in `ink-subtle`.
- **Deactivated** tag: neutral outline badge.

---

## 2. Typography

- **Font:** Geist Sans for everything (`next/font`). Geist Mono is not used.
- **Numbers:** all money and quantities use `font-variant-numeric: tabular-nums` and are right-aligned in tables. Format: `Tk 1,25,000.00`, `5,000 pcs` (lakh/crore grouping).
- **Section labels:** UPPERCASE, 11px, weight 600, letter-spacing `0.12em`, `ink-muted`. This echoes the "ZAHIR ENTERPRISE" wordmark.

| Role | Size / line height | Weight |
|---|---|---|
| Page title | 24 / 32 | 600 |
| Section title | 18 / 28 | 600 |
| Body (desktop) | 14 / 20 | 400 |
| Body (phone), all inputs | 16 / 24 | 400 (16px prevents iOS zoom) |
| Small / meta | 12 / 16 | 400 |
| Big KPI number | 30 / 36 | 600, tabular |

---

## 3. Shape, space, depth

- 4px spacing grid. Page padding: 32px desktop, 16px phone.
- Radius: **6px** buttons, inputs and pills (pills fully rounded); **8px** cards and dialogs. Nothing rounder.
- Separation by 1px `border` hairlines. Shadow only on menus, popovers and dialogs: `0 8px 24px rgba(8,31,63,0.08)`.
- Table rows 44px desktop; header row `canvas` background with uppercase section-label text.
- Buttons: primary = `navy` fill, white text; secondary = white with `border-strong`; destructive = `danger` fill. Height 36px desktop, 44px phone.

---

## 4. Layout

### Desktop (≥ 1024px)

- Fixed **navy sidebar**, 248px: white ZE mark plus "ZAHIR ENTERPRISE" set in text, then nav items (Lucide icon + label) in `sidebar-text`. Active item: white text, `navy-active` background, 3px `brass` bar on the left edge.
- Sidebar collapses to 72px (icons only) on 1024–1279px or by toggle.
- White **top bar** per page: page title, global search, user menu (name, role, account, log out).
- Content on `canvas`; cards and tables on `surface`.

### Phone (< 768px)

- Top bar: navy, white ZE mark, page title, user menu.
- **Bottom tab bar** (64px + safe-area inset): Dashboard · Orders · **+ New Order** (centre, navy, raised circle) · Products · More. "More" holds customers, suppliers, reports, activity, settings, account (role-filtered).
- Tables become stacked cards: primary line (number + status pill), secondary line (customer), amount right-aligned.
- Primary actions on detail screens (Share / Download / Save) sit in a **sticky bottom action bar**, within thumb reach.

Tablet (768–1023px) uses the collapsed 72px sidebar.

---

## 5. Logo usage

Assets live in [`brand/`](../brand/). Use the SVGs in the app and PDFs; the PNGs are the original reference.

| File | What |
|---|---|
| `ze-mark-navy.svg` / `ze-mark-white.svg` | ZE monogram only |
| `ze-logo-navy.svg` / `ze-logo-white.svg` | Monogram + "ZAHIR ENTERPRISE" wordmark |
| `logo.png`, `logo-transparent.png`, `logo-transparent-white.png` | Originals (reference only) |

| Place | Asset |
|---|---|
| Sidebar, expanded | White mark + "ZAHIR ENTERPRISE" in text (uppercase section-label style, white) |
| Sidebar collapsed, phone top bar | White mark |
| Login navy panel / navy band | White full logo |
| PDF letterhead | Navy full logo, left |
| Favicon, PWA icon, Apple touch icon | White mark centred on a navy rounded square |
| Empty states, loading screen | Navy mark at 8% opacity as a watermark |

Clear space around the logo: at least the height of the E's middle bar. Never recolour other than navy or white, never stretch, never add effects.

---

## 6. Login screen

- **Desktop:** split screen. Left 45%: `navy` panel, white full logo centred, 3–4 thin `brass` diagonal lines at the logo's cut angle (~54° from horizontal, 20% opacity) in one corner, tagline "Order & Billing System" in section-label style. Right: white panel, form max 360px wide: email, password, "Forgot password?" link, full-width navy **Sign in** button. Errors shown inline under the form.
- **Phone:** navy band (≈30% height) with the white full logo, then the form on white below.

---

## 7. Dashboard ("Overview")

Layout chosen 2026-10-23 from three prototyped options (Overview, To-do, Pipeline). Reference build: branch `prototype/dashboard`, route `/prototypes/dashboard?v=1` (`&role=staff`). Content rules are in SPEC §10.

Numbers first, top to bottom:

1. **Orders by status** (section label): one joined strip of six tiles (1px gaps on a `border` background, outer radius 8px), 3 columns on phone, 6 from 1024px. Each tile: 6px dot in the status colour + label (12px, `ink-muted`), count (24px semibold navy, tabular). Whole tile links to the order list filtered by that status.
2. **<Month Year>** (section label, e.g. "OCTOBER 2026"): joined figure strip, 2 columns on phone, 4 from 1024px: Orders, Sell total, and for Admin/Manager Buy total and **Margin in brass** with "22.8% of sell" underneath. Values 24px, 30px from 768px, whole taka (no paisa). Staff see Orders and Sell total only (2 columns).
3. **Chart + Needs action** side by side from 1024px (chart 3/5, list 2/5); stacked on smaller screens, chart first. Staff: no chart, Needs action takes the full width.
   - **Last 6 months** card (Admin/Manager): legend row (Sell, Buy, Margin) with a "Show table" / "Show chart" text toggle on the right. Navy sell bars, buy bars `#CBD5E1` with a 0.75px `#94A3B8` edge, 2px gap between the pair, 3px top radius; 2px `brass` margin line with 8px dots ringed in white; the latest margin point direct-labelled. Hairline gridlines, y-axis in lakh ("7.5L"), month labels below. Hover or tap a month: other months dim to 45%, tooltip card with Sell / Buy / Margin in `Tk`. The table view lists the same numbers. Drawn at the card's real width so text stays 10–11px. The card does not stretch to the list's height.
   - **Needs action · N** card: groups in SPEC §10 order: cancelled WOs to tell supplier (`danger` dot), needs re-send (`warning` dot), WOs not sent, delivered but not invoiced, invoiced but not completed (neutral dots). Group row: dot, title, count chip. Up to 2 items per group, then "+N more". Item: number (medium) · counterparty, detail line below (`ink-subtle`), action link on the right ("Send →", "Re-send →", "Invoice →", "Open →") that opens the order. Groups with nothing in them are hidden; when all are empty, show "Nothing waiting" with a success check.
4. **Last 10 orders** card with "View all" link: table from 768px (Order, Customer, Date, Status pill + "WO x/y" when partly sent, Sell right-aligned); stacked cards on phones (number + pill, customer + amount).

The action links ("Send →", "Invoice →") only open the order; documents are always sent from the order's documents panel (§7b).

---

## 7a. Order form ("Steps")

Chosen 2026-10-23 from three prototyped options (Ledger, Steps, Order pad). Reference build: branch `prototype/order-form`, route `/prototypes/order-form?v=2` (`?role=staff` for the Staff view). Flow rules are in SPEC §5.2.

One decision per screen, three steps: **Customer → Items → Review**. Same flow on desktop, in a centred column (max 576px).

- **Progress row** at the top: numbered circles joined by hairlines; done steps are filled navy with a check, the current step is outlined navy, later steps are disabled until reachable (Items needs a Customer, Review needs at least one item). Tapping a reachable step jumps to it.
- **Customer step:** heading "Who is this order for?", search box (name, code, phone), list of active Customers (name, code · phone). Tapping one moves to Items. Changing to a different Customer once items exist asks for confirmation (dialog), then clears the items.
- **Customer chip** on Items and Review: section label "Customer", name, "Change" link back to step 1.
- **Items step:** empty state "No items yet" with **Add product**. Added items list as rows: product name, supplier, sell total, quantity in pcs, chevron. Tapping a row reopens the quantity sheet. **Add another product** button under the list.
- **Product picker:** bottom sheet (85% height) with search, listing only this Customer's active Products: name, spec · supplier, sell price per piece. Products already on the order show "Added" and are disabled. Sheet footer: **+ New product for this customer** (Admin/Manager, opens the product form sheet with the customer pre-set, then goes straight to quantity) or the hint "Product missing? Ask a manager to add it." (Staff).
- **Quantity sheet:** product name and spec · supplier; large right-aligned numeric input (whole pieces, lakh grouping as you type); quick-fill chips **500 · 1,000 · 2,000 · 5,000 · 10,000**; live sell line (price/pc → total) and, for Admin/Manager, buy line with margin in brass. Primary button **Add to order** (new line) or **Update** (existing line, with a remove icon button beside it).
- **Review step:** "Work Orders to send" list (letter badge A/B/C, supplier, item count · pcs), totals box (sell; buy and margin with % for Admin/Manager), then order details: order date, delivery date, customer reference, delivery address (prefilled from the Customer), invoice note ("Printed on the Invoice."), notes ("Internal. Never printed.").
- **Sticky footer** (from step 2, above the phone tab bar): back icon button, sell total and item count, then **Review →** on Items or **Save order** on Review.
- **Motion:** step content fades and slides in 8px from the right, 200ms ease-out. Sheets use the standard sheet motion. Opacity only under reduced motion.
- **After save:** go to the new order's detail page (the prototype's confirmation screen was a stand-in).
- **Editing an existing order** uses the same screens and opens on Items.

---

## 7b. Order documents panel ("Checklist")

Chosen 2026-10-23 from three prototyped options (Checklist, Next step, Paper). Reference build: branch `prototype/order-documents`, route `/prototypes/order-documents?v=1` (`&s=fresh|partial|edited|locked` for states, `&role=staff`). Rules are in SPEC §6 and §8.

Sits on the order detail page below the order header. One white card, header "DOCUMENTS" (section label) with the hint "Preview never changes status" on the right.

- **Groups:** "To suppliers" (one row per WO, in letter order, cancelled ones included) then "To customer" (Challan, Invoice). Small muted group headings.
- **Row:** state icon · number (medium) · recipient (supplier name for WOs, "Challan" / "Invoice" for the customer docs) · Needs re-send badge if flagged. Second line: "Sent 21 Oct 2026, 11:20 AM · dated 21 Oct 2026" or "Not sent". Right side: **Preview** (ghost eye icon) and **Share** (phone, share icon) / **Download** (desktop, download icon) as icon buttons with labels for screen readers. The send button is navy when the document still needs sending (not sent or needs re-send) and secondary once sent.
- **State icons (24px circle):** not sent = empty hairline circle; sent = `success` fill with white check; needs re-send = `warning` outline with refresh icon; cancelled = `canvas` fill with grey ×.
- **Cancelled WO row:** number and supplier struck through in `ink-subtle`, then in `danger` "Tell <supplier> that WO-… is cancelled." with a secondary **Done** button. After Done: "Cancelled · supplier told", no actions. (Done clears the dashboard's "cancelled WOs not yet acknowledged".)
- **Share / Download dialog** (opened by the send button): title "Share WO-2026-0012-A" / "Download …", subtitle "<Document> to <recipient>" plus "· order changed since it was last sent" or "· already sent <time>". Document date field (default today, or the stored date on re-send; disabled with "Dates are locked with the order." when locked). Amber warning box listing every SPEC §6.3 / §8.0 warning that applies. Footer: phone = full-width **Share PDF** (shows "Opening share sheet…" while the share sheet is open); desktop = **Open WhatsApp chat** (secondary, `wa.me` link with pre-filled text) and **Download PDF**.
- **Preview dialog:** file name as title, "Preview only. Not marked as sent.", the rendered PDF.
- **Order header** (above the panel): status pill, **WO x/y** badge while some WOs are pending, "Locked" outline badge; customer, order date, delivery date, sell total. When locked, a canvas strip: "Invoice sent, so this order is locked. Documents can still be downloaded." with **Unlock** for Admin (dialog with required reason).
- **Feedback:** toast after each send ("WO-2026-0012-A shared", "Downloaded CH-2026-0012.pdf").

---

## 8. Icons, empty states, motion

- **Icons:** Lucide, outline, 1.5px stroke, 18px in nav, 16px inline. Dashboard `layout-dashboard`, Orders `clipboard-list`, Products `package`, Customers `store`, Suppliers `factory`, Reports `chart-column`, Activity `history`, Settings `settings`.
- **Empty states:** faint navy ZE watermark, one plain line ("No orders yet"), one button for the next action ("Create first order").
- **Motion:** 150–200ms ease-out fades and slides for dialogs, menus, sheets and toasts. Skeleton shimmer while loading. A brief green check when a document is marked sent. No page transitions, nothing bouncy. Respect `prefers-reduced-motion` (no movement, opacity only).
- **Toasts:** bottom-right on desktop, top-centre on phones (clear of the bottom bar).

---

## 9. Installable app (PWA)

Web app manifest: name "ZE Order & Billing", short name "ZE", `display: standalone`, `theme_color` and `background_color` `#081F3F`, icons 192/512 and maskable (white mark on navy). Apple touch icon 180px. No offline mode or service-worker caching.

---

## 10. PDFs

Built for printing and black-and-white photocopies. **Navy only, no brass.**

- Letterhead: navy full logo left (≈40mm wide); company name, address, phone, email right-aligned in 9pt `ink-muted`; 0.75pt navy rule underneath.
- Document title ("WORK ORDER", "DELIVERY CHALLAN", "INVOICE"): uppercase, letter-spacing 0.15em, 16pt, navy. Number and date in a two-column meta block on the right.
- Tables: header row light grey (`#F1F1EE`) with uppercase 8pt labels; 0.5pt hairline rows; numbers right-aligned, tabular.
- Totals in a box with a 1pt navy top rule; amount in words below in italic 9pt.
- Body 9.5pt Geist; footer "Page 1 of 2" 8pt `ink-subtle`.

---

## 11. Theme

Light only in v1. All colours go through the tokens above so dark mode can be added later without touching components.
