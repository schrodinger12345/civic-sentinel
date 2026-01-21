import { motion } from "framer-motion";

export const ReasoningNode = () => {
  return (
    <div className="glass-panel-dark h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Active Reasoning Node
        </h3>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Input */}
        <div>
          <span className="text-xs text-muted-foreground font-mono uppercase">
            Input:
          </span>
          <div className="mt-2 p-3 bg-background/50 rounded-lg border border-white/5">
            <p className="text-sm text-foreground/90 italic">
              "Garbage piling near hospital gate"
            </p>
          </div>
        </div>

        {/* Process - Waveform */}
        <div>
          <span className="text-xs text-muted-foreground font-mono uppercase">
            Process:
          </span>
          <div className="mt-2 flex items-center justify-center gap-1 h-12">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-1 bg-primary rounded-full ${
                  i % 5 === 0 ? "animate-waveform" :
                  i % 5 === 1 ? "animate-waveform-delay-1" :
                  i % 5 === 2 ? "animate-waveform-delay-2" :
                  i % 5 === 3 ? "animate-waveform-delay-3" :
                  "animate-waveform-delay-4"
                }`}
                style={{
                  height: `${20 + Math.random() * 20}px`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Output */}
        <div>
          <span className="text-xs text-muted-foreground font-mono uppercase">
            Output:
          </span>
          <div className="mt-2 terminal-panel p-3">
            <pre className="text-xs text-primary leading-relaxed">
{`{
  "severity": "CRITICAL",
  "action": "ESCALATE",
  "sla_hours": 12
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
