import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Page = "skills" | "projects" | "tokens" | "memory" | "history";

export interface NavItem {
  id: Page;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "skills", label: "Skills", icon: "sparkles" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "tokens", label: "Tokens", icon: "tokens" },
  { id: "memory", label: "Memory", icon: "brain" },
  { id: "history", label: "History", icon: "history" },
];

export function getMergedNavItems(customOrder: string[] | null): NavItem[] {
  if (!customOrder) return NAV_ITEMS;

  const navMap = new Map(NAV_ITEMS.map((item) => [item.id, item]));
  const merged: NavItem[] = [];

  for (const id of customOrder) {
    const item = navMap.get(id as Page);
    if (item) {
      merged.push(item);
      navMap.delete(id as Page);
    }
  }

  for (const item of navMap.values()) {
    merged.push(item);
  }

  return merged;
}

interface NavigationState {
  customOrder: string[] | null;
  collapsed: boolean;
  setCustomOrder: (order: string[]) => void;
  toggleCollapsed: () => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      customOrder: null,
      collapsed: false,
      setCustomOrder: (order) => set({ customOrder: order }),
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: "felina-sidebar-order" },
  ),
);
