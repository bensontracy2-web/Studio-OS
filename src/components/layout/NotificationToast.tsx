import React from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import type { StudioNotification } from "../../types/studio";

interface NotificationToastProps {
  toasts: StudioNotification[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-[126px] lg:bottom-20 right-4 lg:right-6 z-40 flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.severity === "success"
            ? CheckCircle2
            : toast.severity === "warning"
            ? AlertTriangle
            : Info;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-3.5 shadow-lg transition-all duration-200"
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${toast.accentColor}22`,
                color: toast.accentColor,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC]">
                {toast.title}
              </p>
              <p className="mt-0.5 text-xs text-[#5C5750] dark:text-[#A69F96] leading-snug">
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss alert"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8C857B] hover:text-[#1E1E1E] dark:hover:text-[#F5F2EC]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
