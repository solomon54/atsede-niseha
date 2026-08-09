# SRS: ዐጸደ ንስሐ (Atsede Niseha)

**Status:** Living requirements — aligned to [`PRODUCT.md`](./PRODUCT.md)  
**Authority:** If this file conflicts with `PRODUCT.md`, follow `PRODUCT.md`.

---

## 1. Introduction

### 1.1 Purpose

Specify the software requirements for **Atsede Niseha**, a Progressive Web App that extends the logistical and instructional reach of the **መምህረ ንስሐ** without replacing physical sacramental ministry.

### 1.2 Problem

- Hard to schedule in-person confession / counseling across distance.
- Guidance scattered across insecure third-party chat apps.
- No dignified shared place for the whole flock.
- Risk of digitally recording confession content (must never happen).

### 1.3 Solution (v1 focus)

1. **Appointments + notifications** for in-person confession/counseling (primary).
2. **Private Room** chat — Father ↔ one Child.
3. **Common House** chat — Father + entire flock.
4. Identity via Governor → Father → Child claim (EOTC UID).

### 1.4 Scope

**In scope (v1):**
- Roles: Governor, Father, Student (Child)
- Gateway claim / login
- Father registers children; flock directory
- `DIRECT` + `COMMON_HOUSE` messaging
- Appointment request / confirm / remind / complete
- Spiritual timeline fields tied to appointments (last Niseha / Qurban dates)
- PWA install + basic offline shell

**Explicitly out of scope / later:**
- Recording sins or confession content
- REDAT / Delegate role
- Diocesan aggregate dashboards
- Perfect zero-knowledge cryptography as a launch blocker

**Strongly recommended soon after appointments (not forgotten):**
- Qenona daily/final check-off + Father visibility + badges
- Biranna reader; local-only notepad; printable completion certificate

### 1.5 Definitions

| Term | Implementation |
| :--- | :------------- |
| Father | `FATHER` — Memihere Niseha |
| Child | `STUDENT` — Ye-Niseha Lij |
| Governor | `GOVERNOR` — authorizes Fathers |
| Qal Kidan | Father-issued EOTC UID + claim binding |
| Private Room | Channel type `DIRECT` |
| Common House | Channel type `COMMON_HOUSE` |
| Qetero | Appointment record + notifications |
| Tahte Mahtem | Access control + encryption of private guidance; never store sins |

---

## 2. Overall description

### 2.1 Product perspective

Standalone PWA. Cloud (Firebase) for identity, sync, and notifications. Local cache (service worker / IndexedDB) for resilience. Offline-first remains a direction; v1 prioritizes the pastoral appointment loop working reliably online first.

### 2.2 User hierarchy

```
GOVERNOR
   └── FATHER (one family / flock)
          ├── STUDENT (child)
          ├── STUDENT …
          ├── COMMON_HOUSE (all members)
          └── DIRECT channels (Father ↔ each child)
```

### 2.3 Operating environment

Modern mobile browsers (Chrome Android, Safari iOS); installable PWA; usable on modest hardware.

### 2.4 Constraints

- No open registration — identity pre-exists (Governor / Father) before claim.
- No confession-content fields anywhere in UI or schema.
- Private Room content must not be visible to other children.

---

## 3. Architecture (summary)

| Layer | Choice |
| :---- | :----- |
| App | Next.js App Router |
| Auth | Firebase Auth + httpOnly session cookie |
| Data | Firestore |
| Realtime messaging | Pusher (+ local Dexie ledger) |
| Media | Cloudinary (v1; encrypt later if required) |
| PWA | Serwist service worker |

Detailed church operational rules: [`architecture.md`](./architecture.md).

---

## 4. Functional requirements

### 4.1 Identity & covenant

| ID | Requirement |
| :--- | :---------- |
| FR-ID-01 | Governor can authorize a Father identity. |
| FR-ID-02 | Father can register a Child and receive an EOTC UID (covenant link). |
| FR-ID-03 | User enters EOTC UID at Gateway → CLAIM or LOGIN. |
| FR-ID-04 | Claim binds password to the pre-created identity and creates a session. |
| FR-ID-05 | First claim presents a Covenant acknowledgment (secrecy + no confession-data policy). |

### 4.2 Communication

| ID | Requirement |
| :--- | :---------- |
| FR-CHAT-01 | System provisions one `COMMON_HOUSE` per family (Father + all children). |
| FR-CHAT-02 | System provisions one `DIRECT` channel per Father–Child pair. |
| FR-CHAT-03 | Only channel members can read/write that channel. |
| FR-CHAT-04 | Other children cannot access another child’s `DIRECT` thread. |
| FR-CHAT-05 | Common House: **Father and Children may all post**; Father posts must be visually distinct (style/color/badge). |
| FR-CHAT-06 | Private Room supports text and file sharing for personal guidance. |

### 4.3 Appointments & notifications (PRIMARY)

| ID | Requirement |
| :--- | :---------- |
| FR-APT-01 | Child can request an appointment (`NISEHA` \| `COUNSELING`) with their Father. |
| FR-APT-02 | Father can create / propose an appointment for a Child. |
| FR-APT-03 | Appointment has status: `REQUESTED` → `CONFIRMED` → `COMPLETED` \| `CANCELLED` (reschedule returns to confirmable state). |
| FR-APT-04 | Fields: date/time, location (optional), type, notes **for logistics only** (never sin content). |
| FR-APT-05 | Both parties receive **in-app** notification on request, confirm, cancel, and reminder windows. Web push via FCM is optional on free-tier. |
| FR-APT-06 | Completing a `NISEHA` appointment **auto-updates** `lastNisehaDate`; **Child and Father may edit** timeline dates; Father can correct. |
| FR-APT-07 | Father sees flock appointment overview; Child sees only their own. |
| FR-APT-08 | UI copy must state appointments prepare for **in-person** confession; the app is not the sacrament. |

### 4.4 Spiritual timeline

| ID | Requirement |
| :--- | :---------- |
| FR-TL-01 | Store `lastNisehaDate`, `lastQurbanDate`, and appointment history references per Child. |
| FR-TL-02 | Father can view/update logistical dates; Child can view their own. |

### 4.5 Qenona (strongly recommended — ship soon after appointments)

| ID | Requirement |
| :--- | :---------- |
| FR-QEN-01 | Father assigns a spiritual rule with daily and/or final expectations and dates. |
| FR-QEN-02 | Child taps **daily** / **final** done (baseline). |
| FR-QEN-03 | Father may **revoke** a check-off when needed (simple; no heavy approval workflow). |
| FR-QEN-04 | Father sees done vs missed; can correct. |
| FR-QEN-05 | Badges/flags reflect performance (dignified; Father + Child scope by default). |
| FR-QEN-06 | Printable campus-exit certificate for **next Memihere Niseha** handoff (Church-formal, not civil legal). |

### 4.6 Deferred / later

| Area | Notes |
| :--- | :---- |
| Biranna reader | Strongly recommended after chat + Qenona |
| Yegil Mastawesha | Local-only notepad — strongly recommended |
| Certificate print | After Qenona performance model is stable |
| REDAT | Delegate role — later |
| MFA / Two-gate recovery | Security phase |

---

## 5. Data (v1)

### 5.1 User profile (conceptual)

```typescript
role: "GOVERNOR" | "FATHER" | "STUDENT";
eotcUid: string;
secularName: string;
simeKristinna?: string;
familyId?: string; // Father + Children isolation boundary
```

### 5.2 Appointment

```typescript
interface Appointment {
  id: string;
  familyId: string;
  fatherUid: string;
  childUid: string;
  type: "NISEHA" | "COUNSELING";
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string; // ISO
  location?: string;
  logisticsNote?: string; // NEVER confession content
  createdBy: string;
  updatedAt: string;
}
```

### 5.3 Messaging

Existing domain: `Channel` (`COMMON_HOUSE` \| `DIRECT`), `ChannelMember`, `Message` — see `src/features/messaging/types/`.

### 5.4 Confession-data exclusion

No schema field, UI input, or category may capture sin lists, confession narratives, or absolution text.

---

## 6. Non-functional requirements

| ID | Requirement |
| :--- | :---------- |
| NFR-01 | Private Room access strictly member-scoped. |
| NFR-02 | TLS in transit; encrypt private message bodies at rest where practical (strengthen toward true E2EE over time — not a v1 blocker). |
| NFR-03 | Elder-friendly Father flows: large targets, clear Amharic labels for primary actions. |
| NFR-04 | Appointment reminders must be reliable enough for pastoral use (in-app minimum; push preferred). |
| NFR-05 | PWA installable; core shell loads on weak networks. |

---

## 7. Risks (short)

| Risk | Mitigation |
| :--- | :--------- |
| App mistaken for digital confession | Persistent UI reminders; no sin fields |
| Private chat leak across siblings | Hard `familyId` + channel membership checks |
| Appointment no-shows | Reminders + clear status workflow |

---

## 8. Traceability

| Product pillar | FR IDs |
| :------------- | :----- |
| Identity | FR-ID-* |
| Private + Common chat | FR-CHAT-* |
| Appointments (primary) | FR-APT-* |
| Timeline | FR-TL-* |
