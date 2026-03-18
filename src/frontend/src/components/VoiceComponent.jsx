import { useState, useRef } from "react";

const VoiceInput = ({ onTranscript, disabled }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    console.log("Starting speech recognition...");
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("Listening...");
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      console.log(event);
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (result.isFinal) {
          transcript += result[0].transcript;
        }
      }

      if (transcript) {
        console.log("FINAL:", transcript);
        onTranscript(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const toggleListening = () => {
    console.log("Mic clicked");
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm text-gray-500 hover:bg-gray-200 ${
        isListening ? "bg-red-200 animate-pulse text-red-600" : "bg-gray-100"
      }`}
    >
      🎤
    </button>
  );
};

export default VoiceInput;
