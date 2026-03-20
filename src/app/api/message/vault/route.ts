// //src/app/api/message/vault/route.ts

// import { NextResponse } from "next/server";

// import { adminDb } from "@/services/firebase/admin";

// const VAULT_COLLECTION = "FamilyKeys";

// // GET: Retrieve existing key for the family
// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const familyId = searchParams.get("familyId");

//   if (!familyId)
//     return NextResponse.json({ error: "Missing familyId" }, { status: 400 });

//   try {
//     const doc = await adminDb.collection(VAULT_COLLECTION).doc(familyId).get();

//     if (!doc.exists) {
//       return NextResponse.json({ exists: false });
//     }

//     return NextResponse.json({ exists: true, ...doc.data() });
//   } catch (error) {
//     return NextResponse.json({ error: "Vault access failed" }, { status: 500 });
//   }
// }

// // POST: Store the first-generated key
// export async function POST(request: Request) {
//   try {
//     const { familyId, encryptedKey } = await request.json();

//     if (!familyId || !encryptedKey) {
//       return NextResponse.json(
//         { error: "Incomplete payload" },
//         { status: 400 }
//       );
//     }

//     // Security: Use { merge: false } to prevent overwriting an existing key
//     // unless you add specific "Rotate Key" logic later.
//     await adminDb.collection(VAULT_COLLECTION).doc(familyId).set(
//       {
//         encryptedKey,
//         createdAt: Date.now(),
//       },
//       { merge: true }
//     );

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     return NextResponse.json({ error: "Vault write failed" }, { status: 500 });
//   }
// }
