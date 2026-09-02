"use client"

import { Switch } from "./ui/switch"
import { FlaskConical, AlertCircle } from "lucide-react"
import { useConfig } from "@/contexts/ConfigContext"
import {
  BetaFeatureKey,
  BETA_FEATURE_NAMES,
  BETA_FEATURE_DESCRIPTIONS
} from "@/types/betaFeatures"

export function BetaSettings() {
  const { betaFeatures, toggleBetaFeature } = useConfig();

  // Define feature order for display (allows custom ordering)
  const featureOrder: BetaFeatureKey[] = ['importAndRetranscribe'];

  return (
    <div className="space-y-4 pt-6 text-[var(--pt-text)]">
      {/* Yellow Warning Banner */}
      <div className="flex items-start gap-3 border border-[var(--pt-border)] border-l-2 border-l-[var(--pt-warning)] bg-[var(--pt-warning-wash)] p-4 [border-radius:3px]">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--pt-warning)]" aria-hidden="true" />
        <div className="text-sm text-[var(--pt-text-secondary)]">
          <p className="font-medium text-[var(--pt-text)]">Beta features</p>
          <p className="mt-1">
            These features are still being tested. You may encounter issues, and we appreciate your feedback.
          </p>
        </div>
      </div>

      {/* Dynamic Feature Toggles - Automatically renders all features */}
      {featureOrder.map((featureKey) => (
        <div
          key={featureKey}
          className="border border-[var(--pt-border)] bg-[var(--pt-surface)] p-6 [border-radius:3px]"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-[18px] w-[18px] text-[var(--pt-accent)]" aria-hidden="true" />
                <h3 className="text-lg font-medium">
                  {BETA_FEATURE_NAMES[featureKey]}
                </h3>
                <span className="border border-[var(--pt-border-strong)] bg-[var(--pt-surface-alt)] px-2 py-0.5 text-xs font-medium text-[var(--pt-text-secondary)] [border-radius:2px]">
                  Beta
                </span>
              </div>
              <p className="text-sm text-[var(--pt-text-secondary)]">
                {BETA_FEATURE_DESCRIPTIONS[featureKey]}
              </p>
            </div>

            <div className="ml-6">
              <Switch
                checked={betaFeatures[featureKey]}
                onCheckedChange={(checked) => toggleBetaFeature(featureKey, checked)}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Info Box */}
      <div className="border-l-2 border-[var(--pt-accent)] bg-[var(--pt-accent-wash)] p-4 [border-radius:3px]">
        <p className="text-sm text-[var(--pt-text-secondary)]">
          Disabled beta features stay hidden. Existing meetings remain unchanged.
        </p>
      </div>
    </div>
  );
}
