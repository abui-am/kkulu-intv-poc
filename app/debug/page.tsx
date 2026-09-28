import type { Metadata } from "next";
import { DebugPage } from "@/components/debug/DebugPage";

export const metadata: Metadata = {
  title: "Debug",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DebugPage />;
}
