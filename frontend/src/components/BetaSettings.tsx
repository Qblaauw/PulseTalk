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
    <div className="flex flex-col gap-4">
      {/* Warning Banner */}
      <div className="flex items-start gap-3 rounded-[var(--pt-radius)] border border-[var(--pt-border)] bg-[var(--pt-warning-wash)] p-4">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[var(--pt-warning)]" />
        <div className="text-sm text-[var(--pt-text)]">
          <p className="font-medium">Beta features</p>
          <p className="mt-1 text-[var(--pt-text-secondary)]">
            These features are still being tested. You may encounter issues, and we appreciate your feedback.
          </p>
        </div>
      </div>

      {/* Dynamic Feature Toggles - Automatically renders all features */}
      <div className="pt-group">
        {featureOrder.map((featureKey) => (
          <div key={featureKey} className="pt-row">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-[var(--pt-text-secondary)]" />
                <h3 className="font-medium text-[var(--pt-text)]">
                  {BETA_FEATURE_NAMES[featureKey]}
                </h3>
                <span className="pt-badge pt-badge--warning">BETA</span>
              </div>
              <p className="text-sm text-[var(--pt-text-secondary)]">
                {BETA_FEATURE_DESCRIPTIONS[featureKey]}
              </p>
            </div>

            <Switch
              checked={betaFeatures[featureKey]}
              onCheckedChange={(checked) => toggleBetaFeature(featureKey, checked)}
            />
          </div>
        ))}
      </div>

      {/* Info Box */}
      <p className="text-xs text-[var(--pt-text-tertiary)]">
        When disabled, beta features are hidden. Your existing meetings remain unaffected.
      </p>
    </div>
  );
}
