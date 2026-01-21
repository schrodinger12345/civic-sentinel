import { motion } from "framer-motion";

export const ConsoleTicker = () => {
  const tickerItems = [
    "Agent Loop Running",
    "Escalations Active",
    "Decisions Auditable",
    "Human Override Available",
    "All Actions Logged",
  ];

  return (
    <div className="w-full overflow-hidden py-3 border-t border-white/5">
      <motion.div
        className="flex gap-8 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {[...tickerItems, ...tickerItems].map((item, index) => (
          <span
            key={index}
            className="text-xs font-mono text-muted-foreground flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
};
