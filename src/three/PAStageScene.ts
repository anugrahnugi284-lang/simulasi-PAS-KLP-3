import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COMPONENT_DETAILS, NODE_DETAILS } from '../data/paSystemData';
import type {
  CameraMode,
  ComponentId,
  NodeKey,
  SimulationState,
  TelemetrySnapshot,
} from '../types/simulation';

interface LayerItem {
  mesh: THREE.Object3D;
  baseX: number;
}

interface SignalParticle {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  t: number;
}

interface WaveRing {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  phase: number;
}

const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _box3 = new THREE.Box3();
const _partBox = new THREE.Box3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface PAStageCallbacks {
  onSelectNode: (node: NodeKey) => void;
  onSelectComponent: (componentId: ComponentId | null, parentNode?: NodeKey) => void;
  onHoverComponent: (componentId: ComponentId | null, clientX: number, clientY: number) => void;
  onTelemetryTick: (telemetry: TelemetrySnapshot) => void;
  onContextLost?: (lost: boolean) => void;
}

export class PAStageScene {
  private container: HTMLElement;
  private callbacks: PAStageCallbacks;
  private isSoftwareGl: boolean;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private envMap: THREE.Texture | null = null;
  private contactShadowTex: THREE.CanvasTexture;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerDownPos = new THREE.Vector2();
  private clickableMeshes: THREE.Mesh[] = [];
  private componentMeshes = new Map<ComponentId, THREE.Mesh[]>();

  private hoveredComponentId: ComponentId | null = null;
  private selectedBoxHelper: THREE.Box3Helper;
  private selectedBox = new THREE.Box3();
  private hoveredBoxHelper: THREE.Box3Helper;
  private hoveredBox = new THREE.Box3();

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  private stateRef: SimulationState;
  private tempCRef = 38.0;
  private lastTelemetryEmit = 0;
  private lastHoverRaycast = 0;

  private targetCamPos = new THREE.Vector3(0, 13.5, 27);
  private targetCamLook = new THREE.Vector3(0, 1.3, 0);
  private camGlideActive = false;

  // Animated 3D references
  private explodeCurrent = 1.0;
  private micLayers: LayerItem[] = [];
  private spkLayers: LayerItem[] = [];
  private pttButtonMat!: THREE.MeshStandardMaterial;
  private micChimeLedMat!: THREE.MeshStandardMaterial;
  private soundSensorMat!: THREE.MeshStandardMaterial;

  private mixerFaders: { mesh: THREE.Mesh; phase: number }[] = [];
  private masterFaderMesh!: THREE.Mesh;
  private eqKnobs: THREE.Mesh[] = [];
  private priorityRelayMat!: THREE.MeshStandardMaterial;
  private mixerTempSensorMat!: THREE.MeshStandardMaterial;

  private heatsinkMat!: THREE.MeshStandardMaterial;
  private protectRelayMat!: THREE.MeshStandardMaterial;
  private protectLedMat!: THREE.MeshStandardMaterial;
  private currentSensorMat!: THREE.MeshStandardMaterial;
  private tempSensorMat!: THREE.MeshStandardMaterial;

  private satelliteSpeakers: THREE.Group[] = [];
  private tapIndicatorMeshes: THREE.Mesh[] = [];
  private speakerWaves: WaveRing[] = [];
  private micInputWaves: WaveRing[] = [];
  private splSensorMat!: THREE.MeshStandardMaterial;

  private selectionRing!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private selectionTargetX = -14;

  private pathCurve!: THREE.CatmullRomCurve3;
  private signals: SignalParticle[] = [];

  private disposables: { dispose: () => void }[] = [];

  constructor(
    container: HTMLElement,
    initialState: SimulationState,
    callbacks: PAStageCallbacks
  ) {
    this.container = container;
    this.stateRef = { ...initialState };
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070d19);
    this.scene.fog = new THREE.FogExp2(0x070d19, 0.0115);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 220);
    this.camera.position.copy(this.targetCamPos);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envMap = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envMap;
    roomEnv.dispose();
    pmrem.dispose();

    this.contactShadowTex = createContactShadowTexture();
    this.disposables.push(this.contactShadowTex);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 48;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.target.copy(this.targetCamLook);

    this.controls.addEventListener('start', () => {
      this.camGlideActive = false;
    });

    // Selection & Hover 3D bounding brackets
    this.selectedBoxHelper = new THREE.Box3Helper(this.selectedBox, 0x38bdf8);
    this.selectedBoxHelper.visible = false;
    this.scene.add(this.selectedBoxHelper);

    this.hoveredBoxHelper = new THREE.Box3Helper(this.hoveredBox, 0xfbbf24);
    this.hoveredBoxHelper.visible = false;
    this.scene.add(this.hoveredBoxHelper);

    this.setupLighting();
    this.setupStageFloor();
    this.buildPagingMic();
    this.buildMixer();
    this.buildPowerAmp();
    this.buildCeilingSpeaker();
    this.buildSignalPath();
    this.buildSelectionRing();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.startLoop();
  }

  private track<T extends { dispose: () => void }>(res: T): T {
    this.disposables.push(res);
    return res;
  }

  private registerComponent(
    target: THREE.Object3D,
    componentId: ComponentId,
    nodeKey: NodeKey | 'cable'
  ): void {
    const existing = this.componentMeshes.get(componentId) ?? [];
    target.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.userData.componentId = componentId;
        mesh.userData.nodeKey = nodeKey;
        if (!this.isSoftwareGl && nodeKey !== 'cable') {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
        this.clickableMeshes.push(mesh);
        existing.push(mesh);
      }
    });
    this.componentMeshes.set(componentId, existing);
  }

  private addContactShadow(x: number, z: number, width: number, depth: number): void {
    const geo = this.track(new THREE.PlaneGeometry(width, depth));
    const mat = this.track(
      new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55,
      })
    );
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, 0.015, z);
    this.scene.add(plane);
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.78);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4e6, 1.55);
    keyLight.position.set(14, 24, 16);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 65;
      keyLight.shadow.camera.left = -22;
      keyLight.shadow.camera.right = 22;
      keyLight.shadow.camera.top = 14;
      keyLight.shadow.camera.bottom = -14;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-16, 12, -16);
    this.scene.add(rimLight);
  }

  private setupStageFloor(): void {
    const floorGeo = this.track(new THREE.PlaneGeometry(100, 70));
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x091120,
        roughness: 0.88,
        metalness: 0.12,
      })
    );
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = !this.isSoftwareGl;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(68, 68, 0x1e293b, 0x0f1a2e);
    grid.position.y = 0.0;
    this.scene.add(grid);

    const railGeo = this.track(new THREE.BoxGeometry(36, 0.06, 8.2));
    const railMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.72,
        metalness: 0.25,
      })
    );
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0.5, -0.01, 0);
    rail.receiveShadow = !this.isSoftwareGl;
    this.scene.add(rail);
  }

  private buildPagingMic(): void {
    const micGroup = new THREE.Group();
    micGroup.position.set(-14, 0, 0);
    this.scene.add(micGroup);
    this.addContactShadow(-14, 0, 5.2, 5.4);

    const chassisMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x293548, metalness: 0.55, roughness: 0.42 })
    );
    const darkTrimMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.2, roughness: 0.75 })
    );
    const chromeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.92, roughness: 0.16 })
    );

    // 1. Console Base + PTT + Chime LED
    const baseGroup = new THREE.Group();
    const footGeo = this.track(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12));
    [
      [-1.3, -1.4],
      [1.3, -1.4],
      [-1.3, 1.4],
      [1.3, 1.4],
    ].forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(footGeo, darkTrimMat);
      foot.position.set(fx, 0.06, fz);
      baseGroup.add(foot);
    });

    const baseMain = new THREE.Mesh(this.track(new THREE.BoxGeometry(3.2, 0.65, 3.5)), chassisMat);
    baseMain.position.y = 0.44;
    baseGroup.add(baseMain);

    const deckPlate = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.9, 0.12, 2.5)), darkTrimMat);
    deckPlate.position.set(0, 0.8, 0.3);
    baseGroup.add(deckPlate);

    this.pttButtonMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x000000,
        roughness: 0.3,
        metalness: 0.2,
      })
    );
    const pttButton = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.15, 0.2, 1.1)),
      this.pttButtonMat
    );
    pttButton.position.set(0, 0.92, 0.75);
    baseGroup.add(pttButton);

    this.micChimeLedMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x000000, roughness: 0.25 })
    );
    const chimeLed = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.11, 12, 12)),
      this.micChimeLedMat
    );
    chimeLed.position.set(0.95, 0.9, 0.75);
    baseGroup.add(chimeLed);
    micGroup.add(baseGroup);
    this.registerComponent(baseGroup, 'mic-base', 'mic');

    // 2. Curved Gooseneck Tube + Collar
    const neckGroup = new THREE.Group();
    const neckCollar = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.28, 0.34, 0.28, 16)),
      chromeMat
    );
    neckCollar.position.set(0, 0.9, -0.8);
    neckGroup.add(neckCollar);

    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.95, -0.8),
      new THREE.Vector3(0, 2.1, -0.95),
      new THREE.Vector3(-0.05, 3.15, -0.55),
      new THREE.Vector3(0.1, 3.35, -0.45),
    ]);
    const neckGeo = this.track(new THREE.TubeGeometry(neckCurve, 24, 0.1, 12, false));
    const gooseneck = new THREE.Mesh(neckGeo, chromeMat);
    neckGroup.add(gooseneck);
    micGroup.add(neckGroup);
    this.registerComponent(neckGroup, 'mic-gooseneck', 'mic');

    // 3..8: 7-Layer Exploded Dynamic Capsule Group
    const capsuleGroup = new THREE.Group();
    capsuleGroup.position.set(0.1, 3.35, -0.45);
    micGroup.add(capsuleGroup);

    const layerDefs: {
      id: ComponentId;
      geo: THREE.BufferGeometry;
      rotZ?: number;
      rotY?: number;
      color: number;
      wire: boolean;
      roughness: number;
      metalness: number;
      offset: number;
    }[] = [
      {
        id: 'mic-grille',
        geo: new THREE.SphereGeometry(0.66, 18, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        rotZ: Math.PI / 2,
        color: 0xcbd5e1,
        wire: true,
        roughness: 0.25,
        metalness: 0.85,
        offset: -0.92,
      },
      {
        id: 'mic-foam',
        geo: new THREE.CylinderGeometry(0.56, 0.56, 0.2, 18),
        rotZ: Math.PI / 2,
        color: 0x1e293b,
        wire: false,
        roughness: 0.95,
        metalness: 0.0,
        offset: -0.6,
      },
      {
        id: 'mic-diaphragm',
        geo: new THREE.SphereGeometry(0.52, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2),
        rotZ: Math.PI / 2,
        color: 0x38bdf8,
        wire: false,
        roughness: 0.2,
        metalness: 0.15,
        offset: -0.28,
      },
      {
        id: 'mic-coil',
        geo: new THREE.TorusGeometry(0.35, 0.075, 12, 24),
        rotY: Math.PI / 2,
        color: 0xd97706,
        wire: false,
        roughness: 0.28,
        metalness: 0.9,
        offset: 0.02,
      },
      {
        id: 'mic-magnet',
        geo: new THREE.TorusGeometry(0.5, 0.15, 12, 24),
        rotY: Math.PI / 2,
        color: 0x64748b,
        wire: false,
        roughness: 0.45,
        metalness: 0.75,
        offset: 0.36,
      },
      {
        id: 'mic-housing',
        geo: new THREE.CylinderGeometry(0.6, 0.55, 0.5, 20),
        rotZ: Math.PI / 2,
        color: 0x475569,
        wire: false,
        roughness: 0.35,
        metalness: 0.8,
        offset: 0.72,
      },
      {
        id: 'mic-housing',
        geo: new THREE.CylinderGeometry(0.2, 0.14, 0.45, 14),
        rotZ: Math.PI / 2,
        color: 0x0f172a,
        wire: false,
        roughness: 0.6,
        metalness: 0.3,
        offset: 1.05,
      },
    ];

    layerDefs.forEach((l) => {
      const geo = this.track(l.geo);
      const mat = this.track(
        new THREE.MeshStandardMaterial({
          color: l.color,
          wireframe: l.wire,
          roughness: l.roughness,
          metalness: l.metalness,
        })
      );
      const m = new THREE.Mesh(geo, mat);
      if (l.rotZ) m.rotation.z = l.rotZ;
      if (l.rotY) m.rotation.y = l.rotY;
      m.position.x = l.offset;
      capsuleGroup.add(m);
      this.micLayers.push({ mesh: m, baseX: l.offset });
      this.registerComponent(m, l.id, 'mic');
    });

    // 9. MAX4466 / INMP441 Sound Sensor Module
    const soundSensorGroup = new THREE.Group();
    const sensorStand = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.06, 0.09, 3.25, 10)),
      darkTrimMat
    );
    sensorStand.position.set(-1.35, 1.62, -0.45);
    soundSensorGroup.add(sensorStand);

    this.soundSensorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0x78350f,
        roughness: 0.35,
        metalness: 0.4,
      })
    );
    const sensorPcb = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.55, 0.55, 0.2)),
      this.soundSensorMat
    );
    sensorPcb.position.set(-1.35, 3.35, -0.45);
    soundSensorGroup.add(sensorPcb);

    const sensorCap = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 14)),
      chromeMat
    );
    sensorCap.rotation.z = Math.PI / 2;
    sensorCap.position.set(-1.1, 3.35, -0.45);
    soundSensorGroup.add(sensorCap);

    micGroup.add(soundSensorGroup);
    this.registerComponent(soundSensorGroup, 'sensor-sound', 'mic');

    // Input acoustic wave rings entering Mic when PTT active
    for (let i = 0; i < 3; i++) {
      const wGeo = this.track(new THREE.RingGeometry(0.35, 0.44, 24));
      const wMat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        })
      );
      const wMesh = new THREE.Mesh(wGeo, wMat);
      wMesh.rotation.y = Math.PI / 2;
      wMesh.position.set(-2.3, 3.35, -0.45);
      micGroup.add(wMesh);
      this.micInputWaves.push({ mesh: wMesh, phase: i / 3 });
    }
  }

  private buildMixer(): void {
    const mixerGroup = new THREE.Group();
    mixerGroup.position.set(-4.5, 0, 0);
    this.scene.add(mixerGroup);
    this.addContactShadow(-4.5, 0, 7.0, 6.4);

    const chassisMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x1a2436, metalness: 0.65, roughness: 0.38 })
    );
    const earMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.25 })
    );
    const pcbMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0f766e, metalness: 0.15, roughness: 0.6 })
    );

    // 1. Mixer Chassis & Main PCB
    const chassisGroup = new THREE.Group();
    const chassis = new THREE.Mesh(this.track(new THREE.BoxGeometry(5.6, 1.35, 5.2)), chassisMat);
    chassis.position.y = 0.675;
    chassisGroup.add(chassis);

    const earGeo = this.track(new THREE.BoxGeometry(0.35, 1.3, 0.35));
    [-2.95, 2.95].forEach((ex) => {
      const ear = new THREE.Mesh(earGeo, earMat);
      ear.position.set(ex, 0.68, 2.45);
      chassisGroup.add(ear);
    });

    const pcb = new THREE.Mesh(this.track(new THREE.BoxGeometry(5.1, 0.14, 4.6)), pcbMat);
    pcb.position.y = 1.4;
    chassisGroup.add(pcb);
    mixerGroup.add(chassisGroup);
    this.registerComponent(chassisGroup, 'mixer-chassis', 'mixer');

    // 2. Block 1: Gain / Pre-Amp Op-Amps & Capacitors
    const gainGroup = new THREE.Group();
    const icMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.2 })
    );
    const capMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.35 })
    );
    for (let i = 0; i < 3; i++) {
      const ic = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.45, 0.18, 0.45)), icMat);
      ic.position.set(-1.8 + i * 0.7, 1.56, -1.4);
      gainGroup.add(ic);

      const cap = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 12)),
        capMat
      );
      cap.position.set(-1.8 + i * 0.7, 1.62, -0.8);
      gainGroup.add(cap);
    }
    mixerGroup.add(gainGroup);
    this.registerComponent(gainGroup, 'mixer-gain', 'mixer');

    // 3. Block 2: Tone Control / EQ Knobs
    const eqGroup = new THREE.Group();
    const knobMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.3 })
    );
    const pointerMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7 })
    );
    for (let k = 0; k < 3; k++) {
      const knob = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.24, 0.26, 0.32, 16)),
        knobMat
      );
      knob.position.set(-1.7 + k * 0.72, 1.62, 0.1);
      const tick = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.05, 0.08, 0.22)), pointerMat);
      tick.position.set(0, 0.15, -0.08);
      knob.add(tick);
      eqGroup.add(knob);
      this.eqKnobs.push(knob);
    }
    mixerGroup.add(eqGroup);
    this.registerComponent(eqGroup, 'mixer-eq', 'mixer');

    // 4. Block 3: Priority Override Relay
    this.priorityRelayMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x000000,
        roughness: 0.3,
        metalness: 0.35,
      })
    );
    const relay = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.9, 0.56, 0.9)),
      this.priorityRelayMat
    );
    relay.position.set(0.75, 1.72, -0.65);
    mixerGroup.add(relay);
    this.registerComponent(relay, 'mixer-priority', 'mixer');

    // 5. Block 4: 4 Channel Faders + Master Fader
    const fadersGroup = new THREE.Group();
    const trackSlotMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 })
    );
    const faderCapMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.15 })
    );
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.08, 0.05, 1.5)), trackSlotMat);
      slot.position.set(-1.6 + i * 0.72, 1.5, 1.25);
      fadersGroup.add(slot);

      const fader = new THREE.Mesh(
        this.track(new THREE.BoxGeometry(0.28, 0.22, 0.4)),
        faderCapMat
      );
      fader.position.set(-1.6 + i * 0.72, 1.58, 1.25);
      fadersGroup.add(fader);
      this.mixerFaders.push({ mesh: fader, phase: i * 1.15 });
    }

    const masterSlot = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.08, 0.05, 1.5)),
      trackSlotMat
    );
    masterSlot.position.set(1.75, 1.5, 1.25);
    fadersGroup.add(masterSlot);

    const masterCapMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.25 })
    );
    this.masterFaderMesh = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.32, 0.24, 0.42)),
      masterCapMat
    );
    this.masterFaderMesh.position.set(1.75, 1.59, 1.25);
    fadersGroup.add(this.masterFaderMesh);
    mixerGroup.add(fadersGroup);
    this.registerComponent(fadersGroup, 'mixer-faders', 'mixer');

    // 6. Block 5: Output Buffer Stage
    const bufferStage = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.85, 0.42, 1.1)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 }))
    );
    bufferStage.position.set(1.85, 1.68, -1.2);
    mixerGroup.add(bufferStage);
    this.registerComponent(bufferStage, 'mixer-buffer', 'mixer');

    // 7. Cabinet Thermal Sensor (NTC / DHT22)
    const mixerSensorGroup = new THREE.Group();
    this.mixerTempSensorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0e7490,
        roughness: 0.3,
        metalness: 0.35,
      })
    );
    const sensorBody = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.42, 0.46, 0.32)),
      this.mixerTempSensorMat
    );
    sensorBody.position.set(2.05, 1.7, 0.35);
    mixerSensorGroup.add(sensorBody);

    const sensorPin = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.28, 0.14, 0.28)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 }))
    );
    sensorPin.position.set(2.05, 1.48, 0.35);
    mixerSensorGroup.add(sensorPin);
    mixerGroup.add(mixerSensorGroup);
    this.registerComponent(mixerSensorGroup, 'sensor-mixer-temp', 'mixer');
  }

  private buildPowerAmp(): void {
    const ampGroup = new THREE.Group();
    ampGroup.position.set(5.5, 0, 0);
    this.scene.add(ampGroup);
    this.addContactShadow(5.5, 0, 10.2, 7.2);

    const baseMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.72, roughness: 0.32 })
    );
    const frontMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.35 })
    );
    const copperMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.88, roughness: 0.22 })
    );
    const elcoMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.35, roughness: 0.32 })
    );
    const ironMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.35 })
    );

    // 1. Heavy 2U Chassis & Front Faceplate
    const chassisGroup = new THREE.Group();
    const ampBase = new THREE.Mesh(this.track(new THREE.BoxGeometry(8.8, 0.34, 6.0)), baseMat);
    ampBase.position.y = 0.17;
    chassisGroup.add(ampBase);

    const frontFace = new THREE.Mesh(this.track(new THREE.BoxGeometry(8.8, 1.85, 0.2)), frontMat);
    frontFace.position.set(0, 1.05, 2.9);
    chassisGroup.add(frontFace);
    ampGroup.add(chassisGroup);
    this.registerComponent(chassisGroup, 'amp-chassis', 'amp');

    // 2. Block 1: Catu Daya (2 Toroidal Transformers + 6 Filter Capacitors)
    const psuGroup = new THREE.Group();
    const toroidGeo = this.track(new THREE.TorusGeometry(0.75, 0.32, 16, 30));
    const boltGeo = this.track(new THREE.CylinderGeometry(0.28, 0.28, 0.72, 14));
    for (let t = 0; t < 2; t++) {
      const toroid = new THREE.Mesh(toroidGeo, copperMat);
      toroid.rotation.x = Math.PI / 2;
      toroid.position.set(-3.2, 0.78, -1.1 + t * 2.1);
      psuGroup.add(toroid);

      const bolt = new THREE.Mesh(boltGeo, ironMat);
      bolt.position.set(-3.2, 0.78, -1.1 + t * 2.1);
      psuGroup.add(bolt);
    }

    const capGeo = this.track(new THREE.CylinderGeometry(0.24, 0.24, 1.05, 16));
    const capTopGeo = this.track(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 16));
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = -1.9 + row * 0.62;
        const cz = -1.4 + col * 1.25;
        const cap = new THREE.Mesh(capGeo, elcoMat);
        cap.position.set(cx, 0.86, cz);
        psuGroup.add(cap);

        const capTop = new THREE.Mesh(capTopGeo, ironMat);
        capTop.position.set(cx, 1.4, cz);
        psuGroup.add(capTop);
      }
    }
    ampGroup.add(psuGroup);
    this.registerComponent(psuGroup, 'amp-psu', 'amp');

    // 3. Block 2: Driver PCB
    const driverBoard = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.8, 0.2, 4.2)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.55 }))
    );
    driverBoard.position.set(-0.55, 0.5, 0);
    ampGroup.add(driverBoard);
    this.registerComponent(driverBoard, 'amp-driver', 'amp');

    // 4. Block 3: Power MOSFET Array
    const mosfetGroup = new THREE.Group();
    const mosfetMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.4, metalness: 0.3 })
    );
    const mosfetGeo = this.track(new THREE.BoxGeometry(0.22, 0.46, 0.38));
    for (let m = 0; m < 6; m++) {
      const mosfet = new THREE.Mesh(mosfetGeo, mosfetMat);
      mosfet.position.set(-0.02, 0.95, -1.65 + m * 0.66);
      mosfetGroup.add(mosfet);
    }
    ampGroup.add(mosfetGroup);
    this.registerComponent(mosfetGroup, 'amp-mosfet', 'amp');

    // 5. Block 4: 14-Fin Aluminum Heatsink
    const heatsinkGroup = new THREE.Group();
    this.heatsinkMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xd1d5db,
        metalness: 0.88,
        roughness: 0.24,
        emissive: 0x000000,
      })
    );
    const spine = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.32, 1.5, 4.4)),
      this.heatsinkMat
    );
    spine.position.set(0.24, 1.08, 0);
    heatsinkGroup.add(spine);

    const finGeo = this.track(new THREE.BoxGeometry(1.05, 1.44, 0.08));
    for (let f = 0; f < 14; f++) {
      const fin = new THREE.Mesh(finGeo, this.heatsinkMat);
      fin.position.set(0.84, 1.08, -1.95 + f * 0.3);
      heatsinkGroup.add(fin);
    }
    ampGroup.add(heatsinkGroup);
    this.registerComponent(heatsinkGroup, 'amp-heatsink', 'amp');

    // 6. Sensor Suhu DS18B20 Probe on Heatsink
    const tempSensorGroup = new THREE.Group();
    this.tempSensorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        metalness: 0.65,
        roughness: 0.25,
      })
    );
    const tempProbe = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.16, 0.16, 0.78, 14)),
      this.tempSensorMat
    );
    tempProbe.rotation.z = Math.PI / 2;
    tempProbe.position.set(1.48, 1.22, 0.35);
    tempSensorGroup.add(tempProbe);

    const tempSleeve = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.26, 0.26, 0.26)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.6 }))
    );
    tempSleeve.position.set(1.88, 1.22, 0.35);
    tempSensorGroup.add(tempSleeve);
    ampGroup.add(tempSensorGroup);
    this.registerComponent(tempSensorGroup, 'sensor-temp', 'amp');

    // 7. Block 5: Protection Relay & Front Protect LED
    const protectGroup = new THREE.Group();
    this.protectRelayMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x000000,
        roughness: 0.35,
        metalness: 0.3,
      })
    );
    const relay = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.05, 0.72, 1.45)),
      this.protectRelayMat
    );
    relay.position.set(2.25, 0.7, -1.25);
    protectGroup.add(relay);

    this.protectLedMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x450a0a,
        emissive: 0x000000,
        roughness: 0.2,
      })
    );
    const protectLed = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(0.22, 14, 14)),
      this.protectLedMat
    );
    protectLed.position.set(2.25, 1.25, 3.02);
    protectGroup.add(protectLed);
    ampGroup.add(protectGroup);
    this.registerComponent(protectGroup, 'amp-protect', 'amp');

    // 8. Sensor Arus ACS712 / SCT-013 Current Transformer
    const currentSensorGroup = new THREE.Group();
    this.currentSensorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x581c87,
        roughness: 0.35,
        metalness: 0.4,
      })
    );
    const currentSensor = new THREE.Mesh(
      this.track(new THREE.TorusGeometry(0.34, 0.13, 12, 20)),
      this.currentSensorMat
    );
    currentSensor.rotation.y = Math.PI / 2;
    currentSensor.position.set(2.35, 0.86, 1.15);
    currentSensorGroup.add(currentSensor);

    const ctBase = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.36, 0.22, 0.45)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.5 }))
    );
    ctBase.position.set(2.35, 0.46, 1.15);
    currentSensorGroup.add(ctBase);
    ampGroup.add(currentSensorGroup);
    this.registerComponent(currentSensorGroup, 'sensor-current', 'amp');

    // 9. Block 6: Trafo Output 100V Line & Terminal
    const outTrafoGroup = new THREE.Group();
    const outCore = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(1.4, 1.4, 1.6)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.72, roughness: 0.3 }))
    );
    outCore.position.set(3.65, 1.0, 0.55);
    outTrafoGroup.add(outCore);

    const terminalStrip = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.35, 0.55, 1.1)),
      this.track(new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.8 }))
    );
    terminalStrip.position.set(4.3, 0.85, 0.55);
    outTrafoGroup.add(terminalStrip);
    ampGroup.add(outTrafoGroup);
    this.registerComponent(outTrafoGroup, 'amp-trafo', 'amp');
  }

  private buildCeilingSpeaker(): void {
    const spkGroup = new THREE.Group();
    spkGroup.position.set(15.5, 0, 0);
    this.scene.add(spkGroup);
    this.addContactShadow(15.5, 0, 5.2, 5.2);

    const standMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.4 })
    );
    const standBase = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(1.2, 1.4, 0.24, 24)),
      standMat
    );
    standBase.position.y = 0.12;
    spkGroup.add(standBase);

    const standPost = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.18, 0.22, 2.0, 14)),
      standMat
    );
    standPost.position.y = 1.12;
    spkGroup.add(standPost);
    this.registerComponent(standBase, 'spk-grille', 'spk');
    this.registerComponent(standPost, 'spk-grille', 'spk');

    const spkSubGroup = new THREE.Group();
    spkSubGroup.position.set(0, 2.35, 0);
    spkGroup.add(spkSubGroup);

    // 1..6 Electroacoustic Layers
    const defs: {
      id: ComponentId;
      geo: THREE.BufferGeometry;
      rotY?: number;
      rotZ?: number;
      posX: number;
      color: number;
      metalness: number;
      roughness: number;
    }[] = [
      {
        id: 'spk-trafo',
        geo: new THREE.BoxGeometry(0.72, 0.72, 0.72),
        posX: -1.15,
        color: 0xd97706,
        metalness: 0.68,
        roughness: 0.3,
      },
      {
        id: 'spk-coil',
        geo: new THREE.TorusGeometry(0.45, 0.1, 12, 24),
        rotY: Math.PI / 2,
        posX: -0.52,
        color: 0xb45309,
        metalness: 0.85,
        roughness: 0.25,
      },
      {
        id: 'spk-magnet',
        geo: new THREE.TorusGeometry(0.72, 0.22, 14, 26),
        rotY: Math.PI / 2,
        posX: -0.05,
        color: 0x475569,
        metalness: 0.72,
        roughness: 0.4,
      },
      {
        id: 'spk-spider',
        geo: new THREE.RingGeometry(0.35, 0.85, 24),
        rotY: Math.PI / 2,
        posX: 0.38,
        color: 0xca8a04,
        metalness: 0.1,
        roughness: 0.8,
      },
      {
        id: 'spk-cone',
        geo: new THREE.ConeGeometry(1.16, 0.86, 28, 1, true),
        rotZ: -Math.PI / 2,
        posX: 0.88,
        color: 0x1e293b,
        metalness: 0.08,
        roughness: 0.72,
      },
      {
        id: 'spk-grille',
        geo: new THREE.CylinderGeometry(1.24, 1.24, 0.15, 28),
        rotZ: Math.PI / 2,
        posX: 1.4,
        color: 0xe2e8f0,
        metalness: 0.55,
        roughness: 0.3,
      },
    ];

    defs.forEach((d) => {
      const geo = this.track(d.geo);
      const mat = this.track(
        new THREE.MeshStandardMaterial({
          color: d.color,
          side: THREE.DoubleSide,
          metalness: d.metalness,
          roughness: d.roughness,
        })
      );
      const m = new THREE.Mesh(geo, mat);
      if (d.rotY) m.rotation.y = d.rotY;
      if (d.rotZ) m.rotation.z = d.rotZ;
      m.position.x = d.posX;
      spkSubGroup.add(m);
      this.spkLayers.push({ mesh: m, baseX: d.posX });
      this.registerComponent(m, d.id, 'spk');
    });

    // 3 Tap Indicator Dots attached to Matching Transformer
    for (let t = 0; t < 3; t++) {
      const ledMat = this.track(
        new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 })
      );
      const led = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.08, 10, 10)), ledMat);
      led.position.set(-1.15, 0.42, -0.22 + t * 0.22);
      spkSubGroup.add(led);
      this.tapIndicatorMeshes.push(led);
      this.registerComponent(led, 'spk-trafo', 'spk');
    }

    // Parallel Satellite Speaker Indicators
    const satMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.4,
        roughness: 0.45,
        transparent: true,
        opacity: 0.88,
      })
    );
    const satConeMat = this.track(
      new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0369a1 })
    );
    for (let s = 0; s < 5; s++) {
      const sat = new THREE.Group();
      const body = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 16)),
        satMat
      );
      body.rotation.z = Math.PI / 2;
      const core = new THREE.Mesh(
        this.track(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 14)),
        satConeMat
      );
      core.rotation.z = Math.PI / 2;
      sat.add(body, core);
      sat.position.set(1.2, 0.75 + (s % 2) * 0.9, -2.0 - Math.floor(s / 2) * 1.15);
      spkGroup.add(sat);
      this.satelliteSpeakers.push(sat);
      this.registerComponent(sat, 'spk-parallel', 'spk');
    }

    // Output Acoustic SPL Sensor near Ceiling Speaker Grille
    const splGroup = new THREE.Group();
    const splPost = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.05, 0.07, 1.35, 10)),
      standMat
    );
    splPost.position.set(1.8, 0.68, 0.95);
    splGroup.add(splPost);

    this.splSensorMat = this.track(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x065f46,
        roughness: 0.3,
        metalness: 0.45,
      })
    );
    const splBody = new THREE.Mesh(
      this.track(new THREE.BoxGeometry(0.38, 0.48, 0.26)),
      this.splSensorMat
    );
    splBody.position.set(1.8, 1.48, 0.95);
    splGroup.add(splBody);

    const splCapsule = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 12)),
      this.track(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }))
    );
    splCapsule.position.set(1.8, 1.82, 0.95);
    splGroup.add(splCapsule);
    spkGroup.add(splGroup);
    this.registerComponent(splGroup, 'sensor-spl', 'spk');

    // Expanding acoustic sound wave rings
    for (let w = 0; w < 3; w++) {
      const wGeo = this.track(new THREE.RingGeometry(0.6, 0.72, 28));
      const wMat = this.track(
        new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        })
      );
      const ring = new THREE.Mesh(wGeo, wMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(1.8, 2.35, 0);
      spkGroup.add(ring);
      this.speakerWaves.push({ mesh: ring, phase: w / 3 });
    }
  }

  private buildSignalPath(): void {
    this.pathCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-12.9, 3.35, -0.45),
      new THREE.Vector3(-10.2, 1.35, 0.0),
      new THREE.Vector3(-4.5, 1.5, 0.0),
      new THREE.Vector3(2.3, 0.95, -0.9),
      new THREE.Vector3(9.4, 1.0, 0.55),
      new THREE.Vector3(14.3, 2.35, 0.0),
    ]);

    const tubeGeo = this.track(new THREE.TubeGeometry(this.pathCurve, 120, 0.085, 10, false));
    const tubeMat = this.track(
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.36 })
    );
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    this.scene.add(tube);
    this.registerComponent(tube, 'signal-cable', 'cable');

    const sphereGeo = this.track(new THREE.SphereGeometry(0.13, 10, 10));
    for (let i = 0; i < 36; i++) {
      const mat = this.track(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      const sMesh = new THREE.Mesh(sphereGeo, mat);
      this.scene.add(sMesh);
      this.signals.push({ mesh: sMesh, t: i / 36 });
    }
  }

  private buildSelectionRing(): void {
    const ringGeo = this.track(new THREE.RingGeometry(2.8, 3.05, 48));
    const ringMat = this.track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
      })
    );
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.set(-14, 0.03, 0);
    this.scene.add(this.selectionRing);
  }

  private computeComponentBounds(componentId: ComponentId, targetBox: THREE.Box3): boolean {
    const meshes = this.componentMeshes.get(componentId);
    if (!meshes || meshes.length === 0) return false;
    targetBox.makeEmpty();
    let count = 0;
    for (const m of meshes) {
      if (!m.visible) continue;
      // Check ancestors visible too
      let vis = true;
      let curr: THREE.Object3D | null = m;
      while (curr) {
        if (!curr.visible) {
          vis = false;
          break;
        }
        curr = curr.parent;
      }
      if (!vis) continue;
      m.updateWorldMatrix(true, false);
      _partBox.setFromObject(m);
      targetBox.union(_partBox);
      count++;
    }
    if (count === 0) return false;
    targetBox.expandByScalar(0.12);
    return true;
  }

  public updateState(nextState: SimulationState): void {
    this.stateRef = { ...nextState };
    const xMap: Record<NodeKey, number> = {
      mic: -14,
      mixer: -4.5,
      amp: 5.5,
      spk: 15.5,
    };
    this.selectionTargetX = xMap[nextState.activeNode];
  }

  public focusNode(key: NodeKey): void {
    const d = NODE_DETAILS[key];
    this.targetCamPos.set(...d.cam);
    this.targetCamLook.set(...d.target);
    this.camGlideActive = true;
    this.selectionTargetX = d.target[0];
  }

  public focusComponent(componentId: ComponentId): void {
    const c = COMPONENT_DETAILS[componentId];
    this.targetCamPos.set(...c.cam);
    this.targetCamLook.set(...c.target);
    this.camGlideActive = true;
    if (c.parentNode !== 'cable') {
      this.selectionTargetX = NODE_DETAILS[c.parentNode].target[0];
    }
  }

  public setCameraPreset(mode: CameraMode, activeNode: NodeKey): void {
    if (mode === 'overview') {
      this.targetCamPos.set(0, 13.5, 27);
      this.targetCamLook.set(0, 1.3, 0);
      this.camGlideActive = true;
    } else if (mode === 'closeup') {
      if (this.stateRef.activeComponentId) {
        this.focusComponent(this.stateRef.activeComponentId);
      } else {
        this.focusNode(activeNode);
      }
    } else if (mode === 'sensors') {
      this.targetCamPos.set(1.5, 9.8, 18.5);
      this.targetCamLook.set(1.5, 1.6, 0);
      this.camGlideActive = true;
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.pointerDownPos.set(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent): void => {
    // Distinguish click vs orbit drag
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
    if (hits.length > 0) {
      const hitObj = hits[0].object;
      const componentId = hitObj.userData.componentId as ComponentId | undefined;
      const nodeKey = hitObj.userData.nodeKey as NodeKey | 'cable' | undefined;

      if (componentId) {
        const parentNode = nodeKey && nodeKey !== 'cable' ? nodeKey : undefined;
        this.callbacks.onSelectComponent(componentId, parentNode);
        this.focusComponent(componentId);
      } else if (nodeKey && nodeKey !== 'cable') {
        this.callbacks.onSelectNode(nodeKey);
        this.focusNode(nodeKey);
      }
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverRaycast < 40) return;
    this.lastHoverRaycast = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
    if (hits.length > 0) {
      const compId = (hits[0].object.userData.componentId as ComponentId) ?? null;
      this.hoveredComponentId = compId;
      this.renderer.domElement.style.cursor = 'pointer';
      this.callbacks.onHoverComponent(compId, e.clientX, e.clientY);
    } else {
      if (this.hoveredComponentId !== null) {
        this.hoveredComponentId = null;
        this.callbacks.onHoverComponent(null, e.clientX, e.clientY);
      }
      this.renderer.domElement.style.cursor = 'grab';
    }
  };

  private onPointerLeave = (): void => {
    this.hoveredComponentId = null;
    this.hoveredBoxHelper.visible = false;
    this.callbacks.onHoverComponent(null, 0, 0);
  };

  private onResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost?.(true);
  };

  private onContextRestored = (): void => {
    this.callbacks.onContextLost?.(false);
  };

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerleave', this.onPointerLeave);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener('resize', this.onResize);
  }

  private computeTelemetryStep(dt: number): TelemetrySnapshot {
    const st = this.stateRef;
    const priorityActive = st.ptt || st.alarm;
    const activeAudio =
      (st.ptt ? 1.0 : 0.0) +
      (st.alarm ? 1.2 : 0.0) +
      (!priorityActive && st.bgm ? 0.55 : 0.0);

    const loadFactor = (st.tapWatts / 15) * (st.spkCount / 6) * st.atten;
    const soundDb = Number(
      (35 + Math.min(65, activeAudio * 28 * (0.5 + st.gain * 0.6))).toFixed(1)
    );

    let currentA: number;
    let protectTripped: boolean;

    if (st.fault === 'short') {
      currentA = 18.5;
      protectTripped = true;
    } else if (st.fault === 'overload' || loadFactor > 0.88) {
      currentA = Number((7.5 + loadFactor * 6.5).toFixed(2));
      protectTripped = true;
    } else {
      currentA = Number((0.4 + loadFactor * 3.8 + activeAudio * 0.45).toFixed(2));
      protectTripped = false;
    }

    const targetTemp = 28 + loadFactor * 36 + (protectTripped ? 18 : 0) + activeAudio * 4;
    this.tempCRef = THREE.MathUtils.damp(this.tempCRef, targetTemp, 2.2, dt);
    const mixerTempC = Number((27.5 + st.gain * 5.2 + (priorityActive ? 2.4 : 0)).toFixed(1));

    const nominalTotalWatts = st.tapWatts * st.spkCount;
    const effectiveLoadWatts = protectTripped
      ? 0
      : Number((nominalTotalWatts * st.atten * st.fader).toFixed(1));
    const lineImpedanceOhm =
      nominalTotalWatts > 0 ? Math.round((100 * 100) / nominalTotalWatts) : 9999;

    const loopResistance = st.cableMeters * 0.024;
    const lineCurrentNominal = (nominalTotalWatts / 100) * st.atten;
    const voltageDropV = protectTripped
      ? 100
      : Number(Math.min(18, lineCurrentNominal * loopResistance).toFixed(2));
    const deliveredVoltageV = protectTripped
      ? 0
      : Number(Math.max(0, 100 * st.atten - voltageDropV).toFixed(1));

    const cableAtten = Math.max(0.45, 1 - (st.cableMeters / 400) * 0.35);
    const outputSplDb = protectTripped
      ? 36.0
      : Number(
          (
            38 +
            Math.min(
              64,
              activeAudio *
                24 *
                (0.45 + st.fader * 0.55) *
                (0.4 + st.atten * 0.7) *
                cableAtten *
                (0.55 + (st.tapWatts / 15) * 0.55)
            )
          ).toFixed(1)
        );

    return {
      tempC: Number(this.tempCRef.toFixed(1)),
      mixerTempC,
      soundDb,
      outputSplDb,
      currentA,
      priorityActive,
      protectTripped,
      totalLoadWatts: effectiveLoadWatts,
      lineImpedanceOhm,
      voltageDropV,
      deliveredVoltageV,
    };
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const dt = Math.min(0.1, this.clock.getDelta());
      const elapsed = this.clock.getElapsedTime();
      const st = this.stateRef;

      const telemetry = this.computeTelemetryStep(dt);

      if (elapsed - this.lastTelemetryEmit > 0.08) {
        this.lastTelemetryEmit = elapsed;
        this.callbacks.onTelemetryTick(telemetry);
      }

      const expTarget = st.explode ? 1.95 : 1.0;
      this.explodeCurrent = THREE.MathUtils.damp(this.explodeCurrent, expTarget, 7, dt);

      for (const l of this.micLayers) {
        l.mesh.position.x = l.baseX * this.explodeCurrent;
      }
      for (const l of this.spkLayers) {
        l.mesh.position.x = l.baseX * this.explodeCurrent;
      }

      const vib = ((telemetry.soundDb - 35) / 65) * 0.085;
      const micOsc = Math.sin(elapsed * 28) * vib;
      if (this.micLayers[2]) this.micLayers[2].mesh.position.x += micOsc;
      if (this.micLayers[3]) this.micLayers[3].mesh.position.x += micOsc;

      const spkOsc = telemetry.protectTripped
        ? 0
        : Math.sin(elapsed * 26) * vib * (st.tapWatts / 15 + 0.35) * st.atten;
      if (this.spkLayers[4]) this.spkLayers[4].mesh.position.x += spkOsc;
      if (this.spkLayers[1]) this.spkLayers[1].mesh.position.x += spkOsc * 0.65;

      const eqAngle = (st.eq / 12) * 1.3;
      this.eqKnobs.forEach((knob, i) => {
        knob.rotation.y = eqAngle * (i === 1 ? 0.85 : 1);
      });
      this.mixerFaders.forEach((f) => {
        f.mesh.position.z = 1.25 + Math.sin(elapsed * 2.1 + f.phase) * 0.35;
      });
      this.masterFaderMesh.position.z = 1.9 - st.fader * 1.3;

      this.pttButtonMat.emissive.setHex(st.ptt ? 0x16a34a : 0x000000);
      this.micChimeLedMat.emissive.setHex(st.ptt ? 0x38bdf8 : 0x000000);
      this.soundSensorMat.emissive.setHex(st.ptt || st.alarm ? 0xd97706 : 0x451a03);
      this.priorityRelayMat.emissive.setHex(telemetry.priorityActive ? 0xeab308 : 0x000000);
      this.protectLedMat.color.setHex(telemetry.protectTripped ? 0xef4444 : 0x450a0a);
      this.protectLedMat.emissive.setHex(telemetry.protectTripped ? 0xdc2626 : 0x000000);
      this.protectRelayMat.emissive.setHex(telemetry.protectTripped ? 0xdc2626 : 0x000000);
      this.splSensorMat.emissive.setHex(
        !telemetry.protectTripped && (st.ptt || st.alarm || st.bgm) ? 0x059669 : 0x064e3b
      );

      const heatRatio = Math.max(0, Math.min(1, (telemetry.tempC - 30) / 45));
      this.heatsinkMat.emissive.setRGB(heatRatio * 0.85, heatRatio * 0.14, 0);

      const activeTapIdx = st.tapWatts === 3 ? 0 : st.tapWatts === 6 ? 1 : 2;
      this.tapIndicatorMeshes.forEach((led, idx) => {
        const mat = led.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(idx === activeTapIdx ? 0x38bdf8 : 0x000000);
        mat.color.setHex(idx === activeTapIdx ? 0x7dd3fc : 0x334155);
      });

      this.satelliteSpeakers.forEach((sat, idx) => {
        sat.visible = idx < st.spkCount - 1;
      });

      this.micInputWaves.forEach((w) => {
        if (!st.ptt) {
          w.mesh.material.opacity = 0;
          return;
        }
        const p = (elapsed * 0.9 + w.phase) % 1;
        const scale = 2.0 - p * 1.4;
        w.mesh.position.x = -2.6 + p * 1.3;
        w.mesh.scale.setScalar(scale);
        w.mesh.material.opacity = Math.sin(p * Math.PI) * 0.55;
      });

      const spkActive =
        !telemetry.protectTripped && (st.ptt || st.alarm || st.bgm) && st.atten > 0.05;
      this.speakerWaves.forEach((w) => {
        if (!spkActive) {
          w.mesh.material.opacity = 0;
          return;
        }
        const p = (elapsed * (0.75 + st.atten * 0.5) + w.phase) % 1;
        const maxScale = 1.2 + (st.tapWatts / 15) * 1.6;
        w.mesh.position.x = 1.65 + p * 2.2;
        w.mesh.scale.setScalar(0.8 + p * maxScale);
        w.mesh.material.color.setHex(st.alarm ? 0xf87171 : st.ptt ? 0x38bdf8 : 0x4ade80);
        w.mesh.material.opacity = (1 - p) * 0.55;
      });

      const speed = telemetry.protectTripped ? 0.0005 : (0.18 + st.atten * 0.22) * dt;
      for (const p of this.signals) {
        p.t = (p.t + speed) % 1;
        this.pathCurve.getPointAt(p.t, _camPos);
        p.mesh.position.copy(_camPos);

        if (telemetry.protectTripped && p.t > 0.55) {
          p.mesh.scale.setScalar(0.32);
          p.mesh.material.color.setHex(0xef4444);
        } else if (p.t < 0.45) {
          p.mesh.scale.setScalar(0.75);
          p.mesh.material.color.setHex(0x38bdf8);
        } else if (p.t < 0.78) {
          p.mesh.scale.setScalar(1.35);
          p.mesh.material.color.setHex(0xfacc15);
        } else {
          p.mesh.scale.setScalar(1.05);
          p.mesh.material.color.setHex(0x4ade80);
        }
      }

      this.selectionRing.position.x = THREE.MathUtils.damp(
        this.selectionRing.position.x,
        this.selectionTargetX,
        8,
        dt
      );

      // Update 3D selection & hover bounding brackets
      if (st.activeComponentId) {
        this.selectedBoxHelper.visible = this.computeComponentBounds(
          st.activeComponentId,
          this.selectedBox
        );
      } else {
        this.selectedBoxHelper.visible = false;
      }

      if (
        this.hoveredComponentId &&
        this.hoveredComponentId !== st.activeComponentId
      ) {
        this.hoveredBoxHelper.visible = this.computeComponentBounds(
          this.hoveredComponentId,
          this.hoveredBox
        );
      } else {
        this.hoveredBoxHelper.visible = false;
      }

      if (this.camGlideActive) {
        this.camera.position.x = THREE.MathUtils.damp(
          this.camera.position.x,
          this.targetCamPos.x,
          5.5,
          dt
        );
        this.camera.position.y = THREE.MathUtils.damp(
          this.camera.position.y,
          this.targetCamPos.y,
          5.5,
          dt
        );
        this.camera.position.z = THREE.MathUtils.damp(
          this.camera.position.z,
          this.targetCamPos.z,
          5.5,
          dt
        );

        this.controls.target.x = THREE.MathUtils.damp(
          this.controls.target.x,
          this.targetCamLook.x,
          5.5,
          dt
        );
        this.controls.target.y = THREE.MathUtils.damp(
          this.controls.target.y,
          this.targetCamLook.y,
          5.5,
          dt
        );
        this.controls.target.z = THREE.MathUtils.damp(
          this.controls.target.z,
          this.targetCamLook.z,
          5.5,
          dt
        );

        const posDist = this.camera.position.distanceTo(this.targetCamPos);
        const tgtDist = _camTarget.copy(this.controls.target).distanceTo(this.targetCamLook);
        if (posDist < 0.05 && tgtDist < 0.05) {
          this.camGlideActive = false;
        }
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerleave', this.onPointerLeave);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);
    window.removeEventListener('resize', this.onResize);

    this.controls.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.envMap?.dispose();
    this.renderer.dispose();

    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
