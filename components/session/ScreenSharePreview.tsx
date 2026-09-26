"use client";

import { useEffect, useRef, type RefObject } from "react";

export function ScreenSharePreview({
  active,
  videoRef,
}: {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (localRef.current) videoRef.current = localRef.current;
  }, [videoRef]);

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <video ref={localRef} autoPlay muted playsInline className={`aspect-video w-full ${active ? "" : "hidden"}`} />
      {!active && (
        <figcaption className="px-4 py-10 text-center text-sm text-slate-300">
          Share the sandbox window. This preview is only for you.
        </figcaption>
      )}
    </figure>
  );
}
