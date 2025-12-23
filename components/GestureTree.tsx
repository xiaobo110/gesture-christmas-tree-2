import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { Landmark, Results } from '../types';
import { ThreeScene } from '../ThreeScene';
import { PARTICLE_CONFIG, THEME_NAMES, COLOR_THEMES } from '../constants';
import { calculateFingerStates } from '../utils';
import { useGestureRecognition } from '../useGestureRecognition';

const GestureTree: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // UI States
  const [cameraStatus, setCameraStatus] = useState<'LOADING' | 'ACTIVE' | 'ERROR'>('LOADING');
  const [interactionState, setInteractionState] = useState<'IDLE' | 'PINCHING'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<string>(COLOR_THEMES.CLASSIC);

  // Logic Refs
  const isPinchingRef = useRef(false);
  const pinchStrengthRef = useRef(0);
  const rotationTargetRef = useRef({ x: 0, y: 0 });
  const rotationCurrentRef = useRef({ x: 0, y: 0 });
  const colorThemeRef = useRef(0);
  const isSnowingRef = useRef(false);
  
  // Three.js Scene
  const threeSceneRef = useRef<ThreeScene | null>(null);

  // 1. Initialize Three.js with Post-Processing
  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = () => {
      if (threeSceneRef.current) {
        threeSceneRef.current.updateSize();
      }
    };

    // Initialize ThreeScene
    threeSceneRef.current = new ThreeScene({
      container: containerRef.current,
      onWindowResize: handleResize,
      onParticleUpdate: (positions, velocities, targetTree, targetExploded) => {
        // Store references for gesture interaction
        // These would be used if we need direct access to particle data
      }
    });

    return () => {
      if (threeSceneRef.current) {
        threeSceneRef.current.dispose();
        threeSceneRef.current = null;
      }
    };
  }, []);

  // 2. Initialize MediaPipe with custom hook
  const { videoRef } = useGestureRecognition({
    onOneFingerGesture: () => {
      // 1 finger: 切换颜色主题
      const oldTheme = colorThemeRef.current;
      const newTheme = (oldTheme + 1) % 3;
      colorThemeRef.current = newTheme;

      setCurrentTheme(THEME_NAMES[newTheme]);

      if (threeSceneRef.current) {
        threeSceneRef.current.updateColorTheme(newTheme);
      }
    },
    onTwoFingersGesture: () => {
      // 2 fingers: 飘雪
      if (!isSnowingRef.current) {
        isSnowingRef.current = true;

        if (threeSceneRef.current) {
          threeSceneRef.current.toggleSnow(true);
        }

        setTimeout(() => {
          isSnowingRef.current = false;
          if (threeSceneRef.current) {
            threeSceneRef.current.toggleSnow(false);
          }
        }, 10000);
      }
    },
    onThreeFingersGesture: () => {
      // 3 fingers: 烟花 - 多层爆炸效果
      // Note: palmBase coordinates are not available here, will be handled in onFistGesture
      if (threeSceneRef.current) {
        threeSceneRef.current.createFireworks(
          0, // Default x position
          0, // Default y position
          0  // Default z position
        );
      }
    },
    onFistGesture: (strength, palmX, palmY) => {
      gsap.to(pinchStrengthRef, {
        current: strength,
        duration: 0.3,
        ease: 'power2.out',
      });
      isPinchingRef.current = true;
      setInteractionState('PINCHING');
      
      const cx = palmX;
      const cy = palmY;
      
      // Update ThreeScene with new state
      if (threeSceneRef.current) {
        threeSceneRef.current.updatePinchState(true, strength);
        threeSceneRef.current.updateRotationTarget(
          (cx - 0.5) * 2,
          (cy - 0.5) * 2
        );
      }
    },
    onNoGesture: () => {
      gsap.to(pinchStrengthRef, {
        current: 0,
        duration: 0.5,
        ease: 'power2.out',
      });
      isPinchingRef.current = false;
      setInteractionState('IDLE');
      
      // Update ThreeScene with new state
      if (threeSceneRef.current) {
        threeSceneRef.current.updatePinchState(false, 0);
      }
    },
    onError: (message) => {
      setErrorMessage(message);
      setCameraStatus('ERROR');
    },
    onStatusChange: (status) => {
      setCameraStatus(status);
    }
  });

  return (
    <div className="relative w-full h-full bg-black">
      <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden" />
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none p-6 flex flex-col justify-between">
        <div className="flex justify-between items-start w-full">
            <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-xl">
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600">
                    圣诞树
                </h1>
                <div className="mt-2 text-sm text-gray-300 font-mono">
                    <div className="flex items-center gap-2">
                <span className="text-xl">✊</span>
                <span>握拳形成圣诞树并旋转</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                <span>张开手爆炸散开</span>
              </div>
              <div className="mt-3 pt-2 border-t border-white/10">
                <div className="text-xs text-gray-400 mb-1">手指数量：</div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">☝️</span>
                  <span>1根手指切换颜色</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl">✌️</span>
                  <span>2根手指飘雪</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl">🤟</span>
                  <span>3根手指烟花</span>
                </div>
                    </div>
                </div>
            </div>

          <div className="flex flex-col gap-2 items-end">
            <div
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md font-bold text-xs tracking-wider shadow-lg
                ${cameraStatus === 'ACTIVE' ? 'border-green-500/30 bg-green-900/30 text-green-400' : ''}
                ${cameraStatus === 'LOADING' ? 'border-blue-500/30 bg-blue-900/30 text-blue-400' : ''}
                ${cameraStatus === 'ERROR' ? 'border-red-500/30 bg-red-900/30 text-red-400' : ''}
              `}
            >
                <span className={`flex h-3 w-3 relative`}>
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    cameraStatus === 'ACTIVE'
                      ? 'bg-green-400'
                      : cameraStatus === 'LOADING'
                      ? 'bg-blue-400'
                      : 'bg-red-400'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    cameraStatus === 'ACTIVE'
                      ? 'bg-green-500'
                      : cameraStatus === 'LOADING'
                      ? 'bg-blue-500'
                      : 'bg-red-500'
                  }`}
                ></span>
                </span>
              {cameraStatus === 'LOADING'
                ? '视觉系统初始化中...'
                : cameraStatus === 'ACTIVE'
                ? '视觉系统运行中'
                : '视觉系统错误'}
            </div>

            <div className="px-4 py-2 rounded-full border border-purple-500/30 bg-purple-900/30 backdrop-blur-md font-bold text-xs tracking-wider shadow-lg text-purple-300">
              当前主题: {currentTheme}
            </div>
            </div>
        </div>

        <div
          className={`
            absolute top-10 left-1/2 transform -translate-x-1/2
            transition-all duration-500 ease-out pointer-events-none
            ${interactionState === 'PINCHING' ? 'scale-110 opacity-100' : 'scale-50 opacity-0'}
        `}
        >
             <div className="text-6xl font-black text-yellow-100 drop-shadow-[0_0_30px_rgba(255,215,0,0.8)] tracking-tighter mix-blend-screen">
                 圣诞 快乐
             </div>
        </div>

        {errorMessage && (
            <div className="self-center bg-red-950/90 text-white p-6 rounded-xl border border-red-500 shadow-2xl pointer-events-auto max-w-md text-center">
                <div className="text-4xl mb-2">⚠️</div>
                <h3 className="font-bold text-lg mb-2">System Error</h3>
                <p className="text-red-200 mb-4">{errorMessage}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded transition-colors w-full font-bold"
                >
                    RETRY
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default GestureTree;