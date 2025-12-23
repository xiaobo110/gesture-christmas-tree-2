import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { gsap } from 'gsap';
import { PARTICLE_CONFIG, RENDER_CONFIG, ANIMATION_CONFIG, SNOW_CONFIG, FIREWORKS_CONFIG } from './constants';
import { 
  calculateTreeParticlePositions, 
  calculateExplodedParticlePositions, 
  generateParticleColors,
  createFireworkParticles
} from './utils';

// Custom Shader Material for glowing golden particles
const particleVertexShader = `
  attribute float size;
  attribute float alpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSize;
  
  void main() {
    vColor = color;
    vAlpha = alpha;
    vSize = size;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  uniform float time;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSize;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    
    // Enhanced glowing effect with softer, brighter edges
    float alpha = vAlpha * (1.0 - smoothstep(0.0, 0.6, dist));
    
    // Multiple twinkle frequencies for rich sparkle effect
    float twinkle1 = sin(time * 4.0 + vSize * 15.0) * 0.4 + 0.6;
    float twinkle2 = sin(time * 6.5 + vSize * 8.0) * 0.3 + 0.7;
    float twinkle3 = sin(time * 2.0 + vSize * 20.0) * 0.2 + 0.8;
    float combinedTwinkle = (twinkle1 + twinkle2 + twinkle3) / 3.0;
    
    // Preserve original colors while adding sparkle
    // Only apply golden tint to particles that are already gold/yellow
    float isGold = step(0.5, vColor.r + vColor.g - vColor.b); // Detect gold/yellow colors
    vec3 goldenBoost = vec3(1.0, 0.9, 0.6);
    vec3 colorBoost = mix(vColor, vColor * goldenBoost, isGold * 0.6); // Only boost gold colors
    
    vec3 sparkleColor = colorBoost * (1.0 + combinedTwinkle * 0.8);
    
    // Add inner glow for extra shine (white glow, preserves color)
    float innerGlow = 1.0 - smoothstep(0.0, 0.3, dist);
    sparkleColor += vec3(1.0, 1.0, 1.0) * innerGlow * 0.3; // White glow, less intense
    
    alpha *= (0.8 + combinedTwinkle * 0.4);
    
    gl_FragColor = vec4(sparkleColor, alpha);
  }
`;

export interface ParticleSystemConfig {
  container: HTMLElement;
  onWindowResize: () => void;
  onParticleUpdate: (positions: Float32Array, velocities: Float32Array, targetTree: Float32Array, targetExploded: Float32Array) => void;
}

export class ThreeScene {
  // Core Three.js objects
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;

  // Particle system
  private particles: THREE.Points;
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.ShaderMaterial;
  private treeGroup: THREE.Group;
  private star: THREE.Sprite;
  private trunk: THREE.Mesh;
  private snowParticles: THREE.Points;
  private snowGeometry: THREE.BufferGeometry;

  // Particle data
  private positions: Float32Array;
  private velocities: Float32Array;
  private targetTree: Float32Array;
  private targetExploded: Float32Array;
  private sizes: Float32Array;
  private alphas: Float32Array;

  // Animation state
  private time: number = 0;
  private isPinching: boolean = false;
  private pinchStrength: number = 0;
  private rotationTarget: { x: number; y: number } = { x: 0, y: 0 };
  private rotationCurrent: { x: number; y: number } = { x: 0, y: 0 };
  private colorTheme: number = 0;
  private isSnowing: boolean = false;

  // Fireworks
  private fireworks: any[] = [];

  // Animation frame ID
  private animationFrameId: number | null = null;

  constructor(private config: ParticleSystemConfig) {
    this.initScene();
    this.setupParticleSystem();
    this.setupLighting();
    this.setupSnow();
    this.animate();
    this.setupEventListeners();
  }

  private initScene() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, RENDER_CONFIG.FOG_DENSITY);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      RENDER_CONFIG.CAMERA_FOV,
      window.innerWidth / window.innerHeight,
      RENDER_CONFIG.CAMERA_NEAR,
      RENDER_CONFIG.CAMERA_FAR
    );
    this.camera.position.set(0, 0, 35);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000);
    this.config.container.appendChild(this.renderer.domElement);

    // Post-processing setup (UnrealBloomPass for cinematic glow)
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      RENDER_CONFIG.BLOOM_STRENGTH,
      RENDER_CONFIG.BLOOM_RADIUS,
      RENDER_CONFIG.BLOOM_THRESHOLD
    );
    this.composer.addPass(bloomPass);
  }

  private setupParticleSystem() {
    // Initialize particle positions and targets
    this.positions = calculateExplodedParticlePositions(PARTICLE_CONFIG.COUNT);
    this.velocities = new Float32Array(PARTICLE_CONFIG.COUNT * 3);
    this.targetTree = calculateTreeParticlePositions(PARTICLE_CONFIG.COUNT);
    this.targetExploded = calculateExplodedParticlePositions(PARTICLE_CONFIG.COUNT);
    const colors = generateParticleColors(PARTICLE_CONFIG.COUNT, this.colorTheme);
    this.sizes = new Float32Array(PARTICLE_CONFIG.COUNT);
    this.alphas = new Float32Array(PARTICLE_CONFIG.COUNT);

    // Initialize sizes and alphas
    for (let i = 0; i < PARTICLE_CONFIG.COUNT; i++) {
      this.sizes[i] = 0.8 + Math.random() * 0.6;
      this.alphas[i] = 0.7 + Math.random() * 0.3;
    }

    // Create geometry
    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));

    // Create custom shader material
    this.particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
      },
      vertexShader: particleVertexShader,
      fragmentShader: particleFragmentShader,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true,
    });

    // Create particles and group
    this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.treeGroup = new THREE.Group();
    this.treeGroup.add(this.particles);
    this.treeGroup.position.y = 2; // Move up 2 units for balance
    this.scene.add(this.treeGroup);

    // Create star sprite
    this.createStarSprite();

    // Create tree trunk
    this.createTreeTrunk();

    // Notify parent about particle data
    this.config.onParticleUpdate(this.positions, this.velocities, this.targetTree, this.targetExploded);
  }

  private createStarSprite() {
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 128;
    starCanvas.height = 128;
    const starCtx = starCanvas.getContext('2d');
    if (starCtx) {
      const grad = starCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(255, 215, 0, 0.9)');
      grad.addColorStop(0.6, 'rgba(255, 215, 0, 0.3)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      starCtx.fillStyle = grad;
      starCtx.fillRect(0, 0, 128, 128);
    }
    const starTexture = new THREE.CanvasTexture(starCanvas);
    const starMaterial = new THREE.SpriteMaterial({
      map: starTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    this.star = new THREE.Sprite(starMaterial);
    this.star.scale.set(0, 0, 1);
    this.star.position.set(0, PARTICLE_CONFIG.HEIGHT / 2 + 0.5, 0);
    this.treeGroup.add(this.star);
  }

  private createTreeTrunk() {
    const trunkGeometry = new THREE.CylinderGeometry(1.0, 1.6, 9, 16);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4A2511, // Dark brown
      roughness: 0.9,
      metalness: 0.1,
    });
    this.trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    this.trunk.position.set(0, -PARTICLE_CONFIG.HEIGHT / 2 - 4.5, 0);
    this.trunk.visible = false;
    this.treeGroup.add(this.trunk);
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);
  }

  private setupSnow() {
    this.snowGeometry = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(SNOW_CONFIG.COUNT * 3);
    
    for (let i = 0; i < SNOW_CONFIG.COUNT; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 60;
      snowPositions[i * 3 + 1] = Math.random() * 40 + 10;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    
    this.snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3).setUsage(THREE.DynamicDrawUsage));
    
    const snowMaterial = new THREE.PointsMaterial({
      size: SNOW_CONFIG.SIZE,
      color: 0xffffff,
      transparent: true,
      opacity: SNOW_CONFIG.OPACITY,
      blending: THREE.AdditiveBlending,
    });
    
    this.snowParticles = new THREE.Points(this.snowGeometry, snowMaterial);
    this.snowParticles.visible = false;
    this.scene.add(this.snowParticles);
  }

  private setupEventListeners() {
    window.addEventListener('resize', this.config.onWindowResize);
  }

  public updatePinchState(isPinching: boolean, strength: number) {
    this.isPinching = isPinching;
    this.pinchStrength = strength;
  }

  public updateRotationTarget(x: number, y: number) {
    this.rotationTarget = { x, y };
  }

  public updateRotationCurrent(x: number, y: number) {
    this.rotationCurrent = { x, y };
  }

  public updateColorTheme(themeIndex: number) {
    this.colorTheme = themeIndex;
    const colors = generateParticleColors(PARTICLE_CONFIG.COUNT, themeIndex);
    
    if (this.particleGeometry.attributes.color) {
      (this.particleGeometry.attributes.color.array as Float32Array).set(colors);
      this.particleGeometry.attributes.color.needsUpdate = true;
    }
  }

  public toggleSnow(visible: boolean) {
    this.isSnowing = visible;
    this.snowParticles.visible = visible;
  }

  public createFireworks(x: number, y: number, z: number) {
    const newFireworks = createFireworkParticles(this.scene, x, y, z, this.colorTheme);
    this.fireworks.push(...newFireworks);
  }

  private tempVec3a = new THREE.Vector3();
  private tempVec3b = new THREE.Vector3();
  
  public update(timeDelta: number) {
    this.time += timeDelta;

    // Update shader time
    this.particleMaterial.uniforms.time.value = this.time;

    // Update particles physics
    const gravityStrength = ANIMATION_CONFIG.GRAVITY_STRENGTH;
    const explosionStrength = ANIMATION_CONFIG.EXPLOSION_STRENGTH;
    const damping = ANIMATION_CONFIG.DAMPING;
    const brownMotion = ANIMATION_CONFIG.BROWN_MOTION;
    
    for (let i = 0; i < PARTICLE_CONFIG.COUNT; i++) {
      const i3 = i * 3;
      const x = this.positions[i3];
      const y = this.positions[i3 + 1];
      const z = this.positions[i3 + 2];

      let targetX, targetY, targetZ;
      
      if (this.pinchStrength > 0.01) {
        targetX = this.targetTree[i3];
        targetY = this.targetTree[i3 + 1];
        targetZ = this.targetTree[i3 + 2];

        // Use temp vectors to avoid object allocation
        this.tempVec3a.set(targetX - x, targetY - y, targetZ - z);
        const dist = this.tempVec3a.length();

        if (dist > 0.01) {
          const force = gravityStrength * this.pinchStrength;
          const normalizedForce = force / dist; // Avoid normalization call
          this.velocities[i3] += this.tempVec3a.x * normalizedForce;
          this.velocities[i3 + 1] += this.tempVec3a.y * normalizedForce;
          this.velocities[i3 + 2] += this.tempVec3a.z * normalizedForce;
        }
      } else {
        targetX = this.targetExploded[i3];
        targetY = this.targetExploded[i3 + 1];
        targetZ = this.targetExploded[i3 + 2];

        // Use temp vectors to avoid object allocation
        this.tempVec3b.set(targetX - x, targetY - y, targetZ - z);
        const dist = this.tempVec3b.length();

        if (dist > 0.01) {
          const force = explosionStrength;
          const normalizedForce = force / dist; // Avoid normalization call
          this.velocities[i3] += this.tempVec3b.x * normalizedForce;
          this.velocities[i3 + 1] += this.tempVec3b.y * normalizedForce;
          this.velocities[i3 + 2] += this.tempVec3b.z * normalizedForce;
        }

        this.velocities[i3] += (Math.random() - 0.5) * brownMotion;
        this.velocities[i3 + 1] += (Math.random() - 0.5) * brownMotion;
        this.velocities[i3 + 2] += (Math.random() - 0.5) * brownMotion;
      }

      this.velocities[i3] *= damping;
      this.velocities[i3 + 1] *= damping;
      this.velocities[i3 + 2] *= damping;

      this.positions[i3] += this.velocities[i3];
      this.positions[i3 + 1] += this.velocities[i3 + 1];
      this.positions[i3 + 2] += this.velocities[i3 + 2];
    }

    this.particleGeometry.attributes.position.needsUpdate = true;

    // Update star animation
    const targetScale = this.isPinching ? 5 + Math.sin(this.time * 4) * 1.5 : 0;
    gsap.to(this.star.scale, {
      x: targetScale,
      y: targetScale,
      duration: 0.5,
      ease: 'power2.out',
    });

    // Update trunk animation
    this.trunk.visible = this.isPinching;
    this.trunk.rotation.y += 0.001;

    // Update snow animation
    if (this.snowParticles.visible) {
      const snowPos = this.snowParticles.geometry.attributes.position.array as Float32Array;
      const SNOW_COUNT = SNOW_CONFIG.COUNT;
      
      // Pre-calculate time-based values to avoid repeated calculations
      const time = this.time;
      
      for (let i = 0; i < SNOW_COUNT; i++) {
        const i3 = i * 3;
        snowPos[i3 + 1] -= 0.05 + Math.sin(time + i) * 0.02;
        snowPos[i3] += Math.sin(time * 0.5 + i) * 0.02;
        
        if (snowPos[i3 + 1] < -15) {
          snowPos[i3 + 1] = 40;
          snowPos[i3] = (Math.random() - 0.5) * 60;
          snowPos[i3 + 2] = (Math.random() - 0.5) * 60;
        }
      }
      this.snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Update fireworks animation
    this.updateFireworks();

    // Update rotation
    const targetRotX = this.rotationTarget.y * ANIMATION_CONFIG.ROTATION_SPEED_X;
    const targetRotY = -this.rotationTarget.x * ANIMATION_CONFIG.ROTATION_SPEED_Y;

    if (this.isPinching) {
      gsap.to(this.rotationCurrent, {
        x: targetRotX,
        y: targetRotY,
        duration: 0.8,
        ease: 'power2.out',
      });
    } else {
      this.rotationCurrent.y += 0.002;
    }

    this.treeGroup.rotation.x = this.rotationCurrent.x;
    this.treeGroup.rotation.y = this.rotationCurrent.y;
  }

  private updateFireworks() {
    // Iterate directly through fireworks array to avoid creating a new array
    for (let i = 0; i < this.fireworks.length; i++) {
      const fw = this.fireworks[i];
      
      if (!fw.active) continue;
      
      fw.age += 0.016;
      if (fw.age > fw.lifetime) {
        fw.active = false;
        if (fw.particles) {
          this.scene.remove(fw.particles);
          fw.particles.geometry.dispose();
          (fw.particles.material as THREE.Material).dispose();
        }
        continue;
      }
      
      if (fw.particles) {
        const positions = fw.particles.geometry.attributes.position.array as Float32Array;
        const velocities = fw.velocities;
        const colors = fw.particles.geometry.attributes.color.array as Float32Array;
        
        const positionCount = positions.length / 3;
        const lifetime = fw.lifetime;
        
        for (let j = 0; j < positionCount; j++) {
          const j3 = j * 3;
          
          // Update position
          positions[j3] += velocities[j3];
          positions[j3 + 1] += velocities[j3 + 1];
          positions[j3 + 2] += velocities[j3 + 2];
          
          // Gravity effect (enhanced)
          velocities[j3 + 1] -= FIREWORKS_CONFIG.GRAVITY;
          
          // Air resistance
          velocities[j3] *= FIREWORKS_CONFIG.AIR_RESISTANCE;
          velocities[j3 + 1] *= FIREWORKS_CONFIG.AIR_RESISTANCE;
          velocities[j3 + 2] *= FIREWORKS_CONFIG.AIR_RESISTANCE;
          
          // Pre-calculate age factor once
          const ageFactor = fw.age / lifetime;
          if (ageFactor > 0.5) {
            const whiteMix = (ageFactor - 0.5) * 0.6; // Gradually brighten in the second half
            colors[j3] = colors[j3] * (1 - whiteMix) + whiteMix;
            colors[j3 + 1] = colors[j3 + 1] * (1 - whiteMix) + whiteMix;
            colors[j3 + 2] = colors[j3 + 2] * (1 - whiteMix) + whiteMix;
          }
        }
        
        fw.particles.geometry.attributes.position.needsUpdate = true;
        fw.particles.geometry.attributes.color.needsUpdate = true;
        
        // Non-linear opacity fade (bright first, then quickly disappear)
        const ageFactor = fw.age / lifetime;
        const opacity = ageFactor < 0.7 ? 1.0 : (1 - (ageFactor - 0.7) / 0.3);
        (fw.particles.material as THREE.PointsMaterial).opacity = opacity;
      }
    }
    
    // Filter out inactive fireworks
    this.fireworks = this.fireworks.filter(fw => fw.active);
  }

  private animate = () => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.update(0.016);
    this.composer.render();
  };

  public updateSize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  public dispose() {
    // Cancel animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove event listeners
    window.removeEventListener('resize', this.config.onWindowResize);

    // Dispose geometries
    this.particleGeometry.dispose();
    this.snowGeometry.dispose();

    // Dispose materials
    this.particleMaterial.dispose();
    (this.star.material as THREE.Material).dispose();
    (this.trunk.material as THREE.Material).dispose();

    // Dispose textures
    if ((this.star.material as THREE.SpriteMaterial).map) {
      (this.star.material as THREE.SpriteMaterial).map!.dispose();
    }

    // Dispose composer passes
    this.composer.passes.forEach(pass => {
      if (pass && pass.dispose) pass.dispose();
    });
    this.composer.renderPass?.dispose?.();
    this.composer.dispose();

    // Dispose renderer
    this.renderer.dispose();

    // Remove from DOM
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}