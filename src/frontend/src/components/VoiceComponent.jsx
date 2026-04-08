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
      className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center transition-all duration-300 rounded-full hover:bg-gray-100/60 ${
        isListening ? "bg-red-100/50" : ""
      }`}
    >
      <img
        src={micIcon}
        alt="microphone"
        className={`w-5 h-5 object-contain transition-all duration-300 ${
          isListening
            ? "opacity-100 scale-110 animate-pulse"
            : "opacity-70 scale-100"
        }`}
      />
    </button>
  );
};

export default VoiceInput;
