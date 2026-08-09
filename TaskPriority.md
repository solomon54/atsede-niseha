# Atsede Niseha — Build Priority

Source of truth: [`docs/PRODUCT.md`](./docs/PRODUCT.md)

## Identity flow (already canonical)

```
Governor / Authority creates identity
        ↓
Identity record exists
        ↓
User enters EOTC UID
        ↓
Gateway checks identity
        ↓
User CLAIMS the account
        ↓
Password + identity binding
        ↓
User session created
```

## Product build order

1. **Appointments + in-app notifications** ✅ started (`/appointments`, `/api/appointments`, `/api/notifications`)
2. **Messaging** — Private Room + Common House; **all can post**; Father vs Child visually distinct
3. **Spiritual timeline** — real dates, editable by Father and Child where needed
4. **Qenona** — Father assigns; Child daily/final check-off; Father sees done/missed; badges/flags
5. Covenant acknowledgment on first claim
6. Biranna reader + local notepad (strongly recommended)
7. Printable campus-exit certificate (PDF for next Father)
8. Security hardening; deferred: REDAT

## Communication model (lock this)

| Channel | Members | Posting |
| :------ | :------ | :------ |
| Private Room | Father + one Child | Both |
| Common House | Father + all Children | All — Father posts distinct style/color/badge |

## Sacred boundary

Never store confession content or sins — only logistics and rule-completion status.
