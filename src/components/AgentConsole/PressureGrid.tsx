import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const GRID_SIZE = 100;

export const PressureGrid = () => {
  const [activeDots, setActiveDots] = useState<number[]>([12, 23, 34, 45, 67, 78]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Randomly activate 4-8 dots
      const count = Math.floor(Math.random() * 5) + 4;
      const newActive: number[] = [];
      for (let i = 0; i < count; i++) {
        newActive.push(Math.floor(Math.random() * GRID_SIZE));
      }
      setActiveDots(newActive);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel-dark h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          System Pressure Grid
        </h3>
      </div>

      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: GRID_SIZE }).map((_, index) => (
            <motion.div
              key={index}
              className={`pressure-dot ${
                activeDots.includes(index) ? "pressure-dot-active" : ""
              }`}
              animate={
                activeDots.includes(index)
                  ? {
                      scale: [1, 1.3, 1],
                      opacity: [0.6, 1, 0.6],
                    }
                  : {}
              }
              transition={{
                duration: 1.5,
                repeat: activeDots.includes(index) ? Infinity : 0,
                delay: Math.random() * 0.5,
              }}
            />
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Escalation Hotspots</span>
          <span className="text-warning font-mono">{activeDots.length} active</span>
        </div>
      </div>
    </div>
  );
};
