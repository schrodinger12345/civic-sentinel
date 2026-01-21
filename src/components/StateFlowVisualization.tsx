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
    <div className="relative w-full py-4">
      {/* Vertical Flow Container */}
      <div className="flex flex-col items-center gap-0">
        {flowStates.map((state, index) => (
          <div key={state.id} className="flex flex-col items-center">
            {/* Node */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className={`${getNodeClass(state.status, index)} w-full max-w-[200px] transition-all duration-500`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status Indicator */}
                <div className={`status-dot shrink-0 ${
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

            {/* River Connector */}
            {index < flowStates.length - 1 && (
              <div className="relative w-[3px] h-10 overflow-hidden">
                {/* Static river bed */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-white/10 rounded-full" />
                
                {/* Flowing water effect - multiple droplets */}
                {[0, 1, 2].map((droplet) => (
                  <motion.div
                    key={droplet}
                    className="absolute left-0 right-0 h-4 bg-gradient-to-b from-transparent via-primary to-transparent rounded-full"
                    animate={{
                      y: ["-100%", "300%"],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: droplet * 0.5,
                      ease: "easeInOut",
                    }}
                  />
                ))}
                
                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 bg-primary/20 blur-sm rounded-full"
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ambient glow under flow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, hsl(173 77% 54% / 0.05), transparent 70%)",
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  );
};
