import React, { useState, useRef, useEffect } from 'react';

const PresentationRecorder: React.FC = () => {
  // Refs with proper types
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  
  // State with explicit types
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<string>('Click "Start Camera" to begin');
  const [cameraError, setCameraError] = useState<string>('');
  const [timer, setTimer] = useState<string>('00:00');

  // Camera Functions
  const stopCamera = (): void => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    }
  };

  const stopTimer = (): void => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      stopCamera();
    };
  }, []); // Empty dependency array - only run on mount/unmount

  const startCamera = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setIsCameraActive(true);
      setCameraError('');
      setStatus('Click to Start Recording');
    } catch (error) {
      console.error('Error accessing camera:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setCameraError(`Camera Error: ${errorMessage}`);
      setStatus('Failed to access camera');
    }
  };

  // Recording Functions
  const startRecording = (): void => {
    if (!isCameraActive || !mediaStreamRef.current) {
      setStatus('Camera not active');
      return;
    }

    recordedChunksRef.current = [];
    setRecordedBlob(null);

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(mediaStreamRef.current, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000
      });

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setStatus(`Recording complete! Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      startTimer();
      setStatus('RECORDING...');
    } catch (error) {
      console.error('Error starting recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatus('Failed to start recording: ' + errorMessage);
    }
  };

  // Timer Functions
  const startTimer = (): void => {
    recordingStartTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      if (recordingStartTimeRef.current === null) return;
      
      const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      setTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);
  };

  // Download Function
  const downloadVideo = (): void => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `presentation_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    setStatus('Video downloaded successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Presentation Video Recorder
        </h1>
        
        {/* Video Container */}
        <div className="relative w-full bg-black rounded-lg overflow-hidden mb-5 border-2 border-gray-300">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-auto block ${isCameraActive ? '' : 'hidden'}`}
            style={{ transform: 'scaleX(-1)' }}
          />
          
          {cameraError && (
            <div className="p-10 text-red-500 text-center">
              {cameraError}
            </div>
          )}
          
          {!isCameraActive && !cameraError && (
            <div className="p-10 text-gray-400 text-center">
              Camera access denied or unavailable
            </div>
          )}
          
          {/* Recording Badge */}
          {isRecording && (
            <div className="absolute top-4 right-4 bg-red-500 bg-opacity-90 text-white px-4 py-2 rounded-full font-bold animate-pulse">
              ● REC
            </div>
          )}
        </div>

        {/* Timer */}
        {isRecording && (
          <div className="text-center text-xl font-bold text-red-500 mb-4">
            {timer}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap justify-center gap-3 mb-5">
          {!isCameraActive && (
            <button
              onClick={startCamera}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
            >
              Start Camera
            </button>
          )}
          
          {isCameraActive && !isRecording && (
            <button
              onClick={startRecording}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
            >
              Start Recording
            </button>
          )}
          
          {isRecording && (
            <button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
            >
              Stop Recording
            </button>
          )}
        </div>

        {/* Download Button */}
        {recordedBlob && (
          <div className="flex justify-center mb-5">
            <button
              onClick={downloadVideo}
              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
            >
              Download Video
            </button>
          </div>
        )}

        {/* Status */}
        <div className="text-center text-lg font-semibold mb-4 min-h-[30px]">
          <span className={`inline-block w-4 h-4 rounded-full mr-2 align-middle ${
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
          }`}></span>
          {status}
        </div>
      </div>
    </div>
  );
};

export default PresentationRecorder;