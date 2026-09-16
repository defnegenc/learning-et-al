import { NoiseOverlay } from "@/components/noise-overlay";
import { SiteHeader, SURFACE } from "@/components/design-system";
import RunThePaper from "@/components/run-the-paper";

export const metadata = {
  title: "Run the paper",
  description:
    "A prototype: turn a research paper's runnable method into a validated, callable tool.",
};

/**
 * Standalone prototype path for the Paper2Agent concept - deliberately
 * separate from the five-minute reading flow, unlocked only at its own URL.
 */
export default function RunThePaperPage() {
  return (
    <div className="relative min-h-screen" style={{ background: SURFACE }}>
      <NoiseOverlay />
      <SiteHeader />
      <main
        className="relative z-10 px-4 md:px-8 pt-8 md:pt-12 pb-20"
        style={{ maxWidth: 760, margin: "0 auto" }}
      >
        <RunThePaper />
      </main>
    </div>
  );
}
