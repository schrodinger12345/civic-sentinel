import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Complaint } from '@/types/complaint';
import { useToast } from '@/hooks/use-toast';
import {
  Brain,
  Zap,
  Clock,
  CheckCircle2,
  Loader2,
  Upload,
  MapPin,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  citizenId: string;
  citizenName: string;
  coordinates: { latitude: number; longitude: number } | null;
  locationName: string;
  onSuccess: (complaint: Complaint) => void;
}

export function ComplaintSubmissionModal({
  isOpen,
  onClose,
  citizenId,
  citizenName,
  coordinates,
  locationName,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'input' | 'processing' | 'result' | 'rejected'>('input');
  const [result, setResult] = useState<Complaint | null>(null);
  const [rejectionInfo, setRejectionInfo] = useState<{ reason: string; confidenceScore: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setImageFile(null);
      setImagePreview(null);
      setImageBase64(null);
      setLoading(false);
      setPhase('input');
      setResult(null);
      setRejectionInfo(null);
    }
  }, [isOpen]);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, or WebP image.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setImageFile(file);

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Convert to Base64
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !imageBase64 || !coordinates) return;

    setLoading(true);
    setPhase('processing');

    try {
      const response = await api.submitComplaint({
        citizenId,
        citizenName,
        title: title.trim(),
        imageBase64,
        coordinates,
        locationName,
      });

      if (response.rejected) {
        // Report was flagged as fake
        setRejectionInfo({
          reason: response.reason || 'Report flagged as potentially fake.',
          confidenceScore: response.confidenceScore || 0,
        });
        setPhase('rejected');
      } else if (response.complaint) {
        // Success
        setResult(response.complaint);
        setPhase('result');
        onSuccess(response.complaint);
      }
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setPhase('input');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    toast({
      title: 'Complaint submitted',
      description: 'AI analyzed your image and created the report. Watch the SLA countdown!',
    });
    onClose();
  };

  const canSubmit = title.trim() && imageBase64 && coordinates;

  // Get authenticity badge info
  const getAuthenticityBadge = (status: string, score: number) => {
    if (status === 'real' || score >= 0.6) {
      return {
        icon: ShieldCheck,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/30',
        label: 'Verified Real',
      };
    } else if (status === 'uncertain' || (score >= 0.2 && score < 0.6)) {
      return {
        icon: ShieldQuestion,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/30',
        label: 'Needs Review',
      };
    } else {
      return {
        icon: ShieldAlert,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        label: 'Flagged',
      };
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {phase === 'input' && 'Report a Civic Issue'}
            {phase === 'processing' && 'Gemini AI Analyzing Image...'}
            {phase === 'result' && '✅ AI Analysis Complete'}
            {phase === 'rejected' && '⚠️ Report Not Accepted'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* INPUT PHASE */}
          {phase === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Location Status */}
              <div className={`rounded-lg p-3 flex items-center gap-2 ${coordinates
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-red-500/10 border border-red-500/30'
                }`}>
                <MapPin className={`w-4 h-4 ${coordinates ? 'text-green-400' : 'text-red-400'}`} />
                <div className="flex-1">
                  {coordinates ? (
                    <>
                      <p className="text-sm font-medium text-green-400">Location Captured</p>
                      <p className="text-xs text-muted-foreground">{locationName}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-red-400">Location Required</p>
                      <p className="text-xs text-muted-foreground">Please enable location access to submit reports.</p>
                    </>
                  )}
                </div>
              </div>

              {/* Title Input */}
              <div className="grid gap-2">
                <Label htmlFor="title">Issue Title / Subject</Label>
                <Input
                  id="title"
                  placeholder="e.g., Large pothole on Main Street"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Image Upload */}
              <div className="grid gap-2">
                <Label>Photo of the Issue</Label>
                {!imagePreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload an image</p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP (max 10MB)</p>
                  </div>
                ) : (
                  <div className="relative rounded-lg overflow-hidden border border-white/20">
                    <img
                      src={imagePreview}
                      alt="Issue preview"
                      className="w-full h-48 object-cover"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* AI Info */}
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-primary font-semibold">Gemini AI will analyze your image:</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      → Generate detailed description<br />
                      → Determine issue category & severity<br />
                      → Calculate priority (1-10) & SLA<br />
                      → Verify authenticity (real vs fake)
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  Submit to Gemini AI
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* PROCESSING PHASE */}
          {phase === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Analyzing Image with Gemini Vision...</h3>
              <p className="text-sm text-muted-foreground">
                AI is examining your photo and generating insights
              </p>
              <div className="mt-4 mx-auto max-w-xs p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs font-mono text-primary animate-pulse">
                  POST /api/complaints/submit<br />
                  → geminiService.analyzeImage()<br />
                  → Generating description...<br />
                  → Checking authenticity...
                </p>
              </div>
            </motion.div>
          )}

          {/* RESULT PHASE */}
          {phase === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Success Banner */}
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm font-semibold text-green-400">
                    AI Analysis Complete
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Complaint ID: {result.id.slice(0, 8)}...
                  </p>
                </div>
              </div>

              {/* AI Generated Description */}
              <div className="rounded-lg bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-muted-foreground uppercase mb-2">AI-Generated Description</div>
                <p className="text-sm">{result.description}</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Category</div>
                  <div className="text-sm font-semibold capitalize">{result.category}</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Severity</div>
                  <div className={`text-sm font-semibold uppercase ${result.severity === 'critical' ? 'text-destructive' :
                      result.severity === 'high' ? 'text-orange-400' :
                        result.severity === 'medium' ? 'text-yellow-400' :
                          'text-green-400'
                    }`}>{result.severity}</div>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="text-xs text-muted-foreground uppercase mb-1">Priority</div>
                  <div className="text-sm font-semibold">{result.priority}/10</div>
                </div>
                <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                  <div className="text-xs text-warning uppercase mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> SLA
                  </div>
                  <div className="text-sm font-semibold text-warning">
                    {(() => {
                      if (!result.nextEscalationAt) return 'N/A';
                      const deadline = new Date(result.nextEscalationAt);
                      const secondsRemaining = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
                      return `${secondsRemaining}s`;
                    })()}
                  </div>
                </div>
              </div>

              {/* Authenticity Score */}
              {(() => {
                const badge = getAuthenticityBadge(result.authenticityStatus, result.confidenceScore);
                const BadgeIcon = badge.icon;
                return (
                  <div className={`rounded-lg ${badge.bgColor} border ${badge.borderColor} p-3 flex items-center gap-3`}>
                    <BadgeIcon className={`w-5 h-5 ${badge.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${badge.color}`}>{badge.label}</span>
                        <span className={`text-sm font-mono ${badge.color}`}>
                          {(result.confidenceScore * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <DialogFooter>
                <Button onClick={handleDone} className="w-full">
                  Done - View in Dashboard
                </Button>
              </DialogFooter>
            </motion.div>
          )}

          {/* REJECTED PHASE */}
          {phase === 'rejected' && rejectionInfo && (
            <motion.div
              key="rejected"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Rejection Banner */}
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400 mb-1">
                    Report Not Accepted
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {rejectionInfo.reason}
                  </p>
                </div>
              </div>

              {/* Confidence Score */}
              <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-center">
                <div className="text-xs text-muted-foreground uppercase mb-2">AI Confidence Score</div>
                <div className="text-3xl font-bold text-red-400">
                  {(rejectionInfo.confidenceScore * 100).toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Score below 20% indicates the image may not show a real civic issue.
                </p>
              </div>

              {/* Tips */}
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                <p className="text-sm font-medium text-yellow-400 mb-2">Tips for a successful report:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Take a clear photo of the actual issue</li>
                  <li>• Ensure good lighting and focus</li>
                  <li>• Capture the problem from an appropriate distance</li>
                  <li>• Avoid screenshots, memes, or unrelated images</li>
                </ul>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button onClick={() => setPhase('input')}>
                  Try Again
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
