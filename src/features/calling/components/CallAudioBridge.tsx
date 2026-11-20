// src/features/calling/components/CallAudioBridge.tsx
"use client";

import React, { useEffect, useMemo, useRef } from "react";

import type { CallParticipantView } from "../types";

/**
 * Keeps remote audio attached even while the user is on another page. LiveKit
 * only produces sound while a track is attached to a media element.
 */
export function CallAudioBridge({ participants }: { participants: CallParticipantView[] }) {
  const remote = useMemo(
    () => participants.filter((p) => !p.isLocal && p.audioTrack),
    [participants]
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const elements = Array.from(container.querySelectorAll<HTMLAudioElement>("audio"));
    const cleanups: Array<() => void> = [];
    remote.forEach((participant) => {
      const element = elements.find(
        (candidate) => candidate.dataset.callAudio === participant.identity
      );
      if (!element) return;
      try {
        participant.audioTrack?.attach(element);
        cleanups.push(() => {
          try { participant.audioTrack?.detach(element); } catch {}
        });
      } catch {}
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [remote]);

  return (
    <div ref={containerRef} aria-hidden="true" className="hidden">
      {remote.map((participant) => (
        <audio
          key={participant.identity}
          data-call-audio={participant.identity}
          autoPlay
          playsInline
        />
      ))}
    </div>
  );
}
