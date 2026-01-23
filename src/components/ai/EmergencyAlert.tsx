import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, PhoneCall, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmergencyAlertProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  emergencyType: string | null;
  reasoning: string;
}

export function EmergencyAlert({ isOpen, onClose, onConfirm, emergencyType, reasoning }: EmergencyAlertProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-zinc-950 border-2 border-destructive rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.5)] overflow-hidden"
          >
            {/* Pulsing Border Effect */}
            <div className="absolute inset-0 pointer-events-none z-0">
               <div className="absolute inset-0 animate-pulse bg-destructive/10" />
            </div>

            <div className="relative z-10 p-6 text-center space-y-6">
               <div className="mx-auto w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center relative">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 rounded-full bg-destructive"
                  />
                  <ShieldAlert className="w-10 h-10 text-destructive relative z-10" />
               </div>
               
               <div className="space-y-2">
                 <h2 className="text-2xl font-bold text-white tracking-tight">Emergency Detected</h2>
                 <p className="text-destructive font-mono text-sm uppercase font-semibold tracking-wider">
                    {emergencyType || 'Life Safety Threat'}
                 </p>
               </div>

               <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-left">
                  <p className="text-sm text-zinc-300">
                    <span className="font-semibold text-destructive">AI Analysis:</span> {reasoning}
                  </p>
               </div>

               <div className="p-4 bg-zinc-900/50 rounded-xl space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Recommended Actions</p>
                  <div className="flex flex-col gap-2">
                     <Button 
                        size="lg" 
                        variant="destructive" 
                        className="w-full font-bold text-lg animate-pulse shadow-lg shadow-destructive/20"
                        onClick={onConfirm}
                     >
                        REPORT IMMEDIATELY
                     </Button>
                     <Button 
                        variant="outline" 
                        className="w-full border-red-900/50 hover:bg-red-950/30 text-red-200"
                        onClick={() => window.open('tel:100')} // Mock emergency number
                     >
                        <PhoneCall className="w-4 h-4 mr-2" />
                        Call Emergency Services
                     </Button>
                  </div>
               </div>

               <button 
                  onClick={onClose}
                  className="text-xs text-muted-foreground hover:text-white underline-offset-4 hover:underline"
               >
                  This is not an emergency
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
