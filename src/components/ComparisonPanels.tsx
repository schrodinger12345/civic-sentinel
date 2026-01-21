import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const ComparisonPanels = () => {
  const [countdown, setCountdown] = useState({ hours: 2, minutes: 47, seconds: 33 });
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    "Analyzing complaint...",
    "SLA Timer: Active",
    "Pressure level: MODERATE",
    "System intervened due to inactivity.",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        let { hours, minutes, seconds } = prev;
        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
          if (minutes < 0) {
            minutes = 59;
            hours--;
            if (hours < 0) {
              hours = 23;
            }
          }
        }
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const statusTimer = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 3000);
    return () => clearInterval(statusTimer);
  }, []);

  const formatTime = (n: number) => n.toString().padStart(2, "0");

  return (
    <section className="py-24 px-6">
      <div className="container mx-auto max-w-6xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-semibold text-center mb-16"
        >
          Traditional Systems vs. <span className="text-primary text-glow-primary">CivicFix AI</span>
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Traditional System Panel */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-panel p-8 relative overflow-hidden opacity-60"
          >
            <div className="absolute top-4 right-4">
              <div className="status-dot bg-muted-foreground/30" />
            </div>

            <h3 className="text-lg font-semibold text-muted-foreground mb-6">
              Traditional Systems
            </h3>

            <div className="space-y-6">
              <div className="terminal-panel p-4">
                <div className="terminal-line">
                  <span className="text-muted-foreground/50">[--:--:--]</span>{" "}
                  Ticket #4521 logged
                </div>
                <div className="terminal-line mt-2 text-muted-foreground/30">
                  Status: Pending...
                </div>
              </div>

              <div className="flex items-center gap-3 text-muted-foreground/50">
                <div className="w-3 h-3 rounded-full border border-muted-foreground/20" />
                <span className="text-sm">No active monitoring</span>
              </div>

              <div className="flex items-center gap-3 text-muted-foreground/50">
                <div className="w-3 h-3 rounded-full border border-muted-foreground/20" />
                <span className="text-sm">Manual escalation required</span>
              </div>

              <div className="text-center py-8">
                <p className="text-muted-foreground/40 text-sm italic">
                  "Ticket logged. No updates."
                </p>
              </div>
            </div>
          </motion.div>

          {/* CivicFix AI Panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-panel p-8 relative overflow-hidden border-primary/20"
          >
            <div className="absolute top-4 right-4">
              <div className="status-dot status-dot-pulse status-dot-primary" />
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-6">
              CivicFix <span className="text-primary">AI</span>
            </h3>

            <div className="space-y-6">
              {/* Live Countdown */}
              <div className="terminal-panel p-4 border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-primary uppercase tracking-wider">
                    SLA Countdown
                  </span>
                  <span className="status-dot status-dot-warning" />
                </div>
                <div className="font-mono text-3xl text-warning text-glow-warning">
                  {formatTime(countdown.hours)}:{formatTime(countdown.minutes)}:
                  {formatTime(countdown.seconds)}
                </div>
              </div>

              {/* Status Transitions */}
              <div className="h-12 flex items-center">
                <motion.div
                  key={statusIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`text-sm font-mono ${
                    statusIndex === 3 ? "text-warning" : "text-primary"
                  }`}
                >
                  → {statuses[statusIndex]}
                </motion.div>
              </div>

              <div className="flex items-center gap-3 text-foreground">
                <div className="status-dot status-dot-success" />
                <span className="text-sm">AI actively monitoring</span>
              </div>

              <div className="flex items-center gap-3 text-foreground">
                <div className="status-dot status-dot-primary" />
                <span className="text-sm">Automatic escalation enabled</span>
              </div>
            </div>

            {/* Ambient glow */}
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary/10 blur-3xl rounded-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
};
