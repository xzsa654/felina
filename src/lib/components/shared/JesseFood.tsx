import type {
  ComponentPropsWithoutRef,
  DragEvent,
  ElementType,
  ReactNode,
} from "react";
import type { JesseContextPayload } from "$lib/types";
import {
  buildJesseContextDragData,
  setJesseContextDragData,
} from "$lib/components/tokens/jesse-context";

type JesseFoodOwnProps<T extends ElementType> = {
  /** Context handed to Jesse when this item is dropped. Null disables dragging. */
  payload: JesseContextPayload | null;
  /** Short label used for the drag ghost image. */
  label: string;
  /** Element to render as. Defaults to a div so the item root stays a single node. */
  as?: T;
  className?: string;
  children: ReactNode;
};

type JesseFoodProps<T extends ElementType> = JesseFoodOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof JesseFoodOwnProps<T>>;

/**
 * Makes any element draggable "food" for the global Jesse assistant. Render it
 * AS the item's root (via `as`) so no extra DOM node is introduced.
 */
export default function JesseFood<T extends ElementType = "div">({
  payload,
  label,
  as,
  className,
  children,
  ...rest
}: JesseFoodProps<T>) {
  // Cast to any: a polymorphic tag variable resolves its props to `never`.
  // Call-site props stay type-checked through JesseFoodProps<T>.
  const Tag = (as ?? "div") as unknown as (props: Record<string, unknown>) => ReactNode;

  if (!payload) {
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }

  const dragData = buildJesseContextDragData(payload);
  return (
    <Tag
      {...rest}
      draggable
      onDragStart={(event: DragEvent<HTMLElement>) =>
        setJesseContextDragData(event.dataTransfer, dragData, label)
      }
      className={className}
      title="Drag to Jesse"
    >
      {children}
    </Tag>
  );
}
