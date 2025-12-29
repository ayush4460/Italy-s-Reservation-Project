import { LoaderSpinner } from "@/components/ui/loader-spinner";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <LoaderSpinner variant="triangle" />
    </div>
  );
}
