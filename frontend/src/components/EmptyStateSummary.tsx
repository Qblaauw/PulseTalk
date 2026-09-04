'use client';

import { motion } from 'framer-motion';
import { FileQuestion, Sparkles } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EmptyStateSummaryProps {
  onGenerate: () => void;
  hasModel: boolean;
  isGenerating?: boolean;
}

export function EmptyStateSummary({ onGenerate, hasModel, isGenerating = false }: EmptyStateSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center h-full p-8 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--pt-fill)]">
        <FileQuestion className="h-8 w-8 text-[var(--pt-text-tertiary)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--pt-text)] mb-2">
        No summary yet
      </h3>
      <p className="text-sm text-[var(--pt-text-secondary)] mb-6 max-w-md">
        Generate a summary of this transcript to get key points, action items, and decisions.
      </p>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <button
                onClick={onGenerate}
                disabled={!hasModel || isGenerating}
                className="pt-button pt-button--accent gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? 'Generating…' : 'Generate summary'}
              </button>
            </div>
          </TooltipTrigger>
          {!hasModel && (
            <TooltipContent>
              <p>Select a model in Settings first</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {!hasModel && (
        <p className="text-xs text-[var(--pt-text-tertiary)] mt-3">
          Select a model in Settings first
        </p>
      )}
    </motion.div>
  );
}
