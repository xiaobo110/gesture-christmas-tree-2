import * as THREE from 'three';
import { PARTICLE_CONFIG, GESTURE_THRESHOLDS } from './constants';

// 3D Noise function for explosion state
export function noise3D(x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

// Calculate tree particle positions
export function calculateTreeParticlePositions(particleCount: number): Float32Array {
  const positions = new Float32Array(particleCount * 3);
  const TREE_HEIGHT = PARTICLE_CONFIG.HEIGHT;
  const TREE_RADIUS = PARTICLE_CONFIG.RADIUS;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;

    // Tree Shape: Linear Cone with Volume-based Density Distribution
    const randomCheck = Math.random();
    const layerPct = (i / particleCount);
    
    if (randomCheck > (1 - layerPct * 0.7)) {
      const redistributedPct = Math.random() * 0.5;
      const actualLayerPct = redistributedPct;
      const layerIndex = Math.floor(actualLayerPct * 12);
      const normalizedY = layerIndex / 12;
      
      const linearFactor = 1 - normalizedY;
      const curvedFactor = Math.pow(1 - normalizedY, 1.3);
      const layerRadiusMax = TREE_RADIUS * (linearFactor * 0.8 + curvedFactor * 0.2);
      
      const GOLDEN_ANGLE = 2.399963229728653;
      const angle = i * GOLDEN_ANGLE;
      const r = layerRadiusMax * Math.sqrt(Math.random());
      
      let y = -TREE_HEIGHT / 2 + (normalizedY * TREE_HEIGHT);
      const droop = r * 0.4;
      y -= droop;
      
      const yRandomness = (Math.random() - 0.5) * 0.6;
      const depthJitter = (Math.random() - 0.5) * (0.8 + normalizedY * 1.2);
      
      positions[i3] = Math.cos(angle) * r + depthJitter * 0.3;
      positions[i3 + 1] = y + yRandomness;
      positions[i3 + 2] = Math.sin(angle) * r + depthJitter * 0.3;
    } else {
      const layerIndex = Math.floor(layerPct * 12);
      const normalizedY = layerIndex / 12;
      
      const linearFactor = 1 - normalizedY;
      const curvedFactor = Math.pow(1 - normalizedY, 1.3);
      const layerRadiusMax = TREE_RADIUS * (linearFactor * 0.8 + curvedFactor * 0.2);
      
      const minRadius = 0.2;
      const finalRadius = Math.max(minRadius, layerRadiusMax);
      
      const GOLDEN_ANGLE = 2.399963229728653;
      const angle = i * GOLDEN_ANGLE;
      const r = finalRadius * Math.sqrt(Math.random());
      
      let y = -TREE_HEIGHT / 2 + (normalizedY * TREE_HEIGHT);
      const droop = r * 0.4;
      y -= droop;
      
      const yRandomness = (Math.random() - 0.5) * 0.6;
      const depthJitter = (Math.random() - 0.5) * (0.8 + normalizedY * 1.2);
      
      positions[i3] = Math.cos(angle) * r + depthJitter * 0.3;
      positions[i3 + 1] = y + yRandomness;
      positions[i3 + 2] = Math.sin(angle) * r + depthJitter * 0.3;
    }
  }

  return positions;
}

// Calculate exploded particle positions
export function calculateExplodedParticlePositions(particleCount: number): Float32Array {
  const positions = new Float32Array(particleCount * 3);
  const spread = 60;

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const noiseX = noise3D(i, 0, 0);
    const noiseY = noise3D(0, i, 0);
    const noiseZ = noise3D(0, 0, i);
    
    positions[i3] = (noiseX - 0.5) * spread;
    positions[i3 + 1] = (noiseY - 0.5) * spread;
    positions[i3 + 2] = (noiseZ - 0.5) * spread;
  }

  return positions;
}

// Generate particle colors based on theme
export function generateParticleColors(particleCount: number, themeIndex: number): Float32Array {
  const colors = new Float32Array(particleCount * 3);
  
  const colorGold = new THREE.Color(0xFFD700);
  const colorWhite = new THREE.Color(0xFFFFFF);
  const colorRed = new THREE.Color(0xFF6B6B);
  const colorGreen = new THREE.Color(0x4ECDC4);
  const colorBlue = new THREE.Color(0x4169E1);
  const colorSilver = new THREE.Color(0xC0C0C0);
  const colorPink = new THREE.Color(0xFF69B4);
  const colorPurple = new THREE.Color(0x9370DB);

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    const rand = Math.random();
    let tempColor = new THREE.Color();

    if (themeIndex === 0) {
      // Classic Christmas theme
      if (rand > 0.7) {
        tempColor.copy(colorWhite).multiplyScalar(1.3);
      } else if (rand > 0.4) {
        tempColor.copy(colorGold).multiplyScalar(1.5);
      } else if (rand > 0.25) {
        tempColor.copy(colorRed).multiplyScalar(1.2);
      } else {
        tempColor.copy(colorGreen);
      }
    } else if (themeIndex === 1) {
      // Winter theme
      if (rand > 0.6) {
        tempColor.copy(colorWhite).multiplyScalar(1.4);
      } else if (rand > 0.3) {
        tempColor.copy(colorBlue).multiplyScalar(1.5);
      } else {
        tempColor.copy(colorSilver).multiplyScalar(1.3);
      }
    } else {
      // Dreamy theme
      if (rand > 0.6) {
        tempColor.copy(colorWhite).multiplyScalar(1.4);
      } else if (rand > 0.3) {
        tempColor.copy(colorPink).multiplyScalar(1.5);
      } else {
        tempColor.copy(colorPurple).multiplyScalar(1.3);
      }
    }

    colors[i3] = tempColor.r;
    colors[i3 + 1] = tempColor.g;
    colors[i3 + 2] = tempColor.b;
  }

  return colors;
}

// Calculate finger positions for gesture detection
export function calculateFingerStates(landmarks: any[]) {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const palmBase = landmarks[9];

  // More sensitive detection with improved thresholds
  const indexCurled = Math.abs(indexTip.y - palmBase.y) < GESTURE_THRESHOLDS.INDEX_CURLED;
  const middleCurled = Math.abs(middleTip.y - palmBase.y) < GESTURE_THRESHOLDS.MIDDLE_CURLED;
  const ringCurled = Math.abs(ringTip.y - palmBase.y) < GESTURE_THRESHOLDS.RING_CURLED;
  const pinkyCurled = Math.abs(pinkyTip.y - palmBase.y) < GESTURE_THRESHOLDS.PINKY_CURLED;
  const thumbCurled = Math.abs(thumbTip.y - palmBase.y) < GESTURE_THRESHOLDS.THUMB_CURLED;

  // Extended means clearly above palm
  const indexExtended = Math.abs(indexTip.y - palmBase.y) > GESTURE_THRESHOLDS.INDEX_EXTENDED;
  const middleExtended = Math.abs(middleTip.y - palmBase.y) > GESTURE_THRESHOLDS.MIDDLE_EXTENDED;
  const ringExtended = Math.abs(ringTip.y - palmBase.y) > GESTURE_THRESHOLDS.RING_EXTENDED;
  const pinkyExtended = Math.abs(pinkyTip.y - palmBase.y) > GESTURE_THRESHOLDS.PINKY_EXTENDED;

  const fingersCurled = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(x => x).length;
  const fingersExtended = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(x => x).length;
  const isFist = fingersCurled >= 3 && thumbCurled;

  // More lenient finger counting (1, 2, 3)
  // One finger: Only index is clearly extended, others are clearly not
  const isOneFinger = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
  
  // Two fingers: Index and middle extended, others not
  const isTwoFingers = indexExtended && middleExtended && !ringExtended && !pinkyExtended;
  
  // Three fingers: Index, middle, ring extended, pinky not
  const isThreeFingers = indexExtended && middleExtended && ringExtended && !pinkyExtended;

  return {
    wrist,
    thumbTip,
    indexTip,
    middleTip,
    ringTip,
    pinkyTip,
    palmBase,
    fingersCurled,
    fingersExtended,
    isFist,
    isOneFinger,
    isTwoFingers,
    isThreeFingers
  };
}

// Create fireworks particles with layered effect
export function createFireworkParticles(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
  themeIndex: number
) {
  const fireworks = [];
  const layers = [
    { count: 200, speed: 0.8, size: 0.8, delay: 0 },      // Outer layer: fast, large particles
    { count: 150, speed: 0.5, size: 0.6, delay: 0.1 },   // Middle layer: medium speed, medium particles
    { count: 100, speed: 0.3, size: 0.4, delay: 0.2 },   // Inner layer: slow, small particles
  ];

  layers.forEach((layer, layerIndex) => {
    setTimeout(() => {
      const FW_PARTICLES = layer.count;
      const fwGeometry = new THREE.BufferGeometry();
      const fwPositions = new Float32Array(FW_PARTICLES * 3);
      const fwVelocities = new Float32Array(FW_PARTICLES * 3);
      const fwColors = new THREE.Float32Array(FW_PARTICLES * 3);
      const fwSizes = new Float32Array(FW_PARTICLES);

      // Different colors per layer, more rich
      const fwColor1 = new THREE.Color();
      const fwColor2 = new THREE.Color();
      fwColor1.setHSL(Math.random(), 1.0, 0.6);
      fwColor2.setHSL((Math.random() + 0.3) % 1.0, 1.0, 0.7); // Complementary color

      for (let i = 0; i < FW_PARTICLES; i++) {
        fwPositions[i * 3] = x;
        fwPositions[i * 3 + 1] = y;
        fwPositions[i * 3 + 2] = z;

        // Spherical uniform distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1); // Uniform spherical distribution
        const speed = (Math.random() * 0.4 + 0.8) * layer.speed;

        fwVelocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
        fwVelocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        fwVelocities[i * 3 + 2] = Math.cos(phi) * speed;

        // Gradient colors (from color1 to color2)
        const colorMix = i / FW_PARTICLES;
        const tempColor = new THREE.Color().lerpColors(fwColor1, fwColor2, colorMix);
        
        fwColors[i * 3] = tempColor.r;
        fwColors[i * 3 + 1] = tempColor.g;
        fwColors[i * 3 + 2] = tempColor.b;
        
        // Particle size variation
        fwSizes[i] = layer.size * (0.8 + Math.random() * 0.4);
      }

      fwGeometry.setAttribute('position', new THREE.BufferAttribute(fwPositions, 3).setUsage(THREE.DynamicDrawUsage));
      fwGeometry.setAttribute('color', new THREE.BufferAttribute(fwColors, 3));
      fwGeometry.setAttribute('size', new THREE.BufferAttribute(fwSizes, 1));

      const fwMaterial = new THREE.PointsMaterial({
        size: layer.size,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        sizeAttenuation: true, // Distance attenuation
      });

      const fwParticles = new THREE.Points(fwGeometry, fwMaterial);
      scene.add(fwParticles);

      fireworks.push({
        particles: fwParticles,
        velocities: fwVelocities,
        age: 0,
        lifetime: 3.0, // Increased to 3 seconds
        active: true,
        layerIndex: layerIndex
      });
    }, layer.delay * 1000);
  });

  return fireworks;
}