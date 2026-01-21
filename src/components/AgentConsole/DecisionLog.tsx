import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const initialLogs = [
  { time: "11:42:03", message: "Scanning Ticket #405", type: "info" },
  { time: "11:42:07", message: "Image Analysis: Garbage Overflow", type: "info" },
  { time: "11:42:10", message: "Public Health Risk: HIGH", type: "warning" },
  { time: "11:42:12", message: "SLA Expired (+24h)", type: "warning" },
  { time: "11:42:14", message: "Decision: ESCALATE", type: "action" },
  { time: "11:42:15", message: "Notification Sent", type: "success" },
];

const additionalLogs = [
  { time: "11:42:20", message: "Scanning Ticket #406", type: "info" },
  { time: "11:42:23", message: "Category: Road Damage", type: "info" },
  { time: "11:42:25", message: "Severity Assessment: MEDIUM", type: "info" },
  { time: "11:42:27", message: "Assigned to: Transport Dept", type: "success" },
  { time: "11:42:32", message: "Scanning Ticket #407", type: "info" },
  { time: "11:42:35", message: "Water Leak Detected", type: "warning" },
  { time: "11:42:38", message: "Priority: URGENT", type: "action" },
];

export const DecisionLog = () => {
  const [logs, setLogs] = useState(initialLogs);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLogIndex((prev) => {
        const next = prev + 1;
        if (next < additionalLogs.length) {
          setLogs((currentLogs) => [...currentLogs, additionalLogs[next]]);
        } else {
          // Reset cycle
          setLogs(initialLogs);
          return -1;
        }
        return next;
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const getTypeClass = (type: string) => {
    switch (type) {
      case "warning":
        return "text-warning";
      case "action":
        return "terminal-action";
      case "success":
        return "terminal-success";
      default:
        return "text-foreground/80";
    }
  };

  return (
    <div className="glass-panel-dark h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Live Decision Log
        </h3>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="p-4 space-y-2 font-mono text-xs overflow-y-auto max-h-[400px]">
          {logs.slice(-12).map((log, index) => (
            <motion.div
              key={`${log.time}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex gap-2 leading-relaxed"
            >
              <span className="terminal-timestamp">[{log.time}]</span>
              <span className={getTypeClass(log.type)}>{log.message}</span>
            </motion.div>
          ))}
          
          {/* Blinking cursor */}
          <div className="flex items-center gap-2">
            <span className="terminal-timestamp">[--:--:--]</span>
            <span className="w-2 h-4 bg-primary animate-cursor" />
          </div>
        </div>
      </div>
    </div>
  );
};
