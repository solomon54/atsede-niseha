# SRS DRAFT TEMPLATE: ዐጸደ ንስሐ (Atsede Niseha)

## ፩. Introduction (መግቢያ)

### 1.1 Purpose

The purpose of this document is to provide a comprehensive Software Requirements Specification (SRS) for the **ዐጸደ ንስሐ [Atsede Niseha]** platform. This Progressive Web App (PWA) is engineered to serve as a high-fidelity logistical and instructional extension of the **መምህረ ንስሐ [Memihere Niseha]** (Spiritual Father). Its primary objective is to facilitate **መንፈሳዊ አባትነት [Menfesawi Abatinet]** (Spiritual Stewardship) in an era defined by geographical dispersion and digital volatility. This system is designed to complement, not replace, the physical presence and sacramental authority of the **ቤተክርስቲያን [Betekristiyan]** (Church).

### 1.2 Problem Statement

In the contemporary landscape, the traditional bond between the **መምህረ ንስሐ [Memihere Niseha]** and the **የንስሐ ልጅ [Ye-Niseha Lij]** (Spiritual Child) faces unprecedented logistical hurdles. Rapid urbanization, migration, and the "digital noise" of secular life have created a disconnect.

Specifically:

- **Scheduling Friction:** Arranging physical appointments for **ምክረ አበው [Mikre Abew]** (Patristic Advice) or the **ምስጢረ ንስሐ [Mistire Niseha]** (Sacrament of Penance) is often inefficient via unsecured third-party messaging apps.
- **Instructional Fragmentation:** Delivering consistent **መንፈሳዊ ምግብ [Menfesawi Migib]** (Spiritual Food) and monitoring a child's **ቀኖና [Qenona]** (Spiritual Rule/Penance) milestones lack a centralized, dignified, and secure channel.
- **Secrecy Risks:** Current digital communications often compromise the **ታኅተ ማኅተም [Tahte Mahtem]** (Under the Seal/Secrecy) through data harvesting and non-encrypted storage.

### 1.3 Proposed Solution: The Digital Courtyard

The **ዐጸደ ንስሐ [Atsede Niseha]** platform offers a "Digital Courtyard"—a secure, **Offline-First** environment built on the principle of **መንፈሳዊ ጥበቃ [Menfesawi Tibeqa]** (Spiritual Protection).

The solution employs:

- A **ብራና [Biranna]** (Tactile/Skeuomorphic) interface that honors the aesthetics of ancient manuscripts to foster a state of **ተመስጦ [Temesto]** (Contemplation).
- **Zero-Knowledge Architecture** to ensure that all communications remain **ታኅተ ማኅተም [Tahte Mahtem]** (Encrypted/Sealed), accessible only to the Father and the Child.
- A resilient synchronization engine that prioritizes the "Disconnected-by-Default" nature of users in regions with intermittent connectivity.

### 1.4 Scope: The Sacred Boundary

The scope of **ዐጸደ ንስሐ [Atsede Niseha]** is strictly defined by the **"Sacred Boundary."** The application is an administrative and instructional tool; it is **NOT** a repository for the **ምስጢረ ንስሐ [Mistire Niseha]** (Sacrament of Confession).

#### 1.4.1 Included Functionalities

- Secure scheduling and appointment management for in-person sessions.
- **ዓውደ ምሕረት [Awedemihret]**: A broadcast module for general spiritual teachings.
- **ምስጢር ማኅደር [Mistir Mahder]**: Encrypted one-on-one **አባታዊ ምክር [Abatawi Mikir]** (Paternal Guidance).
- **ቀኖና [Qenona]** tracking: Monitoring the completion of prayer rules, fasts, and prostrations.

#### 1.4.2 Explicit Exclusions (Confession-Data Exclusion Policy)

- **Strict Prohibition:** The platform shall **NEVER** contain fields or categories for the recording of specific **ኃጢአት [Hatiat]** (Sins).
- **Sacramental Integrity:** The act of verbal confession and the subsequent prayer of absolution are strictly reserved for in-person, physical encounters. No digital record of a child's specific faults shall be stored within the **IndexedDB** or **Cloud Storage**.

### 1.5 Definitions: Technical-Spiritual Mapping

| Spiritual Term      | አማርኛ / ግዕዝ | Technical Implementation                                    |
| :------------------ | :--------- | :---------------------------------------------------------- |
| **Atsede Niseha**   | ዐጸደ ንስሐ    | The PWA Ecosystem; "Courtyard of Penance."                  |
| **Memihere Niseha** | መምህረ ንስሐ   | Administrative User / Spiritual Shepherd.                   |
| **Ye-Niseha Lij**   | የንስሐ ልጅ    | Standard User / Spiritual Child.                            |
| **Qal Kidan**       | ቃል ኪዳን     | **Covenant Onboarding**: Token-based identity verification. |
| **Tahte Mahtem**    | ታኅተ ማኅተም   | **End-to-End Encryption (E2EE)** using AES-256.             |
| **Biranna**         | ብራና        | Skeuomorphic UI (Vellum/Parchment design logic).            |
| **Mistir Mahder**   | ምስጢር ማኅደር  | The "Private Sanctuary": E2EE Private Messaging.            |
| **Awedemihret**     | ዓውደ ምሕረት   | Content Delivery Network (CDN) for public teachings.        |
| **Qenona**          | ቀኖና        | Milestone-based Task Management (Spiritual Rule).           |

### 1.6 References

- **ዐጸደ ንስሐ መሠረታዊ የሥራ መመሪያ [Atsede Niseha Basic Operational Manual]:** The primary ecclesiastical guideline for the platform's rules of engagement.
- **ፍትሐ መንፈሳዊ [Fethat Menfesawi]:** Regarding the canons of secrecy and paternal responsibility.
- **IEEE Std 830-1998:** Recommended Practice for Software Requirements Specifications.
- **W3C PWA Standards:** For Offline-First service worker implementation and manifest protocols.

---

**END OF SECTION 1**

## ፪. Overall Description (አጠቃላይ መግለጫ)

### 2.1 Product Perspective

**ዐጸደ ንስሐ [Atsede Niseha]** is an independent, standalone Progressive Web App (PWA) built with an **Offline-First** architectural philosophy. Recognizing the geographical reality of spiritual life—ranging from urban centers to remote **ገዳማት [Gedamat]** (Monasteries) and rural **አህጉረ ስብከት [Ahigure Sibket]** (Dioceses)—the system is engineered to be **"Disconnected-by-Default."**

Unlike conventional cloud-dependent applications, **ዐጸደ ንስሐ [Atsede Niseha]** treats the local device as the primary source of truth. The application remains fully functional in environments with zero or intermittent 2G/3G connectivity. Synchronization with the central server occurs optimistically and asynchronously only when a stable network is detected, ensuring that the **መንፈሳዊ አገልግሎት [Menfesawi Agelgilot]** (Spiritual Service) is never interrupted by technical latency.

### 2.2 User Hierarchy & Access Control (የተጠቃሚዎች ተዋረድ)

The system strictly adheres to the ecclesiastical structure of the **ቤተክርስቲያን [Betekristiyan]**, implementing a role-based access control (RBAC) model rooted in spiritual fatherhood.

#### 2.2.1 መምህረ ንስሐ [Memihere Niseha] (The Father/Shepherd)

The **መምህረ ንስሐ [Memihere Niseha]** occupies the root authority within the platform.

- **Oversight:** Full visibility of the flock’s logistical and milestone data.
- **Instruction:** Exclusive authority to publish teachings to the **ዓውደ ምሕረት [Awedemihret]** (Common Pulse).
- **Paternal Guidance:** Holder of the unique private keys required to decrypt and engage in the **ምስጢር ማኅደር [Mistir Mahder]** (Private Sanctuary).
- **Token Generation:** Sole authority to generate the **ቃል ኪዳን [Qal Kidan]** tokens for onboarding new children.

#### 2.2.2 ረዳት/ወኪል [Redat/Wekil] (The Delegate/Assistant)

This role is designed for a **ዲያቆን [Diyakon]** (Deacon) or a senior student appointed to assist with administrative burdens.

- **Logistics:** Responsible for managing the **ቀጠሮ [Qetero]** (Paternal Schedule) and broadcasting general announcements.
- **Strict Boundary:** The **ረዳት/ወኪል [Redat/Wekil]** is programmatically prohibited from accessing or viewing any encrypted threads within the **ምስጢር ማኅደር [Mistir Mahder]**. Their role is strictly limited to the "Outer Courtyard" of administration.

#### 2.2.3 የንስሐ ልጅ [Ye-Niseha Lij] (The Child/Sheep)

The **የንስሐ ልጅ [Ye-Niseha Lij]** is the primary beneficiary of the stewardship.

- **Reception:** Accesses teachings from the **ዓውደ ምሕረት [Awedemihret]**.
- **Stewardship:** Tracks personal **ቀኖና [Qenona]** (Spiritual Rule) milestones.
- **Communication:** Initiates counseling requests and engages in private, encrypted dialogue with the Father.

### 2.3 Operating Environment

To ensure maximum reach across diverse socio-economic backgrounds, **ዐጸደ ንስሐ [Atsede Niseha]** shall operate under the following conditions:

- **Hardware:** Optimized for low-end mobile devices with limited RAM and processing power.
- **Platform Compatibility:** Fully functional on evergreen browsers (Chrome for Android, Safari for iOS) as an installable PWA.
- **Storage:** Minimal local footprint, utilizing **IndexedDB** for persistent local data and **Service Workers** for asset caching.

### 2.4 Design and Implementation Constraints

#### 2.4.1 ብራና [Biranna] UI Requirement

The interface must strictly adhere to the **ብራና [Biranna]** design language. This is a skeuomorphic aesthetic that utilizes parchment-style textures, **ቀለም [Qelem]** (traditional ink) color palettes—specifically **Cinnabar Red** for emphasis—and Ethiopic typography. The UI must evoke the dignity of an ancient manuscript, discouraging the "infinite scroll" behavior of secular apps in favor of a paginated, contemplative experience.

#### 2.4.2 ቃል ኪዳን [Qal Kidan] Onboarding Logic

The system rejects open, self-service registration. Entry into the **ዐጸደ ንስሐ [Atsede Niseha]** is a "Covenant" act. A **የንስሐ ልጅ [Ye-Niseha Lij]** can only activate an account by utilizing a unique, one-time-use cryptographic token generated manually by their **መምህረ ንስሐ [Memihere Niseha]**. This reinforces the traditional requirement of an existing spiritual bond before digital engagement.

### 2.5 Assumptions and Dependencies

- **Hardware Assumption:** Users are assumed to possess a basic smartphone capable of running a modern web browser.

- **Connectivity Dependency:** While the app is "Disconnected-by-Default," it is assumed that the **መምህረ ንስሐ [Memihere Niseha]** has periodic access to the internet (at least once per week) to synchronize teachings and receive counseling requests.
- **Ecclesiastical Authority:** The effectiveness of the system depends on the **መምህረ ንስሐ [Memihere Niseha]** actively managing the **ዓውደ ምሕረት [Awedemihret]** as the primary source of instructional content.

---

**END OF SECTION 2**

## ፫. Technical Architecture (የቴክኒክ መዋቅር)

### 3.1 Architectural Style: Local-First PWA

**ዐጸደ ንስሐ [Atsede Niseha]** employs a **Local-First Architectural Style**, moving beyond simple offline-compatibility to a "Disconnected-by-Default" paradigm. In this model, the client's **IndexedDB** serves as the primary, authoritative database.

This approach ensures:

- **Zero-Latency Interaction:** All user actions, including note-taking and navigating the **ብራና [Biranna]** interface, are committed to local storage instantly without awaiting a network round-trip.
- **100% Availability:** The core application logic remains fully functional in the absence of an internet connection, treating the cloud merely as a durable relay and backup mechanism rather than a mandatory runtime dependency.

### 3.2 Frontend Stack (የፊት-ለፊት ቴክኖሎጂ)

The user interface is engineered for high-performance rendering and tactile immersion.

- **Next.js 14+ (App Router):** Utilized for robust client-side routing and Server-Side Rendering (SSR) optimizations during initial hydration. The App Router architecture facilitates nested layouts, essential for the tiered access between the "Outer Courtyard" (Admin) and the "Private Sanctuary."
- **Tailwind CSS:** Employed to implement the **ብራና [Biranna]** skeuomorphic design system. Custom utility classes define the parchment textures, organic borders, and the traditional **ቀለም [Qelem]** (ink) typography.
- **Framer Motion:** Integrated to power the "Tactile Reader Engine." It handles complex 3D transforms and gesture-based physics to simulate the realistic page-turning of a physical manuscript, reinforcing the sense of **ተመስጦ [Temesto]** (Contemplation).

### 3.3 Backend & Synchronization Layer

The backend infrastructure acts as a silent synchronization mesh, connecting disparate local nodes.

- **Firebase Firestore:** Serves as the global synchronization layer. Its real-time listeners are utilized to detect when new paternal guidance or teachings are available for the child.
- **Service Workers:** Function as a programmable network proxy. They pre-cache all critical assets (scripts, fonts, and parchment textures) during the initial **ቃል ኪዳን [Qal Kidan]** onboarding, enabling "Instant-On" functionality even in deep-offline states.
- **Background Sync API:** Orchestrates the automatic reconciliation of local **IndexedDB** changes with the cloud. When a device transitions from offline to online, pending updates (such as completed **ቀኖና [Qenona]** milestones) are pushed to the server in the background without user intervention.

### 3.4 Security Architecture: The Seal of Secrecy (ታኅተ ማኅተም)

The technical integrity of the **ታኅተ ማኅተም [Tahte Mahtem]** (Seal of Secrecy) is maintained through a strict Zero-Knowledge cryptographic model.

- **End-to-End Encryption (E2EE):** All communications within the **ምስጢር ማኅደር [Mistir Mahder]** (Private Sanctuary) are encrypted using the **AES-256** standard.
- **Device-Side Key Generation:** Cryptographic keys are generated and stored exclusively on the user's local device (within the Secure Enclave or hardware-backed keystore).
- **Zero-Knowledge Principle:** Because the **መምህረ ንስሐ [Memihere Niseha]** and the **የንስሐ ልጅ [Ye-Niseha Lij]** hold the only decryption keys, the central server, Firebase administrators, and even the **ረዳት/ወኪል [Redat/Wekil]** (Delegate) are programmatically incapable of reading the raw text of the spiritual guidance. The data remains "blind" to the infrastructure.

### 3.5 Data Flow & Synchronization Logic

Data within the courtyard follows two distinct transmission paths:

1. **Instructional Broadcast (ዓውደ ምሕረት):**

   - The **መምህረ ንስሐ [Memihere Niseha]** publishes a teaching.
   - The content is encrypted with a "Broadcast Key" and pushed to the Cloud.
   - The **የንስሐ ልጅ [Ye-Niseha Lij]**’s device detects the update and "pulls" the teaching into the local **ብራና [Biranna]** engine during the next sync window.

2. **Paternal Guidance (ምስጢር ማኅደር):**
   - A bidirectional, peer-to-peer encrypted tunnel is established.
   - Updates are staged in the local **IndexedDB** with a `sync_status: pending` flag.
   - The **Background Sync API** attempts transmission until a successful 200-OK acknowledgment is received from the Cloud Relay, at which point the status is updated to `synced`.

---

**END OF SECTION 3**

## ፬. Functional Requirements (ተግባራዊ መስፈርቶች)

### 4.1 ቃል ኪዳን [Qal Kidan] (The Spiritual Covenant & Onboarding)

The entry into the **ዐጸደ ንስሐ [Atsede Niseha]** is not a secular registration but a digital reflection of the spiritual bond between a Father and a Child.

- **FR-4.1-01: Token Generation (Father):** The **መምህረ ንስሐ [Memihere Niseha]** shall have the exclusive functional ability to generate a unique, single-use alphanumeric cryptographic code (Token) for a prospective **የንስሐ ልጅ [Ye-Niseha Lij]**.
- **FR-4.1-02: Soul-Linking (Onboarding):** To activate the account, the **የንስሐ ልጅ [Ye-Niseha Lij]** must enter the provided Token. This action "links" the two accounts in a paternal-filial hierarchy within the database.
- **FR-4.1-03: Spiritual Covenant Agreement:** Upon the first entry, the system shall present a "Covenant Screen." The user must formally acknowledge the terms of the **መንፈሳዊ ምስጢር [Menfesawi Mistir]** (Spiritual Secrecy), the exclusion of confession data, and the commitment to a life of **ተጋድሎ [Tegadlo]** (Spiritual Struggle).

### 4.2 የጋራ ቤት [Yegara Bet] (The Common House / Broadcast Center)

This module serves as the **ዓውደ ምሕረት [Awedemihret]** where the Father feeds his entire flock with general teachings.

- **FR-4.2-01: Multi-Media Stewardship:** The **መምህረ ንስሐ [Memihere Niseha]** shall be able to upload and publish spiritual content in three formats: **ጽሑፍ [Tsihuf]** (Text), **ቃለ እግዚአብሔር [Qale Igziabeher]** (Audio), and **መጽሐፍ [Metsehaf]** (PDF).
- **FR-4.2-02: ብራና [Biranna] Reader Engine:** For the **የንስሐ ልጅ [Ye-Niseha Lij]**, all text-based teachings must be rendered through the **ብራና [Biranna]** engine. This engine enforces a paginated (not scrolling) view with parchment textures and traditional margins.
- **FR-4.2-03: Offline Content Delivery:** Content published in the **የጋራ ቤት [Yegara Bet]** must be automatically cached by the Service Worker, allowing the Child to study the teachings in a "Disconnected-by-Default" state.

### 4.3 የግል ክፍል [Yegil Kifil] (The Private Room / Encrypted Sanctuary)

The **የግል ክፍል [Yegil Kifil]** is the digital **ምስጢር ማኅደር [Mistir Mahder]** for private, one-on-one **አባታዊ ምክር [Abatawi Mikir]** (Paternal Guidance).

- **FR-4.3-01: Sacred Scroll Interface:** The UI for this module shall strictly avoid "casual chat" aesthetics. Messages must appear as chronological entries on a continuous digital scroll, utilizing dignified Ethiopic typography.
- **FR-4.3-02: E2EE Tunneling:** The system shall facilitate a bidirectional AES-256 encrypted thread. Messages are encrypted on the sender's device and decrypted only on the recipient's device.
- **FR-4.3-03: Appointment Request Trigger:** The interface shall include a specific functional trigger for a "Request for **ቀጠሮ [Qetero]**." This sends a structured notification to the Father/Delegate requesting a physical meeting for the **ምስጢረ ንስሐ [Mistire Niseha]** (Sacrament of Penance).

### 4.4 ቀኖና [Qenona] Tracker & Paternal Scheduler

This module manages the practical application of spiritual discipline and logistical coordination.

- **FR-4.4-01: ቀኖና [Qenona] Assignment:** The **መምህረ ንስሐ [Memihere Niseha]** shall be able to assign a structured "Spiritual Rule" to a child (e.g., a specific fast duration, a cycle of **ስግደት [Sigdet]** / Prostrations, or daily scripture readings).
- **FR-4.4-02: Discipline Check-off:** The **የንስሐ ልጅ [Ye-Niseha Lij]** shall have a daily interface to "check off" their progress. This provides the child with a visual sense of spiritual consistency (**ትዕግሥት [Tigist]**).
- **FR-4.4-03: Physical Meeting Scheduler:** The **ረዳት/ወኪል [Redat/Wekil]** (Delegate) shall manage the Father’s availability calendar. The Child can view available time slots and book a physical appointment for confession or counseling.

### 4.5 የግል ማስታወሻ [Yegil Mastawesha] (The Spiritual Notepad)

To facilitate deep self-examination (**መረዳት [Meredat]**), the app provides a sanctuary for the Child's internal reflections.

- **FR-4.5-01: Local-Only Encryption:** The system shall provide a private notepad for the **የንስሐ ልጅ [Ye-Niseha Lij]** to record spiritual feelings, dreams, or reminders for their next physical confession.
- **FR-4.5-02: Zero-Sync Policy (The Hidden Ledger):** **Constraint:** Data entered into the **የግል ማስታወሻ [Yegil Mastawesha]** shall strictly remain on the local device's **IndexedDB**. It shall **NEVER** be synchronized to the Cloud or Firebase.
- **FR-4.5-03: Bio-Metric/Pin Protection:** Access to this notepad shall require a secondary local authentication (PIN or Biometric) to ensure the contents remain known only to the user and their conscience.

---

**END OF SECTION 4**

## ፭. Data Schema & Integrity (የውሂብ አያያዝ)

### 5.1 Data Models (የውሂብ ሞዴሎች)

The **ዐጸደ ንስሐ [Atsede Niseha]** system utilizes a dual-layer persistence strategy where local **IndexedDB** schemas map to **Firebase Firestore** collections, with the exception of the **የግል ማስታወሻ [Yegil Mastawesha]** (Personal Notepad).

#### 5.1.1 User Profile (የተጠቃሚ መገለጫ)

This model captures the essential identity of the **የንስሐ ልጅ [Ye-Niseha Lij]** as required for paternal oversight.

```typescript
interface UserProfile {
  uid: string; // Firebase Auth UID
  secularName: string;
  simeKristinna: string; // ስመ ክርስትና (Christian Name)
  email: string;
  role: "MEMIHERE_NISEHA" | "REDAT" | "YE_NISEHA_LIJ";
  demographics: {
    age: number;
    gender: "MALE" | "FEMALE";
    lifeStatus: string; // Education, Work, or Vocation
  };
  covenantId: string; // Foreign Key to Qal Kidan
  updatedAt: string; // ISO 8601
}
```

#### 5.1.2 Covenant [ቃል ኪዳን] (The Paternal-Filial Link)

This schema defines the digital "Soul-Link" established during onboarding.

```typescript
interface QalKidan {
  id: string; // Unique Covenant ID
  fatherUid: string; // UID of the Memihere Niseha
  childUid: string; // UID of the Ye-Niseha Lij
  tokenId: string; // The one-time token used for activation
  joinDate: string; // The date the digital covenant was sealed
  status: "ACTIVE" | "ARCHIVED";
}
```

#### 5.1.3 Spiritual Timeline (መንፈሳዊ የጊዜ ሰሌዳ)

This model tracks the logistical milestones of a child's sacramental life.

```typescript
interface SpiritualTimeline {
  childUid: string;
  lastNisehaDate: string | null; // Last physical confession date
  lastQurbanDate: string | null; // Last Holy Communion date
  upcomingAppointments: Array<{
    id: string;
    date: string;
    location: string;
    type: "NISEHA" | "COUNSELING";
    status: "PENDING" | "CONFIRMED" | "COMPLETED";
  }>;
  qenonaProgress: {
    ruleName: string;
    startDate: string;
    targetDays: number;
    completedDays: number;
  };
}
```

#### 5.1.4 Sanctuary Message (የምስጢር ማኅደር መልእክት)

The schema for E2EE communications within the **ታኅተ ማኅተም [Tahte Mahtem]** (Seal of Secrecy).

```typescript
interface SanctuaryMessage {
  id: string; // Client-side generated UUID
  covenantId: string;
  senderUid: string;
  encryptedBody: string; // AES-256 result
  iv: string; // Initialization Vector for decryption
  signature: string; // Cryptographic HMAC for integrity check
  timestamp: string; // ISO 8601
  syncStatus: "pending" | "synced" | "error";
}
```

### 5.2 Offline Sync Logic (ከመስመር ውጭ የማመሳሰል ሥርዓት)

To maintain the "Disconnected-by-Default" requirement, **ዐጸደ ንስሐ [Atsede Niseha]** implements a robust synchronization flag system within the browser’s **IndexedDB**.

1. **Pending State:** Any data modified while offline (e.g., a **ቀኖና [Qenona]** check-off) is marked with `syncStatus: 'pending'`.
2. **Optimistic UI:** The interface reflects the change immediately to the user.
3. **Background Reconciliation:** Upon network restoration, the **Service Worker** triggers the **Background Sync API**, batch-uploading all `pending` records to Firestore.
4. **Synced State:** Upon receiving a 200-OK from the cloud, the local record is updated to `synced`.
5. **Error Handling:** If validation fails, the record is marked `error` and flagged for the user to retry manually.

### 5.3 Conflict Resolution: Last-Write-Wins (LWW)

For non-sensitive logistical data (such as appointment times or profile updates), the system employs a **Last-Write-Wins (LWW)** strategy.

- Every record contains a high-resolution `updatedAt` ISO timestamp.
- In the event of a conflict between the local device and the server, the record with the most recent timestamp prevails.
- **Exception:** For the **ምስጢር ማኅደር [Mistir Mahder]**, messages are immutable and appended chronologically, preventing any conflict through historical deletion.

### 5.4 Data Retention & Deletion (መረጃን የማጥፋት መብት)

In accordance with the dignity of the user and international privacy standards, **ዐጸደ ንስሐ [Atsede Niseha]** implements the "Right to be Forgotten."

- **Hard-Delete Policy:** If a **የንስሐ ልጅ [Ye-Niseha Lij]** or **መምህረ ንስሐ [Memihere Niseha]** requests account deletion, all associated cloud-stored data (Covenant links, encrypted message fragments, and timeline logs) shall be programmatically hard-deleted from Firestore within 30 days.
- **Local Purge:** The PWA shall execute a command to clear the local **IndexedDB** and **Cache API** storage upon the next successful login/handshake.

### 5.5 The Hidden Ledger Exception (የግል ማስታወሻ)

The system architecture explicitly denies a server-side schema for the **የግል ማስታወሻ [Yegil Mastawesha]** (Spiritual Notepad).

- **Non-Sync Principle:** Data in this module exists strictly in the client-side **IndexedDB**.
- **Zero Visibility:** Because this data never leaves the device, no Firebase collection or API endpoint shall exist for these reflections. This ensures that the Child's internal thoughts remain entirely between them and their conscience until they choose to share them verbally during the **ምስጢረ ንስሐ [Mistire Niseha]** (Sacrament of Confession).

---

**END OF SECTION 5**

## ፮. Non-Functional Requirements (ተግባራዊ ያልሆኑ መስፈርቶች)

### 6.1 Security Requirements (የደህንነት መስፈርቶች)

The technical integrity of the **ታኅተ ማኅተም [Tahte Mahtem]** (Seal of Secrecy) is the highest priority of the **ዐጸደ ንስሐ [Atsede Niseha]** system.

- **NFR-6.1-01: Multi-Factor Authentication (MFA):** To protect the digital records of the **መንጋው [Mengaw]** (The Flock), the **መምህረ ንስሐ [Memihere Niseha]** (Spiritual Father) role shall be protected by mandatory Multi-Factor Authentication (TOTP or SMS-based). This ensures that even if credentials are compromised, the paternal oversight remains secure.
- **NFR-6.1-02: Encryption Standards:**
  - **Data at Rest:** All sensitive data in the local **IndexedDB** and the Cloud Relay (Firebase) shall be encrypted using the **AES-256** standard.
  - **Data in Transit:** All communication between the PWA and the Cloud shall be conducted over **SSL/TLS 1.3** tunnels, ensuring perfect forward secrecy.
- **NFR-6.1-03: Two-Gate Recovery System (ሁለት ደጃፍ):** In accordance with the **ዐጸደ ንስሐ [Atsede Niseha]** operational manual, password recovery shall follow a "Two-Gate" protocol:
  1. **Gate 1:** The user must complete a standard Email/OTP verification.
  2. **Gate 2:** The **መምህረ ንስሐ [Memihere Niseha]** must manually approve the reset request through their administrative dashboard. Access is denied until both spiritual and technical gates are cleared.

### 6.2 Performance & Reliability (አፈጻጸም)

The system must remain resilient in the face of the infrastructure challenges common in **አህጉረ ስብከት [Ahigure Sibket]** (Dioceses).

- **NFR-6.2-01: Low-Bandwidth Optimization:** The application shall achieve a **First Meaningful Paint (FMP)** in less than **2.0 seconds** on a standard 3G connection. This is achieved through aggressive pre-caching of the **ብራና [Biranna]** UI assets by the Service Worker.
- **NFR-6.2-02: Cloud Relay Uptime:** The synchronization layer (Cloud Relay) shall maintain a **99.9% availability** rate.
- **NFR-6.2-03: Offline-First Reliability:** Regardless of cloud availability, the PWA must remain **100% functional** for reading previously cached teachings, managing the **ቀኖና [Qenona]** tracker, and drafting **ምስጢር ማኅደር [Mistir Mahder]** messages.

### 6.3 Usability & Aesthetics (ተደራሽነትና ውበት)

The interface is a digital reflection of the **ቅድስና [Qidisna]** (Holiness) of the service.

- **NFR-6.3-01: ብራና [Biranna] UI Standards:** The visual design must utilize high-resolution parchment/vellum textures and a color palette rooted in traditional manuscripts. Emphasis and titles must utilize **ቀይ ቀለም [Qey Qelem]** (Cinnabar Red) accents.
- **NFR-6.3-02: Ethiopic Typography:** The system shall utilize high-legibility Ethiopic Unicode fonts (e.g., **Abyssinica SIL** or **Nyala**) with a minimum base size of 18px to ensure readability for all users.
- **NFR-6.3-03: Elder-Friendly Interface (አባታዊ በይነገጽ):** Recognizing that many **መምህረ ንስሐ [Memihere Niseha]** may not be digitally native, the navigation must be "Elder-Friendly." This includes large touch targets, simplified linear flows, and clear, non-technical Amharic labels for all administrative actions.

### 6.4 Maintainability (ጥገናና ቀጣይነት)

The platform is designed for a multi-generational spiritual mission.

- **NFR-6.4-01: Architectural Documentation:** The codebase must be comprehensively documented, specifically the logic governing the **ታኅተ ማኅተም [Tahte Mahtem]** (E2EE) and the **ቃል ኪዳን [Qal Kidan]** (Onboarding) modules.
- **NFR-6.4-02: Church-Authorized Handover:** The system shall be built using modular, clean-code principles (Next.js components) to ensure that future Church-authorized developers can maintain the platform without compromising the "Seal of Secrecy" logic or the integrity of the spiritual data.

---

**END OF SECTION 6**

## ፯. Risk Management & Future Scalability (የስጋት አስተዳደርና የወደፊት ዕድገት)

### 7.1 Risk Analysis (የስጋት ትንተና)

The transition of **መንፈሳዊ አባትነት [Menfesawi Abatinet]** (Spiritual Stewardship) into a digital medium necessitates a rigorous evaluation of technical, spiritual, and data-centric risks.

- **RA-7.1-01: Technical Risk (Device Compromise):** The physical loss or theft of a user's mobile device poses a direct threat to the **ታኅተ ማኅተም [Tahte Mahtem]** (Seal of Secrecy).
  - **Mitigation:** The system shall implement a mandatory Biometric (FaceID/Fingerprint) or PIN-code lock specifically for the **የግል ክፍል [Yegil Kifil]** (Private Sanctuary). Furthermore, the architecture shall support a **Remote Wipe** capability, allowing a user to trigger a local **IndexedDB** purge upon their next successful login from a new device.
- **RA-7.1-02: Spiritual Risk (Digital Substitution):** There is a persistent danger that the "Digital Courtyard" may be perceived as a substitute for physical presence in the **ቤተክርስቲያን [Betekristiyan]** (Church).
  - **Mitigation:** To preserve the sanctity of the **ምስጢረ ንስሐ [Mistire Niseha]** (Sacrament of Penance), the UI shall frequently display paternal reminders stating that the application is strictly a **Logistical Aid**. It must be explicitly stated in the **ብራና [Biranna]** reader that the **ቀኖና [Qenona]** check-off and digital counseling are preparatory, and the sacramental absolution is only valid through an in-person, physical encounter with the **መምህረ ንስሐ [Memihere Niseha]**.
- **RA-7.1-03: Metadata Leakage Risk:** While E2EE protects message content, metadata (the frequency and timing of communication between a Father and Child) could potentially be exposed.
  - **Mitigation:** The system shall enforce a "Minimal Metadata" policy. Only essential timestamps required for synchronization shall be stored. Strict **Zero-Knowledge** protocols ensure that the Cloud Relay cannot derive behavioral patterns or link identities outside the encrypted **ቃል ኪዳን [Qal Kidan]** (Covenant) framework.

### 7.2 Mitigation Strategies (የመፍትሔ እርምጃዎች)

Beyond technical encryption, the system provides an ecclesiastical "Safe-Guard" to protect the spiritual integrity of the relationship.

- **MS-7.2-01: The Paternal Kill-Switch:** In the event that a spiritual relationship is compromised or a Child’s account is suspected of being breached, the **መምህረ ንስሐ [Memihere Niseha]** shall have the functional authority to "Revoke the **ቃል ኪዳን [Qal Kidan]**."
- **MS-7.2-02: Immediate Exclusion:** Upon revocation of the Token, the Child’s device is programmatically locked out of all private threads and the **ምስጢር ማኅደር [Mistir Mahder]**. All local encrypted fragments associated with that specific Father are marked for deletion, ensuring the **ታኅተ ማኅተም [Tahte Mahtem]** remains uncompromised.

### 7.3 Future Scalability (የወደፊት ዕድገት)

The **ዐጸደ ንስሐ [Atsede Niseha]** architecture is designed to grow alongside the global mission of the Church.

- **FS-7.3-01: Multi-Tenancy (የዐጸዶች ብዛት):** The architecture is designed for "Courtyard Isolation." Each **መምህረ ንስሐ [Memihere Niseha]** functions as a primary tenant, managing an independent **ዐጸደ [Atsede]**. The system can scale to support thousands of independent Fathers without data cross-contamination, ensuring every shepherd manages his own unique flock within the same global infrastructure.
- **FS-7.3-02: Internationalization & Diaspora Support:** Recognizing the needs of the **ዲያስፖራ [Diaspora]**, future versions shall include localized language toggles (e.g., English, Greek, or French). However, the spiritual core—specifically liturgical headers and primary theological terms—shall remain anchored in **ግዕዝ [Ge'ez]** and **አማርኛ [Amharic]** to maintain the Church's traditional identity.
- **FS-7.3-03: Diocesan Dashboard (አህጉረ ስብከት):** For high-level administration, the system will eventually support a dashboard for the **አህጉረ ስብከት [Ahigure Sibket]** (Dioceses). This module will provide aggregate statistics regarding general participation rates and spiritual education metrics.
  - **Constraint:** This dashboard shall be programmatically restricted to logistical metadata; it will have **zero access** to the contents of the **ምስጢር ማኅደር [Mistir Mahder]** or individual user reflections, upholding the absolute secrecy of the paternal-filial bond.

---

**END OF SECTION 7**

**CONCLUDING NOTE:** This Software Requirements Specification (SRS) for **ዐጸደ ንስሐ [Atsede Niseha]** provides the technical blueprint required to digitize paternal logistics while safeguarding the ancient traditions and the "Seal of Secrecy" of the **የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ ቤተክርስቲያን [Ye-Ityopya Ortodoks Tewahedo Betekristiyan]**.
