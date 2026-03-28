// src/features/auth/services/auth.service.ts
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  UserCredential,
} from "firebase/auth";

import { auth } from "@/services/firebase/client";

export const authService = {
  /**
   * ተጠቃሚን በኢሜል እና በፓስዎርድ ማስገባት
   */
  async signIn(email: string, pass: string): Promise<UserCredential> {
    const credential = await signInWithEmailAndPassword(auth, email, pass);
    const idToken = await credential.user.getIdToken(true); // 'true' forces a refresh to pick up GOVERNOR claims

    // 🍪 Token-ኑን ለMiddleware እንዲታይ Cookie ውስጥ ቅበር
    document.cookie = `session_token=${idToken}; path=/; max-age=3600; SameSite=Lax`;

    return credential;
  },

  /**
   * THE MISSING LINK: Listen to Token Changes
   * This prevents the "not a function" error and keeps the Governor authorized.
   */
  listenToTokenRefresh() {
    return onIdTokenChanged(auth, async (user) => {
      if (user) {
        const idToken = await user.getIdToken();
        document.cookie = `session_token=${idToken}; path=/; max-age=3600; SameSite=Lax`;
      } else {
        document.cookie =
          "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
    });
  },

  /**
   * ሲስተሙን ለቆ መውጣት
   */
  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
    document.cookie =
      "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  },
};
