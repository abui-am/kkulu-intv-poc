"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export function ScreenSharePreview({
  active,
  videoRef,
}: {
  active: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const [previewClicked, setPreviewClicked] = useState(false);
  useEffect(() => {
    if (localRef.current) videoRef.current = localRef.current;
  }, [videoRef]);

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <video
        ref={localRef}
        autoPlay
        muted
        playsInline
        onClick={() => setPreviewClicked(true)}
        className={`aspect-video w-full ${active ? "" : "hidden"}`}
      />
      {active && (
        <figcaption className={`px-4 py-2 text-xs ${previewClicked ? "bg-amber-100 text-amber-950" : "text-slate-300"}`}>
          {previewClicked
            ? "This preview cannot be clicked. Use the product on the left."
            : "Live preview only. Click controls in the product."}
        </figcaption>
      )}
      {!active && (
        <figcaption className="px-4 py-10 text-center text-sm text-slate-300">
          Start the session to capture this tab. This preview is only for you.
        </figcaption>
      )}
    </figure>
  );
}
