import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Upload, ScanLine, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card } from '@/components/ui/card';

interface ResolutionVerifierProps {
  complaintId: string;
  beforeImage: string;
  onVerified: () => void;
}

export function ResolutionVerifier({ complaintId, beforeImage, onVerified }: ResolutionVerifierProps) {
  const [afterImage, setAfterImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<{
    isResolved: boolean;
    confidenceScore: number;
    reasoning: string;
  } | null>(null);
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAfterImage(reader.result as string);
        setResult(null); // Reset result on new image
      };
      reader.readAsDataURL(file);
    }
  };

  const verifyResolution = async () => {
    if (!afterImage) return;
    
    setIsVerifying(true);
    try {
      const res = await api.verifyResolution({
         complaintId,
         afterImageBase64: afterImage
      });

      if (res.success) {
        setResult({
            isResolved: res.isResolved,
            confidenceScore: res.confidenceScore,
            reasoning: res.reasoning
        });
        if (res.isResolved) {
            toast({
                title: 'Resolution Verified! 🎉',
                description: `AI Confidence: ${(res.confidenceScore * 100).toFixed(0)}%`,
                className: 'bg-green-500/10 border-green-500/50 text-green-500'
            });
            setTimeout(onVerified, 2000); // Auto-close/refresh after success
        } else {
             toast({
                title: 'Verification Failed',
                description: 'AI detected the issue is not fully resolved.',
                variant: 'destructive'
            });
        }
      }
    } catch (error) {
       console.error(error);
       toast({
         title: 'Verification Error',
         description: 'Could not connect to AI verification service.',
         variant: 'destructive'
       });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Before Image */}
        <div className="space-y-2">
           <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Before</span>
           <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/20 group">
              <img src={beforeImage} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Issue" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
           </div>
        </div>

        {/* After Image */}
        <div className="space-y-2">
           <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">After (Proof)</span>
           <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/20 group">
              {afterImage ? (
                  <>
                    <img src={afterImage} className="w-full h-full object-cover" alt="Resolution" />
                    <button 
                        onClick={() => setAfterImage(null)}
                        className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-destructive transition-colors"
                    >
                        <XCircle className="w-4 h-4 text-white" />
                    </button>
                  </>
              ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/5 transition-colors border-2 border-dashed border-white/10 hover:border-primary/50">
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                      <span className="text-xs text-muted-foreground">Upload Photo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
              )}
           </div>
        </div>
      </div>

      {/* Action / Result */}
      <AnimatePresence mode="wait">
        {!result ? (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <Button 
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-violet-600 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
                    disabled={!afterImage || isVerifying}
                    onClick={verifyResolution}
                >
                    {isVerifying ? (
                        <>
                           <ScanLine className="w-5 h-5 mr-2 animate-pulse" />
                           Verifying with Gemini...
                        </>
                    ) : (
                        <>
                           Verify Resolution
                           <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                    )}
                </Button>
            </motion.div>
        ) : (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border ${result.isResolved ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}
            >
                <div className="flex items-center gap-3 mb-3">
                   {result.isResolved ? (
                       <CheckCircle2 className="w-6 h-6 text-green-500" />
                   ) : (
                       <XCircle className="w-6 h-6 text-red-500" />
                   )}
                   <div>
                       <h3 className={`font-bold ${result.isResolved ? 'text-green-500' : 'text-red-500'}`}>
                           {result.isResolved ? 'Resolution Verified' : 'Resolution Rejected'}
                       </h3>
                       <p className="text-xs text-muted-foreground">AI Confidence Score</p>
                   </div>
                   <div className="ml-auto text-2xl font-bold font-mono opacity-80">
                       {(result.confidenceScore * 100).toFixed(0)}%
                   </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden mb-3">
                    <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${result.confidenceScore * 100}%` }}
                       transition={{ duration: 1, ease: 'easeOut' }}
                       className={`h-full ${result.isResolved ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                </div>

                <p className="text-sm opacity-90 leading-relaxed">
                    <span className="font-semibold opacity-50 uppercase text-xs mr-2">Analysis</span>
                    {result.reasoning}
                </p>

                {!result.isResolved && (
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setResult(null)}>
                        Upload Better Proof
                    </Button>
                )}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
