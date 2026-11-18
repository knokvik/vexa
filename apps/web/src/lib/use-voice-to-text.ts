"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

interface WindowWithSpeech {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WindowWithSpeech;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseVoiceToTextOptions {
  /**
   * Called with the updated full transcript text as user speaks or finishes.
   */
  onTranscriptChange?: (text: string) => void;
  /**
   * Initial base text to prepend speech to.
   */
  initialText?: string;
  /**
   * Language code (defaults to browser language or en-US)
   */
  lang?: string;
}

export function useVoiceToText({
  onTranscriptChange,
  initialText = "",
  lang,
}: UseVoiceToTextOptions = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isHoldingRef = useRef(false);
  const baseTextRef = useRef(initialText);
  const callbackRef = useRef(onTranscriptChange);
  callbackRef.current = onTranscriptChange;

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const stopListening = useCallback(() => {
    isHoldingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const startListening = useCallback(
    (currentBaseText?: string) => {
      const Ctor = getSpeechRecognitionConstructor();
      if (!Ctor) {
        setError("Speech recognition is not supported in this browser. Try Chrome, Edge, or Safari.");
        return;
      }

      setError(null);
      isHoldingRef.current = true;
      const base = currentBaseText !== undefined ? currentBaseText : baseTextRef.current;
      baseTextRef.current = base;

      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }

      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = lang || (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";

      let accumulatedFinal = "";

      rec.onresult = (ev: SpeechRecognitionEventLike) => {
        let currentFinalChunk = "";
        let currentInterimChunk = "";

        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const transcript = res[0]?.transcript || "";
          if (res.isFinal) {
            currentFinalChunk += transcript;
          } else {
            currentInterimChunk += transcript;
          }
        }

        if (currentFinalChunk) {
          accumulatedFinal = (accumulatedFinal + " " + currentFinalChunk).trim();
          setFinalTranscript(accumulatedFinal);
          const fullText = (base + " " + accumulatedFinal).trim();
          baseTextRef.current = fullText;
          callbackRef.current?.(fullText);
          setInterimTranscript("");
        } else if (currentInterimChunk) {
          setInterimTranscript(currentInterimChunk);
          const previewText = (base + " " + (accumulatedFinal ? accumulatedFinal + " " : "") + currentInterimChunk).trim();
          callbackRef.current?.(previewText);
        }
      };

      rec.onerror = (ev) => {
        if (ev.error !== "no-speech" && ev.error !== "aborted") {
          setError(`Microphone error: ${ev.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        // If user was still holding or expecting to keep listening, restart if needed
        if (isHoldingRef.current) {
          try {
            rec.start();
            return;
          } catch {
            /* ignore */
          }
        }
        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = rec;

      try {
        rec.start();
        setIsListening(true);
      } catch (err) {
        setError("Failed to start voice recognition.");
        setIsListening(false);
      }
    },
    [lang]
  );

  const toggleListening = useCallback(
    (currentBaseText?: string) => {
      if (isListening) {
        stopListening();
      } else {
        startListening(currentBaseText);
      }
    },
    [isListening, startListening, stopListening]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
  };
}
