//src/features/auth/services/auth.service.ts
import {
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

    // Token-ኑን ከFirebase አምጣ
    const idToken = await credential.user.getIdToken();

    // 🍪 Token-ኑን ለMiddleware እንዲታይ Cookie ውስጥ ቅበር
    // Production ላይ 'Secure' መጨመር ይኖርበታል
    document.cookie = `session_token=${idToken}; path=/; max-age=3600; SameSite=Lax`;

    return credential;
  },

  /**
   * ሲስተሙን ለቆ መውጣት
   */
  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
    // Cookie-ውን አጥፋ
    document.cookie =
      "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  },
};
