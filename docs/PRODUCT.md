# Atsede Niseha — Product Source of Truth

**ዐጸደ ንስሐ [Atsede Niseha]** (“Courtyard of Penance”) is a Progressive Web App that helps a **መምህረ ንስሐ [Memihere Niseha]** (Spiritual Father) steward his **የንስሐ ልጆች [Ye-Niseha Lijoch]** (Spiritual Children) across distance — without replacing the Church or the sacrament.

> This file is the product authority. If another doc conflicts with this one, **this one wins**.  
> Church spiritual framing lives in [`architecture.md`](./architecture.md). Technical requirements live in [`SRS.md`](./SRS.md).

---

## 1. Sacred Boundary (non-negotiable)

| Allowed | Forbidden |
| :------ | :-------- |
| Scheduling in-person confession / counseling | Recording **ኃጢአት [Hatiat]** (sins) or confession content |
| Guidance, reminders, teachings, logistics | Treating the app as a substitute for physical **ምስጢረ ንስሐ** |
| Tracking *dates* of last confession / communion | Storing sacramental absolution or sin catalogs |
| Tracking assigned spiritual rules (ቀኖና) completion | Storing why the rule was assigned (sin-related reasons) |

The app is a **logistical and instructional aid** only.

---

## 2. Roles & courtyard isolation (canonical)

| Role (code) | Spiritual name | Purpose |
| :---------- | :------------- | :------ |
| `GOVERNOR` | System owner / Authority | Registers many Fathers; no flock mixing |
| `FATHER` | መምህረ ንስሐ | **One Father = one family/flock** |
| `STUDENT` | የንስሐ ልጅ | Belongs to **exactly one** Father’s family |

### Isolation rules (locked)

- Many Fathers exist in the system (all authorized by Governor).
- **No family mix:** a Child never appears in another Father’s flock, Common House, or Private Room.
- Child identity is **bound to their Father** (EOTC UID / covenant link minted under that Father; `familyId` = Father’s UID).
- **No Father claim → no Children:** only a claimed Father can register Children. Therefore channels are provisioned for an active Father before Children join — no orphan Child without a Father.
- On **first claim**, the Child is joined to:
  1. that family’s **Common House**, and  
  2. their **Private Room** with that Father.

**Out of v1 (deferred):** `REDAT` / ረዳት (Delegate).

---

## 3. Identity & onboarding (canonical flow)

```
Governor authorizes Father
        ↓
Father registers Child → EOTC UID (covenant link) exists
        ↓
User enters EOTC UID at Gateway
        ↓
Unclaimed → CLAIM (set password) | Claimed → LOGIN
        ↓
Session created → role home
```

- Entry is **not** open self-registration.
- The Father-minted **EOTC UID** *is* the practical **ቃል ኪዳን [Qal Kidan]** link for v1.
- A formal “Covenant acknowledgment” screen (secrecy + no confession-data policy) should be added at first claim.

---

## 4. Communication (core)

Two channel types — already modeled in code as `DIRECT` and `COMMON_HOUSE`:

### 4.1 Private Room — የግል ክፍል (`DIRECT`)

- **Who:** Father ↔ **one** Child only.
- **What:** private guidance, questions, personal instructions, appointment coordination.
- **Who must not see it:** other children, Governor (content), future Delegates.

### 4.2 Common House — የጋራ ቤት (`COMMON_HOUSE`)

- **Who:** Father + **all** children in that flock.
- **Who can post:** **Everyone** (Father and Children).
- **Visual distinction (decided):** Father posts and Child posts must be clearly different — style **and/or** color **and/or** badge (e.g. paternal badge vs child badge). Prefer calm hierarchy, not noisy “gamified chat.”
- **What:** shared announcements, general teachings, prayer schedules, communal questions.
- Teachings for v1 travel here as messages (text/files). Dedicated Biranna reader = strongly recommended follow-on.

---

## 5. Appointments — primary Father↔Child logistics loop

> Manage **in-person** meetings for confession / counseling — request → confirm → remind → complete — **without ever storing what was confessed**.

### 5.1 Who starts

**Both** Father and Child can create / propose an appointment (`NISEHA` | `COUNSELING`).

### 5.2 Lifecycle

| Capability | Intent |
| :--------- | :----- |
| Request / propose | Either party |
| Confirm / reschedule / cancel | Shared status both can act on (with clear who-did-what) |
| Notify | **v1: in-app required.** Phone push **nice-to-have** on free-tier (e.g. Firebase Cloud Messaging on Spark — no paid push vendor required) |
| Complete | Marks meeting done |
| Dates | **Auto-filled on complete**, but **manually editable** by Father and Child where appropriate |
| History | Upcoming + past visible to Father and that Child |

### 5.3 Timeline link

Completing a `NISEHA` appointment **auto-updates** `lastNisehaDate`.  
**Both Child and Father can edit** timeline dates; Father can always correct.

### 5.4 Never stored

Sin content, confession narratives, absolution text.

---

## 6. ቀኖና [Qenona] — assigned spiritual rules (strongly recommended)

Father assigns a structured rule (fast, prostrations, readings, prayer cycle, etc.). Child reports progress; Father sees compliance.

### 6.1 Behavior (decided)

| Rule | Intent |
| :--- | :----- |
| Assignment | Father sets the rule, schedule (daily and/or final target), and dates (manual where needed) |
| Daily / final check-off | **Child taps done** (baseline). Father **may revoke** a check-off when needed — keep revoke simple; do not over-engineer approval workflows |
| Visibility | Father sees what was done vs missed (per day / overall) |
| Oversight | Father can edit / correct; Child reports via tap |
| Performance signals | **Badges and flags** (dignified) — scoped to Father + that Child unless later opened carefully |
| Certificate | Campus-exit printable PDF for next Father (offline handoff). In-app Father-to-Father transfer = later. |

### 6.2 Boundary

Track **what was assigned and whether it was done** — never **why** it was assigned in terms of specific sins.

---

## 7. Strongly recommended (not blockers for first appointment ship)

Ship appointments + chat first; then prioritize these heavily:

1. Qenona (daily/final + Father visibility + badges/flags)
2. Biranna-style teachings reader (beyond Common House messages)
3. Local-only spiritual notepad (never cloud-sync)

---

## 8. Product priority (build order)

1. **Appointments + in-app notifications** (+ free-tier push if low-cost)
2. **Messaging** — Private + Common House with Father/Child post distinction
3. **Spiritual timeline** (real dates, editable)
4. **Qenona** progress + Father dashboard + badges/flags
5. Covenant acknowledgment on first claim
6. Biranna reader + local notepad
7. Printable **campus-exit / next-Father handoff** certificate
8. Security hardening (stronger encryption, recovery, MFA)
9. Deferred: REDAT, diocesan dashboards, Father-to-Father digital transfer

---

## 9. Free-tier constraint

Build assuming **free-tier** Firebase / hosting / messaging limits:

- Prefer **Firebase Cloud Messaging** for web push (Spark-friendly) over paid push vendors.
- In-app notification center is the reliable v1 baseline.
- Avoid features that force paid plans (heavy media CDN, SMS MFA, etc.) until needed.

---

## 10. Design tone

- Amharic / Geʿez vocabulary where it helps elders.
- Calm, dignified UI — spiritual badges, not secular gamification noise.
- Full skeuomorphic Biranna parchment = strongly recommended phase, not day-one blocker.

---

## 11. Glossary

| Term | Meaning |
| :--- | :------ |
| Atsede Niseha | The PWA / courtyard |
| Memihere Niseha / Father | Shepherd of one flock |
| Ye-Niseha Lij / Student | Child in that flock |
| Qal Kidan | Covenant link (v1 = Father-issued EOTC UID + claim) |
| Yegil Kifil / Private Room | `DIRECT` channel |
| Yegara Bet / Common House | `COMMON_HOUSE` — all may post; Father posts visually distinct |
| Qetero | In-person appointment logistics |
| Qenona | Assigned spiritual rule + daily/final check-off + Father visibility |
| Tahte Mahtem | Secrecy — protect private guidance; never store sins |
| Awedemihret | General spiritual feeding (Common House now; Biranna reader later) |
| Yegil Mastawesha | Local-only notepad (strongly recommended later) |
