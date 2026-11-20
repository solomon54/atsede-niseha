import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "atsede_auth_token";
const USER_ROLE_KEY = "atsede_user_role";
const USER_UID_KEY = "atsede_user_uid";
// Firebase Auth uid — distinct from the human-readable EOTC uid. Chat uses it
// to identify the current sender because Firestore stores Firebase uids.
const FIREBASE_UID_KEY = "atsede_firebase_uid";
const FAMILY_ID_KEY = "atsede_family_id";
const FCM_TOKEN_KEY = "atsede_fcm_token";

export const authStorage = {
  async saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  async saveUserMeta(
    role: string,
    eotcUid?: string,
    firebaseUid?: string,
    familyId?: string
  ): Promise<void> {
    await SecureStore.setItemAsync(USER_ROLE_KEY, role);

    // Optional identity fields must be written deterministically. Leaving an
    // old value behind when a login/claim response omits it can hydrate the
    // next session with the previous account's uid or familyId.
    if (eotcUid) {
      await SecureStore.setItemAsync(USER_UID_KEY, eotcUid);
    } else {
      await SecureStore.deleteItemAsync(USER_UID_KEY);
    }
    if (firebaseUid) {
      await SecureStore.setItemAsync(FIREBASE_UID_KEY, firebaseUid);
    } else {
      await SecureStore.deleteItemAsync(FIREBASE_UID_KEY);
    }
    if (familyId) {
      await SecureStore.setItemAsync(FAMILY_ID_KEY, familyId);
    } else {
      await SecureStore.deleteItemAsync(FAMILY_ID_KEY);
    }
  },

  async getUserMeta(): Promise<{
    role: string | null;
    eotcUid: string | null;
    uid: string | null;
    familyId: string | null;
  }> {
    const [role, eotcUid, uid, familyId] = await Promise.all([
      SecureStore.getItemAsync(USER_ROLE_KEY),
      SecureStore.getItemAsync(USER_UID_KEY),
      SecureStore.getItemAsync(FIREBASE_UID_KEY),
      SecureStore.getItemAsync(FAMILY_ID_KEY),
    ]);
    return { role, eotcUid, uid, familyId };
  },

  /** Device-scoped FCM token; kept so logout can unregister only this device. */
  async saveFcmToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(FCM_TOKEN_KEY, token);
  },

  async getFcmToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(FCM_TOKEN_KEY);
  },

  async clearFcmToken(): Promise<void> {
    await SecureStore.deleteItemAsync(FCM_TOKEN_KEY);
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_ROLE_KEY),
      SecureStore.deleteItemAsync(USER_UID_KEY),
      SecureStore.deleteItemAsync(FIREBASE_UID_KEY),
      SecureStore.deleteItemAsync(FAMILY_ID_KEY),
      SecureStore.deleteItemAsync(FCM_TOKEN_KEY),
    ]);
  },
};
