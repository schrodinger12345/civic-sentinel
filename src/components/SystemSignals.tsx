import { motion } from "framer-motion";
import { Brain, Clock, AlertTriangle } from "lucide-react";

const signals = [
  {
    icon: Brain,
    title: "AI assigns severity & responsibility",
    description: "Intelligent classification of every complaint",
  },
  {
    icon: Clock,
    title: "Live SLA tracking with pressure",
    description: "Real-time countdown and escalation triggers",
  },
  {
    icon: AlertTriangle,
    title: "Automatic escalation on inaction",
    description: "No complaint left behind",
  },
];

export const SystemSignals = () => {
  return (
    <div className="space-y-6">
      {signals.map((signal, index) => (
        <motion.div
          key={signal.title}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 + index * 0.15, duration: 0.5 }}
          className="flex items-start gap-4 group"
        >
          <div className="relative mt-1">
            <div className="status-dot status-dot-pulse status-dot-primary" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <signal.icon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">
                {signal.title}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground pl-7">
              {signal.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
