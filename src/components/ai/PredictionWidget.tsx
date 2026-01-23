import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, TrendingUp, AlertTriangle, Calendar, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export function PredictionWidget() {
  const [predictions, setPredictions] = useState<Array<{
    area: string;
    issueType: string;
    probability: number;
    suggestedPreventiveAction: string;
    estimatedTimeframe: string;
  }> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const res = await api.getPredictions();
        if (res.success) {
          setPredictions(res.predictions);
        }
      } catch (err) {
        console.error('Failed to load predictions', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPredictions();
  }, []);

  if (loading) {
     return <div className="p-4 text-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto"/> Loading Forecast...</div>;
  }

  if (!predictions || predictions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
         <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-orange-500" />
         </div>
         <h3 className="font-semibold text-orange-500">AI Predictive Forecast</h3>
      </div>
      
      <div className="space-y-3">
         {predictions.map((pred, idx) => (
            <motion.div 
               key={idx}
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: idx * 0.1 }}
               className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:border-orange-500/30 transition-colors"
            >
               <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <span className="font-semibold text-sm">{pred.issueType} Risk in {pred.area}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-mono">
                      {(pred.probability * 100).toFixed(0)}% Prob
                  </span>
               </div>
               
               <div className="h-1.5 w-full bg-orange-500/10 rounded-full overflow-hidden mb-2">
                   <div className="h-full bg-gradient-to-r from-orange-400 to-red-500" style={{ width: `${pred.probability * 100}%` }} />
               </div>
               
               <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2">
                  <Lightbulb className="w-3 h-3 text-yellow-500 mt-0.5" />
                  <span>Action: {pred.suggestedPreventiveAction}</span>
               </div>
               <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                  <Calendar className="w-3 h-3 text-white/50 mt-0.5" />
                  <span>Expected: {pred.estimatedTimeframe}</span>
               </div>
            </motion.div>
         ))}
      </div>
    </div>
  );
}
