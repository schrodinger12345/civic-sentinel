import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, RefreshCw, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onTranscription: (result: {
    transcription: string;
    category: string;
    severity: string;
    urgency: string;
    isEmergency: boolean;
  }) => void;
  citizenId: string;
  coordinates: { latitude: number; longitude: number };
  locationName: string;
}

export function VoiceRecorder({ onTranscription, citizenId, coordinates, locationName }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];

      recorder.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'Microphone Access Denied',
        description: 'Please allow microphone access to use voice reporting.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const processAudio = async (blob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        try {
          const result = await api.submitVoiceComplaint({
            audioBase64: base64Audio,
            mimeType: 'audio/webm',
            citizenId,
            coordinates,
            locationName,
          });

          if (result.success) {
            onTranscription(result);
            toast({
              title: 'Voice Processed',
              description: 'AI successfully analyzed your voice report.',
            });
          }
        } catch (error) {
           console.error('Voice processing error:', error);
           toast({
             title: 'Processing Failed',
             description: 'Could not analyze voice. Please try again.',
             variant: 'destructive'
           });
        } finally {
          setIsProcessing(false);
        }
      };
    } catch (error) {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-6 glass-panel border border-primary/20 bg-primary/5 rounded-2xl relative overflow-hidden group">
      {/* Background Pulse Effect */}
      {isRecording && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.8, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-32 h-32 rounded-full bg-primary/20 blur-xl"
          />
           <motion.div
            initial={{ scale: 0.8, opacity: 0.3 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="w-48 h-48 rounded-full bg-primary/10 blur-2xl"
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        {!isRecording && !isProcessing ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-4 relative z-10"
          >
            <div className="relative inline-block">
                <Button
                variant="outline"
                size="lg"
                className="w-16 h-16 rounded-full border-2 border-primary/50 hover:bg-primary/20 hover:scale-110 transition-all shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                onClick={startRecording}
                >
                <Mic className="w-8 h-8 text-primary" />
                </Button>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
            </div>
            
            <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Tap to Speak</p>
                <p className="text-xs text-muted-foreground">Describe the issue in your language</p>
            </div>
          </motion.div>
        ) : isRecording ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-4 relative z-10"
          >
            <div className="w-16 h-16 flex items-center justify-center mx-auto relative">
                 <motion.div
                    animate={{ height: ["20%", "60%", "30%", "100%", "40%"] }}
                    transition={{ repeat: Infinity, duration: 0.8, repeatType: "reverse" }}
                    className="w-1.5 bg-primary rounded-full mx-0.5"
                 />
                 <motion.div
                    animate={{ height: ["40%", "80%", "50%", "30%", "70%"] }}
                    transition={{ repeat: Infinity, duration: 0.7, repeatType: "reverse", delay: 0.1 }}
                    className="w-1.5 bg-primary rounded-full mx-0.5"
                 />
                 <motion.div
                    animate={{ height: ["60%", "100%", "80%", "40%", "20%"] }}
                    transition={{ repeat: Infinity, duration: 0.6, repeatType: "reverse", delay: 0.2 }}
                    className="w-1.5 bg-primary rounded-full mx-0.5"
                 />
                 <Button
                    variant="destructive"
                    size="icon"
                    className="absolute inset-0 w-full h-full rounded-full opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center bg-red-500/90 backdrop-blur-sm"
                    onClick={stopRecording}
                >
                    <Square className="w-6 h-6 fill-current" />
                </Button>
            </div>
            
            <div className="space-y-1">
                <p className="text-sm font-medium text-primary animate-pulse">Listening...</p>
                <p className="text-xs text-muted-foreground">Tap wave to stop</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center space-y-4 relative z-10"
          >
            <div className="w-16 h-16 mx-auto flex items-center justify-center bg-primary/10 rounded-full">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <div className="space-y-1">
               <p className="text-sm font-medium">Analyzing Voice...</p>
               <p className="text-xs text-muted-foreground">Detecting language & urgency</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
