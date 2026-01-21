import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { ConsoleHeader } from "@/components/AgentConsole/ConsoleHeader";
import { DecisionLog } from "@/components/AgentConsole/DecisionLog";
import { PressureGrid } from "@/components/AgentConsole/PressureGrid";
import { ReasoningNode } from "@/components/AgentConsole/ReasoningNode";
import { ConsoleTicker } from "@/components/AgentConsole/ConsoleTicker";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const System = () => {
  return (
    <div className="min-h-screen bg-background system-grid relative overflow-hidden">
      {/* Ambient Glows */}
      <div className="ambient-glow ambient-glow-tl" />
      <div className="ambient-glow ambient-glow-br" />

      <Navigation />

      {/* Console Content */}
      <div className="pt-24 pb-8 px-4 md:px-6">
        <div className="container mx-auto max-w-7xl">
          {/* Back Link */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6"
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Overview
            </Link>
          </motion.div>

          {/* Console Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ConsoleHeader />
          </motion.div>

          {/* Disclaimer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-xs text-muted-foreground text-center"
          >
            All actions logged · Human override available
          </motion.div>

          {/* 3-Column Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6"
          >
            {/* Column 1 - Decision Log */}
            <div className="lg:col-span-1 min-h-[450px]">
              <DecisionLog />
            </div>

            {/* Column 2 - Pressure Grid */}
            <div className="lg:col-span-1 min-h-[450px]">
              <PressureGrid />
            </div>

            {/* Column 3 - Reasoning Node */}
            <div className="lg:col-span-1 min-h-[450px]">
              <ReasoningNode />
            </div>
          </motion.div>

          {/* Footer Ticker */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6"
          >
            <ConsoleTicker />
          </motion.div>

          {/* System Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 glass-panel p-6"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                  Active Tickets
                </div>
                <div className="text-2xl font-bold text-foreground">
                  1,247
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                  SLA Warnings
                </div>
                <div className="text-2xl font-bold text-warning">
                  34
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                  Escalated Today
                </div>
                <div className="text-2xl font-bold text-destructive">
                  12
                </div>
              </div>
              <div>
                <div className="text-xs font-mono uppercase text-muted-foreground mb-1">
                  Resolved Today
                </div>
                <div className="text-2xl font-bold text-success">
                  89
                </div>
              </div>
            </div>
          </motion.div>

          {/* Additional Info Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6 grid md:grid-cols-2 gap-6"
          >
            <div className="glass-panel-dark p-6">
              <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
                Recent Escalations
              </h3>
              <div className="space-y-3">
                {[
                  { id: "#405", reason: "SLA +24h expired", dept: "Sanitation" },
                  { id: "#392", reason: "No response 48h", dept: "Water Board" },
                  { id: "#388", reason: "Priority override", dept: "Transport" },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-warning">{item.id}</span>
                      <span className="text-muted-foreground">{item.reason}</span>
                    </div>
                    <span className="text-xs text-foreground/70">{item.dept}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel-dark p-6">
              <h3 className="text-sm font-mono uppercase text-muted-foreground mb-4">
                Department Performance
              </h3>
              <div className="space-y-3">
                {[
                  { dept: "Roads & Transport", score: 94, status: "good" },
                  { dept: "Sanitation", score: 78, status: "warning" },
                  { dept: "Water Supply", score: 62, status: "critical" },
                ].map((item) => (
                  <div key={item.dept} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{item.dept}</span>
                        <span
                          className={`text-sm font-mono ${
                            item.status === "good"
                              ? "text-success"
                              : item.status === "warning"
                              ? "text-warning"
                              : "text-destructive"
                          }`}
                        >
                          {item.score}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.status === "good"
                              ? "bg-success"
                              : item.status === "warning"
                              ? "bg-warning"
                              : "bg-destructive"
                          }`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default System;
