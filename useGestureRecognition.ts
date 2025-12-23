import { useEffect, useRef } from 'react';
import { Results } from './types';
import { calculateFingerStates } from './utils';
import { THEME_NAMES } from './constants';

interface GestureRecognitionProps {
  onOneFingerGesture: () => void;
  onTwoFingersGesture: () => void;
  onThreeFingersGesture: () => void;
  onFistGesture: (strength: number, x: number, y: number) => void;
  onNoGesture: () => void;
  onError: (message: string) => void;
  onStatusChange: (status: 'LOADING' | 'ACTIVE' | 'ERROR') => void;
}

export const useGestureRecognition = ({
  onOneFingerGesture,
  onTwoFingersGesture,
  onThreeFingersGesture,
  onFistGesture,
  onNoGesture,
  onError,
  onStatusChange
}: GestureRecognitionProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handsInstanceRef = useRef<any>(null);
  const cameraInstanceRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  
  // Gesture state refs
  const wasOneFingerRef = useRef(false);
  const wasTwoFingersRef = useRef(false);
  const wasThreeFingersRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    const initCamera = async () => {
      try {
        let attempts = 0;
        const getCamera = () => {
          const win = window as any;
          return (
            win.Camera ||
            win.CameraUtils?.Camera ||
            (win.camera_utils && win.camera_utils.Camera) ||
            null
          );
        };

        while ((!window.Hands || !getCamera()) && attempts < 100) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          attempts++;
        }

        if (!isMountedRef.current) return;

        const CameraClass = getCamera();
        if (!window.Hands || !CameraClass) {
          onError('MediaPipe failed to load. Please check connection and refresh.');
          onStatusChange('ERROR');
          return;
        }

        handsInstanceRef.current = new window.Hands({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        handsInstanceRef.current.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        handsInstanceRef.current.onResults((results: Results) => {
          if (!isMountedRef.current) return;
          
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            
            const fingerState = calculateFingerStates(landmarks);
            if (!fingerState) return;
            
            const { 
              palmBase, 
              fingersCurled, 
              isFist, 
              isOneFinger, 
              isTwoFingers, 
              isThreeFingers 
            } = fingerState;

            // Handle gestures with priority
            if (isOneFinger && !wasOneFingerRef.current) {
              wasOneFingerRef.current = true;
              onOneFingerGesture();
            } else if (!isOneFinger) {
              wasOneFingerRef.current = false;
            }

            if (isTwoFingers && !wasTwoFingersRef.current) {
              wasTwoFingersRef.current = true;
              onTwoFingersGesture();
            } else if (!isTwoFingers) {
              wasTwoFingersRef.current = false;
            }

            if (isThreeFingers && !wasThreeFingersRef.current) {
              wasThreeFingersRef.current = true;
              onThreeFingersGesture();
            } else if (!isThreeFingers) {
              wasThreeFingersRef.current = false;
            }

            // Fist gesture for tree control
            if (isFist) {
              const strength = fingersCurled / 4.0;
              onFistGesture(strength, palmBase.x, palmBase.y);
            } else if (!isFist && !isOneFinger && !isTwoFingers && !isThreeFingers) {
              onNoGesture();
            }
          } else {
            // No hands
            onNoGesture();
          }
        });

        if (videoRef.current) {
          const CameraClass = getCamera();
          cameraInstanceRef.current = new CameraClass(videoRef.current, {
            onFrame: async () => {
              if (handsInstanceRef.current && videoRef.current) {
                await handsInstanceRef.current.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480,
          });
          await cameraInstanceRef.current.start();
          if (isMountedRef.current) onStatusChange('ACTIVE');
        }
      } catch (e: any) {
        console.error(e);
        if (isMountedRef.current) {
          onStatusChange('ERROR');
          onError('Camera access denied. Please allow camera permissions.');
        }
      }
    };

    initCamera();

    return () => {
      isMountedRef.current = false;
      if (handsInstanceRef.current) {
        handsInstanceRef.current.close();
        handsInstanceRef.current = null;
      }
      if (cameraInstanceRef.current) {
        cameraInstanceRef.current.stop();
        cameraInstanceRef.current = null;
      }
    };
  }, []);

  return { videoRef };
};