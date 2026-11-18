import React, { useState } from "react";
import { DownloadCloud, X } from "lucide-react";
import { usePWAInstall } from "../../hooks/usePWAInstall";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Install StudioOS as a standalone app"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1E1E] dark:bg-[#FACC15] px-3 text-xs font-semibold text-[#FAF7F2] dark:text-[#1E1E1E] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
      >
        <DownloadCloud className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] px-2.5 text-xs font-semibold text-[#1E1E1E] dark:text-[#F5F2EC] whitespace-nowrap shrink-0"
        >
          <DownloadCloud className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-[#E8E2D8] dark:border-[#322E29] bg-[#FFFFFF] dark:bg-[#22201D] p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-base font-bold text-[#1E1E1E] dark:text-[#F5F2EC]">
                  Install StudioOS on iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close iOS install guide"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E685F]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs sm:text-sm text-[#5C5750] dark:text-[#A69F96] leading-relaxed">
                1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 h-9 w-full rounded-xl bg-[#1E1E1E] dark:bg-[#F5F2EC] text-xs font-semibold text-[#FAF7F2] dark:text-[#1E1E1E]"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
