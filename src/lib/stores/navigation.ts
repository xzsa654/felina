export type Page = "skills" | "projects" | "settings" | "tokens" | "templates" | "memory" | "history";

export interface NavItem {
  id: Page;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "skills", label: "Skills", icon: "sparkles" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "templates", label: "Templates", icon: "templates" },
  { id: "tokens", label: "Tokens", icon: "tokens" },
  { id: "memory", label: "Memory", icon: "brain" },
  { id: "history", label: "History", icon: "history" },
];
