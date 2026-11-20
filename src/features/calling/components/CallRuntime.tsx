// src/features/calling/components/CallRuntime.tsx
"use client";

import React from "react";

import { GlobalIncomingCallOverlay } from "@/shared/components/calling/GlobalIncomingCallOverlay";

import { useCall } from "../callProvider";
import { CallAudioBridge } from "./CallAudioBridge";
import { MiniCallIndicator } from "./MiniCallIndicator";

/** Global call UI mounted once, outside any single page. */
export function CallRuntime() {
  const { participants } = useCall();
  return (
    <>
      <CallAudioBridge participants={participants} />
      <MiniCallIndicator />
      <GlobalIncomingCallOverlay />
    </>
  );
}
