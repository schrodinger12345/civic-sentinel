import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const ConsoleHeader = () => {
  const [time, setTime] = useState(new Date());
  const [latency, setLatency] = useState(42);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setLatency(Math.floor(Math.random() * 30) + 35);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel px-6 py-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-foreground">
          CIVICFIX CORE // AGENT_MONITOR v1.0
        </span>
        <span className="w-2 h-4 bg-primary animate-cursor" />
      </div>

      <div className="flex items-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">UTC</span>
          <span className="text-foreground">
            {time.toISOString().substring(11, 19)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">API Latency</span>
          <span className="text-primary">{latency}ms</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">System Health:</span>
          <span className="text-success">STABLE</span>
          <div className="status-dot status-dot-success" />
        </div>
      </div>
    </motion.div>
  );
};
