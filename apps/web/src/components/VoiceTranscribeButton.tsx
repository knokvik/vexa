"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceToText } from "@/lib/use-voice-to-text";

export interface VoiceTranscribeButtonProps {
  /**
   * Called whenever live text changes (both interim speech and final transcription)
   */
  onTranscript: (text: string) => void;
  /**
   * Base/current input text
   */
  currentValue?: string;
  /**
   * Size variant
   */
  size?: "sm" | "default" | "lg";
  className?: string;
  placeholderHint?: string;
}

/**
 * ChatGPT / Kimi style voice-to-text button:
 * - Click to toggle continuous live transcription
 * - Hold-to-talk (press and hold, speaks, release to stop)
 * - Animated acoustic sound wave equalizer while listening
 */
export function VoiceTranscribeButton({
  onTranscript,
  currentValue = "",
  size = "default",
  className,
  placeholderHint = "Hold or click to speak…",
}: VoiceTranscribeButtonProps) {
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);
  const isHolding = useRef(false);

  const {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
  } = useVoiceToText({
    onTranscriptChange: onTranscript,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary pointer (left mouse or touch)
    if (e.button !== 0) return;
    
    // Set a short threshold to detect hold vs click
    const timer = setTimeout(() => {
      isHolding.current = true;
      if (!isListening) {
        startListening(currentValue);
      }
    }, 220);
    setPressTimer(timer);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }

    if (isHolding.current) {
      // It was a hold-to-talk interaction: release stops transcription
      isHolding.current = false;
      stopListening();
    } else {
      // It was a tap/click: toggle continuous listening
      toggleListening(currentValue);
    }
  };

  const handlePointerCancel = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
    if (isHolding.current) {
      isHolding.current = false;
      stopListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  const sizeClasses = {
    sm: "size-6 text-[10px]",
    default: "size-7 text-xs",
    lg: "size-9 text-sm",
  }[size];

  const iconSizeClasses = {
    sm: "size-3",
    default: "size-3.5",
    lg: "size-4",
  }[size];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        title={isListening ? "Listening… Click or release to stop" : "Hold to talk or click to transcribe"}
        aria-label={isListening ? "Stop voice transcription" : "Start voice transcription"}
        className={cn(
          "relative flex items-center justify-center rounded-full transition-all duration-200 select-none",
          sizeClasses,
          isListening
            ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] ring-2 ring-red-400/50 animate-pulse"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          className
        )}
      >
        {isListening ? (
          <div className="flex items-center justify-center gap-0.5">
            <span className="size-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1 bg-white rounded-full animate-bounce" />
          </div>
        ) : (
          <Mic className={iconSizeClasses} />
        )}
      </button>

      {/* Floating soundwave indicator tooltip when actively listening */}
      {isListening && (
        <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-background/95 border border-red-500/40 px-2.5 py-1 shadow-lg backdrop-blur-md whitespace-nowrap text-[11px] font-medium text-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-red-500" />
          </span>
          <div className="vexa-wave-bars flex h-3 items-center gap-0.5">
            <span className="w-0.5 h-full rounded bg-red-500 [animation-delay:0.1s]" />
            <span className="w-0.5 h-full rounded bg-red-500 [animation-delay:0.3s]" />
            <span className="w-0.5 h-full rounded bg-red-500 [animation-delay:0.2s]" />
            <span className="w-0.5 h-full rounded bg-red-500 [animation-delay:0.4s]" />
          </div>
          <span>Listening…</span>
        </div>
      )}
    </div>
  );
}
