export type Page = "skills" | "settings" | "tokens" | "templates" | "memory";

export interface NavItem {
  id: Page;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "skills", label: "Skills & Agents", icon: "sparkles" },
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "templates", label: "Templates", icon: "templates" },
  { id: "tokens", label: "Tokens", icon: "tokens" },
  { id: "memory", label: "Memory", icon: "brain" },
];
