// Particle system constants
export const PARTICLE_CONFIG = {
  COUNT: 5000,
  HEIGHT: 25,
  RADIUS: 10,
} as const;

// Three.js rendering constants
export const RENDER_CONFIG = {
  CAMERA_FOV: 60,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  FOG_DENSITY: 0.02,
  BLOOM_STRENGTH: 2.2,
  BLOOM_RADIUS: 0.5,
  BLOOM_THRESHOLD: 0.7,
} as const;

// Animation constants
export const ANIMATION_CONFIG = {
  GRAVITY_STRENGTH: 0.35,
  EXPLOSION_STRENGTH: 0.25,
  DAMPING: 0.90,
  BROWN_MOTION: 0.03,
  ROTATION_SPEED_X: 1.8,
  ROTATION_SPEED_Y: 2.5,
} as const;

// Color themes
export const COLOR_THEMES = {
  CLASSIC: '经典圣诞',
  WINTER: '冰雪奇缘',
  DREAMY: '梦幻粉紫',
} as const;

export const THEME_NAMES = [COLOR_THEMES.CLASSIC, COLOR_THEMES.WINTER, COLOR_THEMES.DREAMY] as const;

// Snow particles
export const SNOW_CONFIG = {
  COUNT: 1000,
  SIZE: 0.3,
  OPACITY: 0.8,
} as const;

// Fireworks
export const FIREWORKS_CONFIG = {
  LIFETIME: 3.0,
  GRAVITY: 0.015,
  AIR_RESISTANCE: 0.97,
} as const;

// Gesture detection thresholds
export const GESTURE_THRESHOLDS = {
  INDEX_CURLED: 0.12,
  MIDDLE_CURLED: 0.12,
  RING_CURLED: 0.12,
  PINKY_CURLED: 0.12,
  THUMB_CURLED: 0.18,
  INDEX_EXTENDED: 0.15,
  MIDDLE_EXTENDED: 0.15,
  RING_EXTENDED: 0.15,
  PINKY_EXTENDED: 0.15,
} as const;