// src/services/firebase/admin.ts
import "server-only";

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";

const requiredEnv = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

requiredEnv.forEach((key) => {
  if (!process.env[key])
    throw new Error(`Missing environment variable: ${key}`);
});

let app: App;

if (!getApps().length) {
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
} else {
  app = getApps()[0]!;
}

export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
