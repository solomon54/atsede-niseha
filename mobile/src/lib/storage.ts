import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "atsede_auth_token";
const USER_ROLE_KEY = "atsede_user_role";
const USER_UID_KEY = "atsede_user_uid";
// Firebase Auth uid — distinct from the human-readable EOTC uid. Chat uses it
// to identify the current sender because Firestore stores Firebase uids.
const FIREBASE_UID_KEY = "atsede_firebase_uid";
const FAMILY_ID_KEY = "atsede_family_id";

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
    if (eotcUid) {
      await SecureStore.setItemAsync(USER_UID_KEY, eotcUid);
    }
    if (firebaseUid) {
      await SecureStore.setItemAsync(FIREBASE_UID_KEY, firebaseUid);
    }
    if (familyId) {
      await SecureStore.setItemAsync(FAMILY_ID_KEY, familyId);
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

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_ROLE_KEY),
      SecureStore.deleteItemAsync(USER_UID_KEY),
      SecureStore.deleteItemAsync(FIREBASE_UID_KEY),
      SecureStore.deleteItemAsync(FAMILY_ID_KEY),
    ]);
  },
};
