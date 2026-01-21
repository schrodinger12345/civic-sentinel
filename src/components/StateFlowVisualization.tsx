import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const flowStates = [
  { id: "submitted", label: "SUBMITTED", status: "complete" },
  { id: "classified", label: "AI CLASSIFIED", status: "complete" },
  { id: "assigned", label: "ASSIGNED", status: "active" },
  { id: "warning", label: "SLA WARNING", status: "warning" },
  { id: "escalated", label: "ESCALATED", status: "pending" },
  { id: "resolved", label: "RESOLVED", status: "success" },
];

export const StateFlowVisualization = () => {
  const [pulsePosition, setPulsePosition] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePosition((prev) => (prev + 1) % 6);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getNodeClass = (status: string, index: number) => {
    const isPulsing = index === pulsePosition;
    
    if (status === "warning") {
      return `flow-node ${isPulsing ? "flow-node-warning" : "border-warning/30"} ${isPulsing ? "scale-105" : ""}`;
    }
    if (status === "success") {
      return `flow-node ${isPulsing ? "flow-node-success" : "border-success/30"} ${isPulsing ? "scale-105" : ""}`;
    }
    if (status === "active" || isPulsing) {
      return `flow-node flow-node-active ${isPulsing ? "scale-105" : ""}`;
    }
    if (status === "pending") {
      return "flow-node flow-node-dimmed";
    }
    return "flow-node border-white/10";
  };

  return (
    <div className="relative w-full overflow-hidden py-8">
      {/* Flow Container */}
      <div className="flex items-center justify-between gap-2 md:gap-4 overflow-x-auto px-4">
        {flowStates.map((state, index) => (
          <div key={state.id} className="flex items-center">
            {/* Node */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`${getNodeClass(state.status, index)} min-w-[100px] md:min-w-[130px] transition-all duration-500`}
            >
              <div className="flex flex-col items-center gap-2">
                {/* Status Indicator */}
                <div className={`status-dot ${
                  index === pulsePosition ? "status-dot-pulse" : ""
                } ${
                  state.status === "warning" ? "status-dot-warning" :
                  state.status === "success" ? "status-dot-success" :
                  "status-dot-primary"
                }`} />
                
                {/* Label */}
                <span className={`text-xs font-medium tracking-wide ${
                  state.status === "pending" ? "text-muted-foreground/50" : 
                  state.status === "warning" ? "text-warning" :
                  state.status === "success" ? "text-success" :
                  "text-foreground"
                }`}>
                  {state.label}
                </span>
              </div>
            </motion.div>

            {/* Connector */}
            {index < flowStates.length - 1 && (
              <div className="relative w-8 md:w-12 h-[2px] mx-1">
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/15 to-white/5" />
                {/* Traveling pulse */}
                <motion.div
                  className="absolute top-0 left-0 w-4 h-full bg-gradient-to-r from-transparent via-primary to-transparent"
                  animate={{
                    x: ["-100%", "200%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: index * 0.3,
                    ease: "easeInOut",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ambient glow under active state */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center bottom, hsl(173 77% 54% / 0.1), transparent 70%)",
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  );
};
