import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAug-K9V11-4bMiiyfxw1O3crhClDViWJI",
  authDomain: "atsede-niseha.firebaseapp.com",
  projectId: "atsede-niseha",
  storageBucket: "atsede-niseha.firebasestorage.app",
  messagingSenderId: "543261831846",
  appId: "1:543261831846:web:417d137a61c2d9ce677a67",
  measurementId: "G-ZZMX1JVERV",
};

// Initialize Firebase for SSR (Server Side Rendering) compatibility
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Export instances with clean names
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
