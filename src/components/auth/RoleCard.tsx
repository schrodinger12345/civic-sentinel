import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface RoleCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function RoleCard({ icon: Icon, title, description, selected, onClick }: RoleCardProps) {
  return (
    <motion.button
      onClick={onClick}
      className={`
        relative w-full p-8 rounded-2xl text-left transition-all duration-300
        glass-panel hover:bg-white/[0.08]
        ${selected 
          ? 'border-primary/50 glow-primary bg-primary/5' 
          : 'border-white/[0.08] hover:border-white/20'
        }
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Selection indicator */}
      {selected && (
        <motion.div
          className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <svg
            className="w-4 h-4 text-primary-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </motion.div>
      )}

      {/* Icon */}
      <div
        className={`
          w-16 h-16 rounded-xl flex items-center justify-center mb-6
          ${selected ? 'bg-primary/20' : 'bg-white/5'}
          transition-colors duration-300
        `}
      >
        <Icon
          className={`w-8 h-8 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
        />
      </div>

      {/* Content */}
      <h3 className={`text-xl font-semibold mb-2 ${selected ? 'text-primary' : 'text-foreground'}`}>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {/* Hover glow effect */}
      <div
        className={`
          absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300
          ${selected ? 'opacity-100' : 'opacity-0'}
        `}
        style={{
          background: 'radial-gradient(ellipse at center, hsla(173, 77%, 54%, 0.05), transparent 70%)',
        }}
      />
    </motion.button>
  );
}
