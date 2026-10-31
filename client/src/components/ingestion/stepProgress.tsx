import ProgressBar from "@/components/ui/progressBar";

// "Step 2 of 3" + bar for the import flow: 1 upload, 2 choose the pages / lessons, 3 review.
export default function StepProgress({ step, second }: { step: 1 | 2 | 3; second: string }) {
  const label = ["Upload the document", second, "Review and add"][step - 1];
  return (
    <div role="group" aria-label="Import progress" className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">Step {step} of 3 · {label}</p>
      <ProgressBar current={step} total={3} showLabel={false} showPercent={false} />
    </div>
  );
}
