import type { ReactNode } from "react";
import Modal from "./Modal";

interface Props {
  open: boolean;
  title: string;
  content: ReactNode;
  onClose: () => void;
}

export default function InfoDialog({ open, title, content, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-sm text-text-primary leading-relaxed">
        {content}
      </div>
    </Modal>
  );
}
