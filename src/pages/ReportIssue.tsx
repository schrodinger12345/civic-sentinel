import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Complaint } from '@/types/complaint';
import { useToast } from '@/hooks/use-toast';
import {
    ArrowLeft,
    Upload,
    MapPin,
    Loader2,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    ShieldCheck,
    ShieldAlert,
    ShieldQuestion,
    Clock,
    Brain,
    Zap,
} from 'lucide-react';

export default function ReportIssue() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [phase, setPhase] = useState<'input' | 'processing' | 'result' | 'rejected'>('input');
    const [result, setResult] = useState<Complaint | null>(null);
    const [rejectionInfo, setRejectionInfo] = useState<{ reason: string; confidenceScore: number } | null>(null);

    // Geolocation state
    const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationName, setLocationName] = useState<string>('');
    const [locationError, setLocationError] = useState<string | null>(null);
    const [locationLoading, setLocationLoading] = useState(true);

    // Drag and drop state
    const [isDragging, setIsDragging] = useState(false);

    // Request geolocation on mount
    useEffect(() => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            setLocationLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                setCoordinates(coords);
                setLocationError(null);

                // Reverse geocode to get address
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`,
                        { headers: { 'User-Agent': 'CivicFixAI/1.0' } }
                    );
                    const data = await response.json();
                    const address = data.display_name || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
                    setLocationName(address);
                } catch {
                    setLocationName(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
                }
                setLocationLoading(false);
            },
            (error) => {
                console.error('Geolocation error:', error);
                setLocationError('Location access is required to submit reports. Please enable location permissions.');
                setLocationLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    }, []);

    const handleImageSelect = (file: File) => {
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

    const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleImageSelect(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageSelect(file);
        }
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setImageBase64(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !imageBase64 || !coordinates || !userProfile?.uid) return;

        setLoading(true);
        setPhase('processing');

        try {
            const response = await api.submitComplaint({
                citizenId: userProfile.uid,
                citizenName: userProfile.displayName || 'Citizen',
                title: title.trim(),
                imageBase64,
                coordinates,
                locationName: locationName || userProfile.location || userProfile.city || 'Unknown Location',
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
        // Small delay to ensure Firestore has persisted the data
        setTimeout(() => {
            navigate('/dashboard/citizen');
        }, 500);
    };

    const handleTryAgain = () => {
        setTitle('');
        setImageFile(null);
        setImagePreview(null);
        setImageBase64(null);
        setRejectionInfo(null);
        setPhase('input');
    };

    const canSubmit = title.trim() && imageBase64 && coordinates && !locationLoading;

    // Get authenticity badge info
    const getAuthenticityBadge = (status: string, score: number) => {
        if (status === 'real' || score >= 0.6) {
            return {
                icon: ShieldCheck,
                color: 'text-green-400',
                bgColor: 'bg-green-500/10',
                borderColor: 'border-green-500/30',
                label: 'Verified Real',
                barColor: 'bg-gradient-to-r from-green-500 to-emerald-500',
            };
        } else if (status === 'uncertain' || (score >= 0.2 && score < 0.6)) {
            return {
                icon: ShieldQuestion,
                color: 'text-yellow-400',
                bgColor: 'bg-yellow-500/10',
                borderColor: 'border-yellow-500/30',
                label: 'Needs Review',
                barColor: 'bg-gradient-to-r from-yellow-500 to-amber-500',
            };
        } else {
            return {
                icon: ShieldAlert,
                color: 'text-red-400',
                bgColor: 'bg-red-500/10',
                borderColor: 'border-red-500/30',
                label: 'Flagged',
                barColor: 'bg-gradient-to-r from-red-500 to-rose-500',
            };
        }
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden">
            {/* Ambient glow effects */}
            <div className="ambient-glow ambient-glow-tl" />
            <div className="ambient-glow ambient-glow-br" />

            <div className="container max-w-3xl mx-auto px-4 py-6 relative z-10">
                {/* Back Button */}
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => navigate('/dashboard/citizen')}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span>Back to Dashboard</span>
                </motion.button>

                {/* Header */}
                <motion.header
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="flex items-center justify-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
                            <Brain className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                            Report an Issue
                        </h1>
                    </div>
                    <p className="text-muted-foreground">AI-Powered Infrastructure Monitoring</p>
                </motion.header>

                <AnimatePresence mode="wait">
                    {/* INPUT PHASE */}
                    {phase === 'input' && (
                        <motion.div
                            key="input-form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="glass-panel p-8">
                                <h2 className="text-xl font-semibold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                                    Submit a Report
                                </h2>
                                <p className="text-muted-foreground text-sm mb-6">
                                    Upload an image and location to report infrastructure issues
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Image Upload Area */}
                                    <div>
                                        <label className="block mb-2 font-medium">
                                            Issue Image <span className="text-red-400">*</span>
                                        </label>
                                        <div
                                            onClick={() => !imagePreview && fileInputRef.current?.click()}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`
                        relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer
                        ${isDragging
                                                    ? 'border-primary bg-primary/10 scale-[1.02]'
                                                    : 'border-white/20 hover:border-primary/50 hover:bg-primary/5'
                                                }
                        ${imagePreview ? 'p-0 border-solid' : ''}
                      `}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={handleFileInputChange}
                                                className="hidden"
                                            />

                                            {!imagePreview ? (
                                                <div className="py-4">
                                                    <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
                                                    <p className="font-medium mb-1">Click to upload or drag and drop</p>
                                                    <span className="text-sm text-muted-foreground">PNG, JPG, WEBP up to 10MB</span>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <img
                                                        src={imagePreview}
                                                        alt="Preview"
                                                        className="w-full max-h-[300px] object-cover rounded-xl"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveImage();
                                                        }}
                                                        className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                                                    >
                                                        <AlertCircle className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Title Input */}
                                    <div>
                                        <label className="block mb-2 font-medium">
                                            Issue Title <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g., Large pothole on Main Street"
                                            maxLength={100}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                                        />
                                    </div>

                                    {/* Location Display */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block mb-2 font-medium">
                                                Latitude <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={coordinates ? coordinates.latitude.toFixed(6) : 'Detecting...'}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-muted-foreground cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="block mb-2 font-medium">
                                                Longitude <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={coordinates ? coordinates.longitude.toFixed(6) : 'Detecting...'}
                                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-muted-foreground cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    {/* Location Status */}
                                    {locationLoading ? (
                                        <div className="rounded-xl bg-primary/10 border border-primary/30 p-4 flex items-center gap-3">
                                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                            <span className="text-sm text-primary">Detecting your location...</span>
                                        </div>
                                    ) : locationError ? (
                                        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-center gap-3">
                                            <AlertTriangle className="w-5 h-5 text-red-400" />
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-red-400">Location Required</p>
                                                <p className="text-xs text-muted-foreground">{locationError}</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.location.reload()}
                                            >
                                                Retry
                                            </Button>
                                        </div>
                                    ) : coordinates ? (
                                        <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 flex items-center gap-3">
                                            <MapPin className="w-5 h-5 text-green-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-green-400">Location Captured</p>
                                                <p className="text-xs text-muted-foreground truncate">{locationName}</p>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* AI Info Banner */}
                                    <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                                        <div className="flex items-start gap-3">
                                            <Zap className="w-5 h-5 text-primary mt-0.5" />
                                            <div>
                                                <p className="text-primary font-semibold mb-1">Gemini AI will analyze your image:</p>
                                                <ul className="text-xs text-muted-foreground space-y-1">
                                                    <li>→ Generate detailed description</li>
                                                    <li>→ Determine issue category & severity</li>
                                                    <li>→ Calculate priority (1-10) & SLA</li>
                                                    <li>→ Verify authenticity (real vs fake)</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        disabled={!canSubmit || loading}
                                        className="w-full py-6 text-lg font-semibold bg-primary hover:bg-primary/90 glow-primary transition-all"
                                    >
                                        <span>Analyze Report</span>
                                        <ArrowLeft className="w-5 h-5 ml-2 rotate-180" />
                                    </Button>
                                </form>
                            </div>
                        </motion.div>
                    )}

                    {/* PROCESSING PHASE */}
                    {phase === 'processing' && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="glass-panel p-8"
                        >
                            <div className="py-12 text-center">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center glow-primary">
                                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                </div>
                                <h3 className="text-2xl font-semibold mb-3">Analyzing Image with Gemini Vision...</h3>
                                <p className="text-muted-foreground mb-6">
                                    AI is examining your photo and generating insights
                                </p>
                                <div className="max-w-md mx-auto p-4 rounded-xl bg-white/5 border border-white/10">
                                    <p className="text-sm font-mono text-primary animate-pulse">
                                        POST /api/complaints/submit<br />
                                        → geminiService.analyzeImage()<br />
                                        → Generating description...<br />
                                        → Checking authenticity...
                                    </p>
                                </div>
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
                            className="glass-panel p-8"
                        >
                            <h2 className="text-xl font-semibold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                                Analysis Results
                            </h2>

                            {/* Confidence Indicator */}
                            {(() => {
                                const badge = getAuthenticityBadge(result.authenticityStatus, result.confidenceScore);
                                return (
                                    <div className="rounded-xl bg-white/5 border border-white/10 p-5 mb-6">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm font-medium text-muted-foreground">Confidence Score</span>
                                            <span className={`text-3xl font-bold ${badge.color}`}>
                                                {(result.confidenceScore * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${result.confidenceScore * 100}%` }}
                                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                                className={`h-full rounded-full ${badge.barColor}`}
                                            />
                                        </div>
                                        <div className={`text-center py-2 rounded-lg ${badge.bgColor} ${badge.color} font-medium`}>
                                            {result.confidenceScore >= 0.6 ? '✅' : result.confidenceScore >= 0.2 ? '⚠️' : '❌'}{' '}
                                            {badge.label}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Result Details */}
                            <div className="space-y-4 mb-6">
                                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Issue Type</span>
                                    <span className="text-lg font-semibold capitalize">{result.category.replace(/_/g, ' ')}</span>
                                </div>

                                <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Description</span>
                                    <p className="text-sm leading-relaxed">{result.description}</p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                                        <span className="text-xs text-muted-foreground uppercase block mb-1">Severity</span>
                                        <span className={`text-lg font-bold uppercase ${result.severity === 'critical' ? 'text-red-400' :
                                                result.severity === 'high' ? 'text-orange-400' :
                                                    result.severity === 'medium' ? 'text-yellow-400' :
                                                        'text-green-400'
                                            }`}>{result.severity}</span>
                                    </div>
                                    <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                                        <span className="text-xs text-muted-foreground uppercase block mb-1">Priority</span>
                                        <span className="text-lg font-bold text-primary">{result.priority}/10</span>
                                    </div>
                                    <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 text-center">
                                        <span className="text-xs text-warning uppercase flex items-center justify-center gap-1 mb-1">
                                            <Clock className="w-3 h-3" /> SLA
                                        </span>
                                        <span className="text-lg font-bold text-warning">
                                            {(() => {
                                                if (!result.nextEscalationAt) return 'N/A';
                                                const deadline = new Date(result.nextEscalationAt);
                                                const secondsRemaining = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
                                                return `${secondsRemaining}s`;
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Success Banner */}
                            <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 flex items-center gap-3 mb-6">
                                <CheckCircle2 className="w-6 h-6 text-green-400" />
                                <span className="text-green-400 font-medium">
                                    Report #{result.id.slice(0, 8)}... saved successfully!
                                </span>
                            </div>

                            <Button onClick={handleDone} className="w-full py-6 text-lg font-semibold">
                                Done - View in Dashboard
                            </Button>
                        </motion.div>
                    )}

                    {/* REJECTED PHASE */}
                    {phase === 'rejected' && rejectionInfo && (
                        <motion.div
                            key="rejected"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="glass-panel p-8"
                        >
                            {/* Rejection Banner */}
                            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-5 flex items-start gap-4 mb-6">
                                <AlertCircle className="w-7 h-7 text-red-400 flex-shrink-0" />
                                <div>
                                    <strong className="text-red-400 block mb-1">Duplicate Report Detected</strong>
                                    <p className="text-sm text-muted-foreground">{rejectionInfo.reason}</p>
                                </div>
                            </div>

                            {/* Confidence Score Display */}
                            <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center mb-6">
                                <span className="text-xs text-muted-foreground uppercase block mb-2">AI Confidence Score</span>
                                <span className="text-4xl font-bold text-red-400">
                                    {(rejectionInfo.confidenceScore * 100).toFixed(0)}%
                                </span>
                                <p className="text-xs text-muted-foreground mt-3">
                                    Score below 20% indicates the image may not show a real civic issue.
                                </p>
                            </div>

                            {/* Tips */}
                            <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-4 mb-6">
                                <p className="text-sm font-medium text-yellow-400 mb-2">Tips for a successful report:</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                    <li>• Take a clear photo of the actual issue</li>
                                    <li>• Ensure good lighting and focus</li>
                                    <li>• Capture the problem from an appropriate distance</li>
                                    <li>• Avoid screenshots, memes, or unrelated images</li>
                                </ul>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => navigate('/dashboard/citizen')} className="flex-1 py-5">
                                    Back to Dashboard
                                </Button>
                                <Button onClick={handleTryAgain} className="flex-1 py-5">
                                    Try Again
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer */}
                <motion.footer
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-center mt-8 py-4 border-t border-white/[0.06] text-muted-foreground text-sm"
                >
                    Powered by Google Gemini AI • CivicFix AI
                </motion.footer>
            </div>

            {/* Loading Overlay */}
            <AnimatePresence>
                {loading && phase === 'processing' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-background/90 backdrop-blur-lg z-50 flex items-center justify-center flex-col gap-6"
                    >
                        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-lg text-muted-foreground">Analyzing image with AI...</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
