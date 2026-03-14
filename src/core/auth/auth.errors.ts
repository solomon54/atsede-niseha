// src/core/auth/auth.errors.ts

import { ZodError } from "zod";

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "AuthError";
  }
}

/**
 * Type Guard for Firebase-like error objects
 */
interface FirebaseError {
  code: string;
  message: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as any).code === "string"
  );
}

export function mapAuthError(error: unknown) {
  // 1. Handled AuthErrors (thrown manually in login.service)
  if (error instanceof AuthError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      status: error.status,
    };
  }

  // 2. Zod Validation Errors (Schema mismatch)
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    let message = "የመረጃ ስህተት ተገኝቷል።";

    if (firstIssue.path.includes("password")) {
      message = "የይለፍ ቃል ቢያንስ ፰ ፊደላት መሆን አለበት።";
    } else if (firstIssue.path.includes("eotcUid")) {
      message = "የመለያ ቁጥሩ ትክክል አይደለም።";
    }

    return {
      success: false,
      error: message,
      code: "VALIDATION_ERROR",
      status: 400,
    };
  }

  // 3. Firebase / External Auth Errors
  if (isFirebaseError(error)) {
    switch (error.code) {
      case "auth/email-already-exists":
        return {
          success: false,
          error: "ይህ ኢሜይል ቀድሞ ተመዝግቧል",
          code: "EMAIL_EXISTS",
          status: 400,
        };
      case "auth/user-not-found":
      case "auth/wrong-password":
        return {
          success: false,
          error: "የይለፍ ቃል ወይም መለያው ስህተት ነው",
          code: "INVALID_CREDENTIALS",
          status: 401,
        };
    }
  }

  // 4. Fallback for unexpected crashes
  console.error("UNHANDLED AUTH CRASH:", error);
  return {
    success: false,
    error: "የውስጥ ሲስተም ስህተት። እባክዎ ቆይተው ይሞክሩ።",
    code: "SERVER_ERROR",
    status: 500,
  };
}
