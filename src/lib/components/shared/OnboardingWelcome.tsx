import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { type Page } from "$lib/stores/navigation";
import {
  Settings,
  LayoutTemplate,
  Brain,
  Sparkles,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import logoUrl from "$lib/assets/logo.png";

interface OnboardingStep {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
  action: string;
  page: Page;
}

const steps: OnboardingStep[] = [
  {
    icon: Sparkles,
    title: "Manage Skills",
    description:
      "Create and edit reusable skills, then sync them across the agents you use. Skills are the heart of the app.",
    action: "Open Skills",
    page: "skills",
  },
  {
    icon: Settings,
    title: "Configure Settings",
    description:
      "Set your preferred model, effort level, and permissions. Settings are read from and written to the same files your agents use.",
    action: "Open Settings",
    page: "settings",
  },
  {
    icon: LayoutTemplate,
    title: "Browse Templates",
    description:
      "Start from pre-built skill templates instead of writing from scratch. One click to add.",
    action: "Open Templates",
    page: "templates",
  },
  {
    icon: Brain,
    title: "Review Memory",
    description:
      "Browse and edit project memory files that give your agents persistent context.",
    action: "Open Memory",
    page: "memory",
  },
];

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const onboarded = localStorage.getItem("felina-onboarded");
    if (!onboarded) setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem("felina-onboarded", "true");
  }

  function goTo(page: Page) {
    dismiss();
    navigate(`/${page}`);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center">
      <div className="w-[640px] max-h-[85vh] bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 text-center border-b border-border">
          <button
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            onClick={dismiss}
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <img
            src={logoUrl}
            alt="Felina"
            className="w-16 h-16 rounded-2xl mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-text-primary">
            Welcome to Felina
          </h1>
          <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
            The desktop app for managing Claude Code. Everything runs locally —
            no accounts, no servers, no telemetry.
          </p>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
            Get started
          </p>
          <div className="space-y-3">
            {steps.map((s, i) => {
              const StepIcon = s.icon;
              return (
                <div
                  key={i}
                  className={`group flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    step === i
                      ? "border-accent/40 bg-accent/5"
                      : "border-border hover:border-border-light hover:bg-bg-hover"
                  }`}
                  onClick={() => setStep(i)}
                  onKeyDown={(e) => e.key === "Enter" && setStep(i)}
                  role="button"
                  tabIndex={0}
                >
                  <span
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      step === i
                        ? "bg-accent/20 text-accent"
                        : "bg-bg-tertiary text-text-muted group-hover:text-text-secondary"
                    }`}
                  >
                    <StepIcon size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {s.title}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                      {s.description}
                    </p>
                  </div>
                  <button
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      step === i
                        ? "bg-accent text-white hover:bg-accent-hover"
                        : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(s.page);
                    }}
                  >
                    {s.action}
                    <ArrowRight size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-text-muted">
            You can revisit this anytime from the About dialog
          </p>
          <button
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
            onClick={dismiss}
          >
            <Check size={14} />
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
