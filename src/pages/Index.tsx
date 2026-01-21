import { motion } from "framer-motion";
import { Navigation } from "@/components/Navigation";
import { StateFlowVisualization } from "@/components/StateFlowVisualization";
import { SystemSignals } from "@/components/SystemSignals";
import { ComparisonPanels } from "@/components/ComparisonPanels";
import { Link } from "react-router-dom";
import { ArrowRight, Eye } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background system-grid relative overflow-hidden">
      {/* Ambient Glows */}
      <div className="ambient-glow ambient-glow-tl" />
      <div className="ambient-glow ambient-glow-br" />

      <Navigation />

      {/* Hero / System Overview Section */}
      <section className="pt-32 pb-16 px-6 relative">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-[1.2fr,1fr] gap-8 items-start">
            {/* Left - Headlines & Signals */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Complaints Shouldn't Be{" "}
                <span className="text-primary text-glow-primary">Ignored.</span>
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-md">
                CivicFix AI actively monitors, evaluates, and enforces resolution
                of civic complaints using AI judgment and system-level
                accountability.
              </p>

              <SystemSignals />

              <div className="mt-10 flex flex-wrap gap-4">
                <Link to="/system" className="btn-system-primary flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  View Agent Console
                </Link>
                <button className="btn-system-ghost flex items-center gap-2">
                  Learn More
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

            {/* Right - State Flow Visualization */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="glass-panel p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                  System State Flow
                </h2>
                <div className="flex items-center gap-2">
                  <div className="status-dot status-dot-pulse status-dot-primary" />
                  <span className="text-xs text-primary font-mono">LIVE</span>
                </div>
              </div>

              <StateFlowVisualization />

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Complaints flow through system stages</span>
                <span className="font-mono text-primary">12 active</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <ComparisonPanels />

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-6">
              How the System <span className="text-primary">Enforces</span> Accountability
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-12">
              Every complaint enters an autonomous pipeline. AI classifies severity,
              assigns responsibility, monitors SLA deadlines, and escalates
              automatically when action stalls.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Submit",
                desc: "Citizens report issues via any channel. AI ingests and classifies.",
              },
              {
                step: "02",
                title: "Monitor",
                desc: "Real-time SLA tracking. System pressure builds on inaction.",
              },
              {
                step: "03",
                title: "Enforce",
                desc: "Automatic escalation. Higher authorities notified. Resolution tracked.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="glass-panel p-6 text-left"
              >
                <span className="text-3xl font-bold text-primary/30 font-mono">
                  {item.step}
                </span>
                <h3 className="text-lg font-semibold mt-2 mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency Section */}
      <section id="transparency" className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
        <div className="container mx-auto max-w-4xl text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-6">
              Full <span className="text-primary">Transparency</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Every AI decision is logged and auditable. See exactly why complaints
              were escalated, what triggered SLA warnings, and how the system
              intervened.
            </p>

            <Link
              to="/system"
              className="btn-system-primary inline-flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Open Agent Console
            </Link>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel p-8 md:p-12 text-center"
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-6">
              About <span className="text-primary">CivicFix AI</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              CivicFix AI is an autonomous civic accountability system designed for
              national-scale deployment. It replaces passive ticketing systems with
              an active enforcement layer that ensures no complaint is forgotten,
              no deadline missed, and no inaction tolerated.
            </p>
            <div className="mt-8 flex justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">99.7%</div>
                <div className="text-muted-foreground">SLA Compliance</div>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">4.2x</div>
                <div className="text-muted-foreground">Faster Resolution</div>
              </div>
              <div className="w-px bg-white/10" />
              <div className="text-center">
                <div className="text-2xl font-bold text-success">100%</div>
                <div className="text-muted-foreground">Auditable</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            © 2026 CivicFix AI. Autonomous Civic Accountability.
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <div className="status-dot status-dot-success" />
            System Online
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
