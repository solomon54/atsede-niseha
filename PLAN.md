The live site (https://atsede-niseha-v1.vercel.app/) and the original GitHub repo stay in production. This copy does not replace them until a change is deployed on purpose.

## Locked decisions

- Ship a native Android client in 30–45 days.
- The PWA remains in use. Do not shut it down.
- Same Firebase project, same Firestore, same API.
- Video is LiveKit Cloud, free Build plan (5,000 participant-minutes/month).
- Users now: about 300–500. Budget: $0.
- Coding agents do the implementation. A human reviews each slice before the next one starts.

Sacred boundary, still absolute: the app schedules confession and counseling, carries guidance, and tracks dates and rule completion. It never stores sins, confession narratives, or why a rule was assigned.

## What v1 includes

1. Gateway — EOTC UID, then claim or login
2. Homes for Father, Child, and a thin Governor
3. Appointments — request, confirm, reschedule, cancel, complete
4. Timeline dates already driven by appointments
5. Private Room chat — Father and one Child
6. Common House chat — Father and the flock; Father posts look different
7. Push notifications for appointment changes, new messages, and incoming calls
8. LiveKit video from a Private Room (1:1)
9. LiveKit video from Common House, capped (8 people)
10. Local cache (sqlite) so appointments and recent messages open with no network
11. Pastoral screen privacy: FLAG_SECURE so the Android app switcher cannot snapshot private counseling threads

Leave these out of this window:

- A full bidirectional offline sync engine
- Signal-style Double Ratchet E2EE
- Qenona, Biranna, local notepad, exit certificate
- iOS, tablet-specific layouts, desktop builds
- Google Play Store submission (direct APK / Firebase App Distribution only)
- REDAT / Delegate
- Any new field that could hold confession content

## How the two apps share one backend

`mobile/` is a client. The Next.js app in this folder is the server.

| Concern | Where it lives |
|---|---|
| Identity, flocks, appointments, messages | Existing Firebase + existing API routes |
| Session / claim / login | Existing auth. Next.js supports both cookies (web) and `Authorization: Bearer <token>` (phone). |
| Session storage on phone | `expo-secure-store` (backed by Android KeyStore), not plain storage. |
| Live chat while the app is open | Existing Pusher |
| Video token | New route on this Next.js app: `POST /api/livekit/token` (capped to 2 in DIRECT, 8 in COMMON_HOUSE) |
| Push token | Save an FCM token on the existing user record |
| Screen privacy | `expo-screen-capture` (`FLAG_SECURE`) |
| Shared code | `mobile/metro.config.js` sets `watchFolders: [path.resolve(__dirname, '..')]` to share Zod schemas and date math. |
| Phone UI, cache, call screen | `mobile/` only |

A Father on the website and a Child on the phone are in the same rooms. Do not fork data.

When a backend change is ready (the token route, FCM, Bearer token check in `session.service.ts`), deploy that change to the existing Vercel project. Do not stand up a parallel API.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile Runtime | Expo, TypeScript, Expo Router | **Must use Expo Dev Client (`expo-dev-client`)**. LiveKit native WebRTC modules cannot run in standard Expo Go. |
| Server state | TanStack Query | Reads local cache first, then syncs with API |
| Forms | react-hook-form + the Zod schemas already in this repo | Shared via Metro config |
| Storage & Session | `expo-sqlite` (data cache) + `expo-secure-store` (auth token) | Never store auth in plain AsyncStorage |
| Push | `expo-notifications` + FCM | High-priority data notifications for incoming calls |
| Video | `@livekit/react-native`, LiveKit Cloud Build | 480p/720p 24fps mobile preset with audio fallback |
| Device Privacy | `expo-screen-capture` (`FLAG_SECURE`) | Blanks screenshot preview in recent apps |
| API base | `EXPO_PUBLIC_API_URL` = the live Vercel URL | |

Do not switch to Flutter. Do not add a new auth system.

## LiveKit

Free Build plan: 5,000 participant-minutes per month, on the order of 100 concurrent participants, no credit card. Short pastoral calls at this user count fit. If the month's minutes run out, video shows unavailable and chat still works.

Token route, on the existing server (`POST /api/livekit/token`):

- Caller must be logged in.
- Caller must be a member of that `DIRECT` or `COMMON_HOUSE` channel.
- Room name is the channel id. Never a name the client invented.
- Enforce max participants: 2 for `DIRECT`, 8 for `COMMON_HOUSE`.
- Token lifetime: 2 hours.
- Disconnect and stop media on component unmount to protect free minutes.

Self-hosting is later. Not in these 45 days.

## Build order

### Days 1–3 — both apps boot & auth session

- Confirm `npm run dev` still runs the copied web app.
- Create `mobile/` with Expo and configure `expo-dev-client` (`npx expo run:android`).
- Configure `mobile/metro.config.js` with `watchFolders` to resolve shared Zod schemas and date helpers.
- Update Next.js auth (`session.service.ts` & `loginUser`) so API accepts `Authorization: Bearer <token>` and returns the session token in JSON for the phone.
- Store session in `expo-secure-store`.
- Log in as one test Father and one test Child; verify session survives app restart.

### Days 4–12 — identity and appointments

- Gateway: UID, claim, login screens.
- Appointment list and status changes (request, confirm, reschedule, cancel, complete).
- Show timeline dates. Do not invent a second date model.
- Enable `preventScreenCaptureAsync()` (`FLAG_SECURE`) for pastoral privacy.
- Loading, empty, and error states.

### Days 13–22 — chat

- One Private Room and one Common House.
- Send and receive text.
- Live updates via Pusher.
- On reconnect, load messages after the last id/sequence stored on the phone.
- Pending until the server accepts, then sent.
- Father posts in Common House are visually distinct.
- Membership stays enforced by the API.

### Days 23–30 — push and cache

- Save the FCM token through the API (`POST /api/notifications/fcm` or existing user record).
- A notification opens the appointment or the thread.
- sqlite cache holds:
  - `appointments_cache` table
  - `messages_cache` table (last 50 messages per channel)
- Screens read cache first (0ms load), then fetch fresh data from API and update sqlite.

### Days 31–40 — video

- Join from Private Room and from Common House.
- Token, connect, mute, camera toggle, audio routing (speaker/earpiece), leave.
- Incoming call notification: High-priority FCM push with heads-up banner and one-tap join.
- Test on two physical Android phones on mobile data.
- If video fails, chat still works.

### Days 41–45 — APK

- Signed release APK (`eas build -p android --profile preview` or local Gradle assembleRelease).
- Install via Firebase App Distribution or a direct download.
- Five real people: one Father, four Children.
- Fix only crashes and broken login, send, or join.

## Agent working rules

1. This folder is the workspace. Read the web code to match real API shapes.
2. New phone UI goes in `mobile/`. Do not rebuild screens that already exist on the web unless the phone needs them.
3. Change the Next.js app when the phone needs something it does not have: LiveKit tokens, FCM token storage, Bearer token check in `session.service.ts`. Keep those changes small.
4. Run and test with Expo Dev Client (`npx expo run:android`), never standard Expo Go, because LiveKit WebRTC requires native libraries.
5. One slice per agent run (one screen, or one hook, or one route). Review before the next run.
6. Role codes stay `GOVERNOR`, `FATHER`, `STUDENT`. Channel types stay `DIRECT` and `COMMON_HOUSE`.
7. Mutations go through the existing API. The phone is not a second source of truth.
8. Reuse Zod and calendar helpers via Metro `watchFolders`. Do not re-specify business rules in the phone.
9. Amharic labels where the web app already uses them. Calm, reverent UI.
10. Never add confession or sin fields, notes, or uploads.
11. Do not create another Firebase project. Do not add Flutter. Do not start Qenona, Biranna, or E2EE in this window.

## Deploy

- Mobile: APK from `mobile/`. No Play Console required for the first users.
- Server: only the token route, FCM changes, and Bearer token support, deployed to the existing Vercel project when they work against the live Firebase project.
- Web users keep using the PWA the whole time.

## Done

A Child on Android can claim, request an appointment, chat in their Private Room, get a push, and join a video call with their Father. That Father can still do the same from the website. One Firebase project. The website stayed up.
