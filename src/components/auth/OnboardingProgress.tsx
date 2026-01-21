import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export function OnboardingProgress({ currentStep, totalSteps, stepLabels }: OnboardingProgressProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div key={stepNumber} className="flex items-center">
              {/* Step indicator */}
              <motion.div
                className={`
                  relative flex items-center justify-center w-10 h-10 rounded-full
                  font-mono text-sm font-medium transition-all duration-300
                  ${isCompleted 
                    ? 'bg-primary text-primary-foreground glow-primary' 
                    : isCurrent 
                      ? 'bg-primary/20 text-primary border-2 border-primary' 
                      : 'bg-white/5 text-muted-foreground border border-white/10'
                  }
                `}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  stepNumber
                )}

                {/* Pulse effect for current step */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>

              {/* Connector line */}
              {stepNumber < totalSteps && (
                <div className="w-12 md:w-20 h-[2px] mx-2">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isCompleted ? 'bg-primary' : 'bg-white/10'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      {stepLabels && stepLabels.length === totalSteps && (
        <div className="flex items-center justify-between mt-3">
          {stepLabels.map((label, i) => (
            <div
              key={label}
              className={`text-xs text-center w-20 ${
                i + 1 <= currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
