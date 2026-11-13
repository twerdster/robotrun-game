import * as THREE from 'three';
import { LANE_WIDTH, RUN_DISTANCE, type GameState, type ObstacleType } from './game';

/** Procedural artwork for the new browser version; no historical game assets. */
export class RunnerScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 250);
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly robot = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly finish = new THREE.Group();
  private readonly obstacleMeshes = new Map<number, THREE.Group>();
  private readonly pickupMeshes = new Map<number, THREE.Mesh>();
  private readonly stripes: THREE.Mesh[] = [];
  private readonly posts: THREE.Group[] = [];
  private readonly scenery: THREE.Group[] = [];
  private readonly box: THREE.BoxGeometry;
  private readonly coinGeometry: THREE.TorusGeometry;
  private readonly flameGeometry: THREE.ConeGeometry;
  private readonly dark: THREE.MeshStandardMaterial;
  private readonly cyan: THREE.MeshStandardMaterial;
  private readonly robotShell: THREE.MeshStandardMaterial;
  private readonly amber: THREE.MeshStandardMaterial;
  private readonly pink: THREE.MeshStandardMaterial;
  private readonly red: THREE.MeshStandardMaterial;
  private readonly coinMaterial: THREE.MeshStandardMaterial;
  private disposed = false;
  private dirty = true;
  private staticSignature: string | null = null;
  private readonly invalidate = (): void => { this.dirty = true; };

  constructor(private readonly container: HTMLElement) {
    // Let the app present an accessible fallback if WebGL is unavailable.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label', 'Robot running along a three-lane obstacle course');
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.addEventListener('webglcontextrestored', this.invalidate);
    this.container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#242035');
    this.scene.fog = new THREE.Fog('#292338', 35, 142);
    this.camera.position.set(0, 4.4, 8.8);
    this.camera.lookAt(0, 1.1, -12);

    this.box = this.geometry(new THREE.BoxGeometry(1, 1, 1));
    this.coinGeometry = this.geometry(new THREE.TorusGeometry(0.2, 0.065, 6, 12));
    this.flameGeometry = this.geometry(new THREE.ConeGeometry(0.3, 1, 5));
    this.dark = this.material('#202b35', 0.8, 0.35);
    this.cyan = this.material('#79e6e3', 0.45, 0.5, '#145357');
    this.robotShell = this.material('#79e6e3', 0.45, 0.5, '#145357');
    this.amber = this.material('#ffbd62', 0.65, 0.2, '#553214');
    this.pink = this.material('#d895e5', 0.65, 0.2, '#432454');
    this.red = this.material('#e57962', 0.7, 0.15, '#4e2520');
    this.coinMaterial = this.material('#ffdf7b', 0.35, 0.75, '#99621c');

    this.scene.add(new THREE.HemisphereLight('#c4c6f5', '#775235', 2.0));
    const sun = new THREE.DirectionalLight('#ffdbac', 3.0);
    sun.position.set(-8, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);
    sun.target.position.set(0, 0, -10);
    const rim = new THREE.DirectionalLight('#8dc5e9', 1.5);
    rim.position.set(6, 7, -25);
    this.scene.add(rim);
    this.buildLandscape();
    this.buildRobot();
    this.buildFinish();
    this.resize();
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry);
    return geometry;
  }

  private material(color: string, roughness: number, metalness: number, emissive = '#000000'): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive });
    this.materials.add(material);
    return material;
  }

  private cube(parent: THREE.Object3D, material: THREE.Material, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
    const mesh = new THREE.Mesh(this.box, material);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private buildLandscape(): void {
    const sand = this.material('#8a6351', 1, 0);
    const road = this.material('#4c4651', 0.95, 0.05);
    const rail = this.material('#a6a5ac', 0.65, 0.3);
    const line = this.material('#f2ca87', 0.85, 0.1, '#362b19');
    this.cube(this.scene, sand, [260, 0.4, 280], [0, -0.36, -110]);
    this.cube(this.scene, road, [7.65, 0.18, 260], [0, -0.09, -110]);
    for (const side of [-1, 1]) {
      this.cube(this.scene, this.dark, [0.16, 0.25, 240], [side * 3.9, 0.1, -110]);
      this.cube(this.scene, rail, [0.07, 0.08, 240], [side * 4.0, 0.95, -110]);
      this.cube(this.scene, rail, [0.07, 0.06, 240], [side * 4.0, 0.55, -110]);
    }
    for (let index = 0; index < 32; index += 1) {
      for (const side of [-1, 1]) {
        const stripe = this.cube(this.scene, line, [0.055, 0.012, 2.5], [side * 1.1, 0.015, 0]);
        stripe.userData.offset = index * 6;
        this.stripes.push(stripe);
      }
    }
    for (let index = 0; index < 30; index += 1) {
      const pair = new THREE.Group();
      for (const side of [-1, 1]) {
        this.cube(pair, rail, [0.12, 1.12, 0.12], [side * 4.0, 0.56, 0]);
        this.cube(pair, this.cyan, [0.17, 0.1, 0.17], [side * 4.0, 1.15, 0]);
      }
      pair.userData.offset = index * 7;
      this.scene.add(pair);
      this.posts.push(pair);
    }
    const rockGeometry = this.geometry(new THREE.DodecahedronGeometry(1, 0));
    const rockMaterial = this.material('#70505a', 1, 0);
    for (let index = 0; index < 32; index += 1) {
      const rock = new THREE.Group();
      const mesh = new THREE.Mesh(rockGeometry, rockMaterial);
      const height = 0.6 + (index * 7 % 9) * 0.36;
      mesh.scale.set(height * 1.25, height, height * 0.9);
      mesh.position.y = height * 0.35;
      mesh.rotation.set(index * 0.3, index * 1.3, index * 0.1);
      mesh.castShadow = true;
      rock.add(mesh);
      rock.position.x = (index % 2 ? -1 : 1) * (7 + (index * 13 % 19));
      rock.userData.offset = index * 7.3;
      this.scene.add(rock);
      this.scenery.push(rock);
    }
    // A distant low-poly horizon provides depth without external textures.
    const mountainGeometry = this.geometry(new THREE.ConeGeometry(1, 1, 5));
    const mountainMaterial = this.material('#494054', 1, 0);
    for (let index = 0; index < 17; index += 1) {
      const peak = new THREE.Mesh(mountainGeometry, mountainMaterial);
      peak.scale.set(10 + index % 3 * 5, 9 + index % 5 * 3, 9);
      peak.position.set((index - 8) * 14, 1, -145 - index % 3 * 8);
      this.scene.add(peak);
    }
  }

  private buildRobot(): void {
    this.scene.add(this.robot);
    this.cube(this.robot, this.dark, [0.62, 0.38, 0.43], [0, 0.91, 0]);
    this.cube(this.robot, this.robotShell, [0.78, 0.62, 0.48], [0, 1.29, 0]);
    this.cube(this.robot, this.dark, [0.49, 0.12, 0.08], [0, 1.36, 0.26]);
    this.cube(this.robot, this.amber, [0.15, 0.09, 0.07], [0, 1.37, 0.31]);
    this.cube(this.robot, this.robotShell, [0.63, 0.46, 0.48], [0, 1.88, 0]);
    this.cube(this.robot, this.dark, [0.51, 0.19, 0.065], [0, 1.92, 0.26]);
    for (const side of [-1, 1]) {
      this.cube(this.robot, this.amber, [0.095, 0.065, 0.03], [side * 0.14, 1.94, 0.3]);
    }
    for (const [pivot, side] of [[this.leftArm, -1], [this.rightArm, 1]] as const) {
      pivot.position.set(side * 0.55, 1.5, 0);
      this.cube(pivot, this.dark, [0.23, 0.27, 0.26], [0, -0.12, 0]);
      this.cube(pivot, this.robotShell, [0.24, 0.4, 0.27], [0, -0.38, 0]);
      this.cube(pivot, this.dark, [0.22, 0.2, 0.25], [0, -0.65, 0.02]);
      this.robot.add(pivot);
    }
    for (const [pivot, side] of [[this.leftLeg, -1], [this.rightLeg, 1]] as const) {
      pivot.position.set(side * 0.22, 0.83, 0);
      this.cube(pivot, this.dark, [0.25, 0.37, 0.27], [0, -0.19, 0]);
      this.cube(pivot, this.robotShell, [0.29, 0.31, 0.3], [0, -0.52, 0]);
      this.cube(pivot, this.dark, [0.32, 0.15, 0.48], [0, -0.74, 0.07]);
      this.robot.add(pivot);
    }
  }

  private buildFinish(): void {
    this.scene.add(this.finish);
    for (const side of [-1, 1]) this.cube(this.finish, this.cyan, [0.25, 4.5, 0.3], [side * 3.55, 2.25, 0]);
    this.cube(this.finish, this.dark, [7.35, 0.95, 0.3], [0, 4.1, 0]);
    for (let column = 0; column < 14; column += 1) {
      for (let row = 0; row < 2; row += 1) {
        if ((column + row) % 2 === 0) this.cube(this.finish, this.cyan, [0.5, 0.4, 0.04], [-3.25 + column * 0.5, 3.88 + row * 0.43, 0.18]);
      }
    }
  }

  private buildObstacle(type: ObstacleType): THREE.Group {
    const group = new THREE.Group();
    group.userData.type = type;
    if (type === 'fire') {
      this.cube(group, this.dark, [1.8, 0.18, 0.95], [0, 0.09, 0]);
      for (let index = 0; index < 5; index += 1) {
        const flame = new THREE.Mesh(this.flameGeometry, index % 2 ? this.coinMaterial : this.amber);
        flame.position.set((index - 2) * 0.32, 0.57, (index % 2 - 0.5) * 0.2);
        flame.rotation.z = (index - 2) * 0.1;
        flame.userData.flame = true;
        flame.userData.index = index;
        group.add(flame);
      }
    } else if (type === 'barrier') {
      this.cube(group, this.dark, [1.8, 0.13, 0.9], [0, 0.065, 0]);
      this.cube(group, this.amber, [1.7, 0.65, 0.75], [0, 0.45, 0]);
      this.cube(group, this.dark, [0.11, 0.65, 0.77], [-0.5, 0.45, 0]);
      this.cube(group, this.dark, [0.11, 0.65, 0.77], [0.5, 0.45, 0]);
    } else if (type === 'overhead') {
      for (const side of [-1, 1]) this.cube(group, this.dark, [0.15, 2.45, 0.7], [side * 0.95, 1.225, 0]);
      this.cube(group, this.pink, [2.03, 1.2, 0.72], [0, 1.95, 0]);
      for (const side of [-1, 1]) this.cube(group, this.amber, [0.15, 0.14, 0.75], [side * 0.7, 1.38, 0]);
    } else {
      this.cube(group, this.red, [1.85, 2.7, 0.9], [0, 1.35, 0]);
      this.cube(group, this.dark, [1.92, 0.14, 0.94], [0, 0.55, 0]);
      this.cube(group, this.dark, [1.92, 0.14, 0.94], [0, 2.15, 0]);
      this.cube(group, this.amber, [0.18, 0.8, 0.05], [0, 1.4, 0.48]);
      this.cube(group, this.amber, [0.18, 0.18, 0.05], [0, 0.86, 0.48]);
    }
    this.scene.add(group);
    return group;
  }

  render(state: GameState, elapsedSeconds: number): void {
    if (this.disposed) return;
    if (state.phase !== 'running') {
      // Freeze decorative animation while idle; avoid repeatedly submitting an
      // unchanged scene, particularly when software WebGL shares the CPU.
      const signature = JSON.stringify([
        state.phase, state.lane, state.targetLane, state.jumpY, state.ducking,
        state.distance, state.burningRemaining,
        state.obstacles.map(value => [value.id, value.type, value.lane, value.z]),
        state.pickups.map(value => [value.id, value.lane, value.z, value.collected]),
      ]);
      if (!this.dirty && signature === this.staticSignature) return;
      this.staticSignature = signature;
    } else {
      this.staticSignature = null;
    }
    this.dirty = false;
    this.robot.position.set(state.lane * LANE_WIDTH, state.jumpY, 0);
    this.robot.scale.y = state.ducking ? 0.52 : 1;
    this.robot.rotation.z = (state.lane - state.targetLane) * 0.1;
    this.robotShell.color.set(state.burningRemaining > 0 ? '#ffad64' : '#79e6e3');
    this.robotShell.emissive.set(state.burningRemaining > 0 ? '#683114' : '#145357');
    this.finish.position.z = -(RUN_DISTANCE - state.distance);
    this.finish.visible = state.distance > RUN_DISTANCE - 145;
    const gait = state.phase === 'ready' ? 0 : Math.sin(state.distance * 1.65) * 0.55;
    this.leftLeg.rotation.x = gait;
    this.rightLeg.rotation.x = -gait;
    this.leftArm.rotation.x = -gait * 0.8 - 0.2;
    this.rightArm.rotation.x = gait * 0.8 - 0.2;
    for (const stripe of this.stripes) stripe.position.z = 10 - ((stripe.userData.offset - state.distance % 192 + 192) % 192);
    for (const post of this.posts) post.position.z = 12 - ((post.userData.offset - state.distance % 210 + 210) % 210);
    for (const rock of this.scenery) rock.position.z = 12 - ((rock.userData.offset - state.distance % 233.6 + 233.6) % 233.6);

    const obstacleIds = new Set<number>();
    for (const obstacle of state.obstacles) {
      obstacleIds.add(obstacle.id);
      let mesh = this.obstacleMeshes.get(obstacle.id);
      if (mesh && mesh.userData.type !== obstacle.type) {
        this.scene.remove(mesh);
        this.obstacleMeshes.delete(obstacle.id);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = this.buildObstacle(obstacle.type);
        this.obstacleMeshes.set(obstacle.id, mesh);
      }
      mesh.position.set(obstacle.lane * LANE_WIDTH, 0, -obstacle.z);
      if (obstacle.type === 'fire') {
        for (const flame of mesh.children) {
          if (flame.userData.flame) flame.scale.y = 0.8 + Math.sin(elapsedSeconds * 10 + flame.userData.index) * 0.2;
        }
      }
    }
    for (const [id, mesh] of this.obstacleMeshes) {
      if (!obstacleIds.has(id)) {
        this.scene.remove(mesh);
        this.obstacleMeshes.delete(id);
      }
    }
    const pickupIds = new Set<number>();
    for (const pickup of state.pickups) {
      if (pickup.collected) continue;
      pickupIds.add(pickup.id);
      let mesh = this.pickupMeshes.get(pickup.id);
      if (!mesh) {
        mesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
        this.scene.add(mesh);
        this.pickupMeshes.set(pickup.id, mesh);
      }
      mesh.position.set(pickup.lane * LANE_WIDTH, 0.9 + Math.sin(elapsedSeconds * 3 + pickup.id) * 0.06, -pickup.z);
      mesh.rotation.y = elapsedSeconds * 2 + pickup.id;
    }
    for (const [id, mesh] of this.pickupMeshes) {
      if (!pickupIds.has(id)) {
        this.scene.remove(mesh);
        this.pickupMeshes.delete(id);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    // Keep all three lanes visible on portrait phone screens.
    this.camera.fov = width / height < 0.8 ? 66 : 52;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.invalidate();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.obstacleMeshes.clear();
    this.pickupMeshes.clear();
    this.scene.clear();
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.invalidate);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
