import { useState, useRef } from "react";
import micIcon from "../assets/microphone.png";

const VoiceInput = ({ onTranscript, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const finalTranscriptRef = useRef("");

  const startRecognition = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false; // important: finalize each phrase
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      finalTranscriptRef.current = "";
      startSilenceTimer();
    };

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
      }
      if (finalText) {
        finalTranscriptRef.current += " " + finalText;
      }

      // Reset timer whenever speech is detected
      resetSilenceTimer();
    };

    recognition.onerror = (err) => {
      console.error("Speech recognition error", err);
      stopRecognition();
    };

    recognition.onend = () => {
      const message = finalTranscriptRef.current.trim();
      if (message) {
        onTranscript(message);
        finalTranscriptRef.current = "";
      }

      // If still listening, restart automatically to keep capturing speech
      if (isListening) startRecognition();
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecognition = () => {
    setIsListening(false);
    if (recognitionRef.current) recognitionRef.current.stop();
    clearSilenceTimer();
  };

  const toggleListening = () => {
    if (isListening) stopRecognition();
    else startRecognition();
  };

  // --- Silence timer ---
  const startSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      stopRecognition(); // triggers onend → sends transcript
    }, 5000); // 5 seconds of silence
  };

  const resetSilenceTimer = () => startSilenceTimer();

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center transition-transform active:scale-90 ${
        isListening ? "animate-pulse" : ""
      }`}
    >
      {/* Clean SVG Microphone Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor" // Inherits text color
        className={`w-6 h-6 transition-colors duration-300 ${
          isListening ? "text-red-500" : "text-gray-400 hover:text-gray-600"
        }`}
      >
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
      </svg>
    </button>
  );
};

export default VoiceInput;
