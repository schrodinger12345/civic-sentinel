import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';

const STORAGE_KEY = 'civicfix-agent-mode';

interface AgentModeToggleProps {
    onChange?: (enabled: boolean) => void;
    className?: string;
}

/**
 * Agent Mode toggle - reveals AI decision transparency for hackathon judges.
 * State persists to localStorage so judges can keep it on across sessions.
 */
export function AgentModeToggle({ onChange, className = '' }: AgentModeToggleProps) {
    const [enabled, setEnabled] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        }
        return false;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(enabled));
        onChange?.(enabled);
    }, [enabled, onChange]);

    return (
        <button
            onClick={() => setEnabled(!enabled)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${enabled
                    ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_12px_rgba(124,58,237,0.3)]'
                    : 'bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10'
                } ${className}`}
            title="Toggle Agent Mode to reveal AI decision transparency"
        >
            <Brain className={`w-4 h-4 ${enabled ? 'animate-pulse' : ''}`} />
            <span>🧠 Agent Mode</span>
            <span
                className={`w-8 h-4 rounded-full relative transition-colors ${enabled ? 'bg-primary' : 'bg-white/20'
                    }`}
            >
                <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enabled ? 'left-4' : 'left-0.5'
                        }`}
                />
            </span>
        </button>
    );
}

export function useAgentMode(): boolean {
    const [enabled, setEnabled] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(STORAGE_KEY) === 'true';
        }
        return false;
    });

    useEffect(() => {
        const handleStorage = () => {
            setEnabled(localStorage.getItem(STORAGE_KEY) === 'true');
        };
        window.addEventListener('storage', handleStorage);

        // Also poll for changes within the same tab
        const interval = setInterval(() => {
            const current = localStorage.getItem(STORAGE_KEY) === 'true';
            if (current !== enabled) setEnabled(current);
        }, 500);

        return () => {
            window.removeEventListener('storage', handleStorage);
            clearInterval(interval);
        };
    }, [enabled]);

    return enabled;
}
