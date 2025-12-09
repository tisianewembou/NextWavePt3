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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
      stopCamera();
    };
  }, [isRecording]);

  // Camera Functions
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

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  // Timer Functions
  const startTimer = (): void =