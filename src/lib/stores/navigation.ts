export type Page = "skills" | "settings" | "templates" | "memory";

export interface NavItem {
  id: Page;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "skills", label: "Skills & Agents", icon: "sparkles" },
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "templates", label: "Templates", icon: "templates" },
  { id: "memory", label: "Memory", icon: "brain" },
];
