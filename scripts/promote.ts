// scripts/promote.ts
import { adminAuth } from "../src/services/firebase/admin";

// ⚠️ ማሳሰቢያ፡ ይህንን ኢሜል በራስህ ኢሜል ተካው
const emailToPromote = "solomontsehay50@gmail.com";

async function runPromotion() {
  try {
    console.log(`🔍 Searching for user: ${emailToPromote}...`);

    // 1. ተጠቃሚውን መፈለግ
    const user = await adminAuth.getUserByEmail(emailToPromote);

    // 2. የነበሩትን Claims እንዳይጠፉ ማዋሃድ (Senior Review suggestion)
    const existingClaims = user.customClaims || {};

    // 3. የGovernor ስልጣንን ማተም
    await adminAuth.setCustomUserClaims(user.uid, {
      ...existingClaims,
      role: "GOVERNOR",
    });

    console.log("--------------------------------------------------");
    console.log(`✅ SUCCESS: ${emailToPromote} is now the System Governor.`);
    console.log(`🆔 UID: ${user.uid}`);
    console.log(`⚠️  IMPORTANT: Logout and Login again to refresh your token!`);
    console.log("--------------------------------------------------");
  } catch (error) {
    console.error("❌ Promotion failed:");
    if (error instanceof Error) {
      console.error(`   Error Message: ${error.message}`);
    }
    console.log(
      "\n💡 Tip: Make sure the user is already registered in Firebase Auth."
    );
  }
}

runPromotion();
