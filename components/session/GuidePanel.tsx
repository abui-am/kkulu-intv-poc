"use client";

export function GuidePanel({
  heading,
  body,
  compact = false,
}: {
  heading: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <section
      aria-label="Current task guide"
      aria-live="polite"
      className={compact
        ? "rounded-lg border border-teal-700/60 bg-teal-950/60 p-3 text-white"
        : "rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-950"}
    >
      <h2 className="text-sm font-semibold leading-5">{heading}</h2>
      <p className="mt-1 text-sm font-medium leading-6">{body}</p>
    </section>
  );
}
