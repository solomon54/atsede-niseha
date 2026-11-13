import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "atsede_auth_token";
const USER_ROLE_KEY = "atsede_user_role";
const USER_UID_KEY = "atsede_user_uid";

export const authStorage = {
  async saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  async saveUserMeta(role: string, eotcUid?: string): Promise<void> {
    await SecureStore.setItemAsync(USER_ROLE_KEY, role);
    if (eotcUid) {
      await SecureStore.setItemAsync(USER_UID_KEY, eotcUid);
    }
  },

  async getUserMeta(): Promise<{ role: string | null; eotcUid: string | null }> {
    const role = await SecureStore.getItemAsync(USER_ROLE_KEY);
    const eotcUid = await SecureStore.getItemAsync(USER_UID_KEY);
    return { role, eotcUid };
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ROLE_KEY);
    await SecureStore.deleteItemAsync(USER_UID_KEY);
  },
};

