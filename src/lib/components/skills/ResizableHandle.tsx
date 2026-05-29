import { Separator } from "react-resizable-panels";

export default function ResizableHandle() {
  return (
    <Separator className="group relative w-1.5 shrink-0 flex items-center justify-center">
      <div className="absolute inset-y-0 w-px bg-border group-hover:w-1 group-hover:bg-accent group-data-[resize-handle-active]:w-1 group-data-[resize-handle-active]:bg-accent transition-all" />
    </Separator>
  );
}
