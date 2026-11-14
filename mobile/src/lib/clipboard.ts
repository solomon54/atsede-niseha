// mobile/src/lib/clipboard.ts
import { Alert, Share } from "react-native";

export async function copyToClipboard(text: string, label = "መለያ ቁጥር"): Promise<boolean> {
  try {
    if (typeof globalThis.navigator?.clipboard?.writeText === "function") {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback
  }

  try {
    // In React Native without expo-clipboard, Share dialog allows instant copying or sharing
    await Share.share({
      message: text,
      title: label,
    });
    return true;
  } catch {
    Alert.alert(label, text);
    return false;
  }
}

