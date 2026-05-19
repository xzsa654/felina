import { Loader2 } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <Loader2 size={32} className="animate-spin text-text-muted" />
    </div>
  );
}
