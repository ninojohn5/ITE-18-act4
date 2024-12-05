import * as THREE from "three";
import { OrbitControls } from "jsm/controls/OrbitControls.js";
import { UltraHDRLoader } from "jsm/loaders/UltraHDRLoader.js";
import { GLTFLoader } from "jsm/loaders/GLTFLoader.js";
import { GUI } from 'dat.gui';


// Scene Setup
const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.CineonToneMapping; // Default tone mapping
renderer.toneMappingExposure = 0.5; // Start with lower exposure
document.body.appendChild(renderer.domElement);

// OrbitControls Setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 100; // Maximum zoom out
controls.minDistance = 1;  // Minimum zoom in

// Load HDR environment
const hdrLoader = new UltraHDRLoader();
hdrLoader.load("envs/san_giuseppe_bridge_2k.jpg", (hdr) => {
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = hdr;
  scene.environment = hdr;
});

// Load Rubber Duck Model
const gltfLoader = new GLTFLoader().setPath("public/knight_-_includes_file_for_3d_printing/");
gltfLoader.load(
  "scene.gltf",
  (gltf) => {
    console.log("Rubber Duck loaded");
    const rubberDuck = gltf.scene;

    // Compute bounding box and scale the model to fit the scene
    const box = new THREE.Box3().setFromObject(rubberDuck);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const scaleFactor = 5 / maxDimension;
    rubberDuck.scale.setScalar(scaleFactor);

    // Center the model
    const center = box.getCenter(new THREE.Vector3());
    rubberDuck.position.sub(center);
    rubberDuck.position.setY(-box.min.y * scaleFactor);

    // Add realistic material tweaks via traverse
    rubberDuck.traverse((child) => {
      if (child.isMesh) {
        child.material.metalness = window.defaultMetalness;
        child.material.roughness = window.defaultRoughness;
        child.castShadow = true;
        child.receiveShadow = true;
        child.material.needsUpdate = true; // Ensure updates are applied
      }
    });

    // Add the model to the scene
    scene.add(rubberDuck);

    // GUI for Material Adjustments
    const gui = new GUI();

    // Material controls
    const materialFolder = gui.addFolder("Material");
    materialFolder.add(window, "metalness", 0, 1, 0.01).name("Metalness").onChange(() => {
      rubberDuck.traverse((child) => {
        if (child.isMesh) {
          child.material.metalness = window.metalness;
          child.material.needsUpdate = true;
        }
      });
    });
    materialFolder.add(window, "roughness", 0, 1, 0.01).name("Roughness").onChange(() => {
      rubberDuck.traverse((child) => {
        if (child.isMesh) {
          child.material.roughness = window.roughness;
          child.material.needsUpdate = true;
        }
      });
    });

    // Tone mapping controls
    const toneMappingFolder = gui.addFolder("Tone Mapping");
    toneMappingFolder.add(window, 'toneMapping', {
      None: 'NoToneMapping',
      Linear: 'LinearToneMapping',
      Reinhard: 'ReinhardToneMapping',
      Cineon: 'CineonToneMapping',
      ACESFilmic: 'ACESFilmicToneMapping'
    }).name("Tone Mapping").onChange(() => {
      const toneMappingValue = THREE[window.toneMapping];
      renderer.toneMapping = toneMappingValue;
      renderer.toneMappingExposure = window.toneMappingExposure;
      rubberDuck.traverse((child) => {
        if (child.isMesh) {
          child.material.toneMapping = toneMappingValue;
          child.material.toneMappingExposure = window.toneMappingExposure;
          child.material.needsUpdate = true;
        }
      });
    });
    toneMappingFolder.add(window, "toneMappingExposure", 0, 5, 0.01)
      .name("Exposure")
      .onChange(() => {
        renderer.toneMappingExposure = window.toneMappingExposure;
      });

    // Camera and light controls
    const controlsFolder = gui.addFolder("Controls");
    controlsFolder.add(window, "envMapIntensity", 0, 5, 0.01).name("Env Map Intensity").onChange(updateEnvironment);
    controlsFolder.add(window, "lightIntensity", 0, 5, 0.01).name("Light Intensity").onChange(updateLights);
    controlsFolder.add(window, "lightX", -5, 5, 0.1).name("Light X").onChange(updateLights);
    controlsFolder.add(window, "lightY", -5, 5, 0.1).name("Light Y").onChange(updateLights);
    controlsFolder.add(window, "lightZ", -5, 5, 0.1).name("Light Z").onChange(updateLights);
    controlsFolder.add(window, "rotation", -Math.PI, Math.PI, 0.01).name("Rotation").onChange(() => {
      rubberDuck.rotation.y = window.rotation;
    });

    controlsFolder.open();
    materialFolder.open();
    toneMappingFolder.open();

    // Initialize light sources
    const light1 = new THREE.PointLight(0xffffff, window.lightIntensity, 50);
    light1.position.set(window.lightX, window.lightY, window.lightZ);
    scene.add(light1);

    // Update environment settings
    function updateEnvironment() {
      scene.environment.intensity = window.envMapIntensity;
    }

    // Update light settings
    function updateLights() {
      light1.intensity = window.lightIntensity;
      light1.position.set(window.lightX, window.lightY, window.lightZ);
    }

    // Focus camera and controls on the duck
    const cameraDistance = 10;
    controls.target.copy(rubberDuck.position);
    camera.position.set(rubberDuck.position.x, rubberDuck.position.y + 2, rubberDuck.position.z + cameraDistance);
    controls.update();
  },
  undefined,
  (error) => console.error("Error loading Rubber Duck:", error)
);

// Static Lights for Realism
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft ambient light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Animation Loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  controls.update();
}
animate();

// Handle Window Resize
function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", handleWindowResize, false);

// Global variables for GUI controls
window.envMapIntensity = 2.257;
window.lightIntensity = 3;
window.lightX = 0.25;
window.lightY = 3;
window.lightZ = -2.25;
window.rotation = 0;

// Default material properties
window.defaultMetalness = 0.3;
window.defaultRoughness = 0.8;
window.metalness = window.defaultMetalness;
window.roughness = window.defaultRoughness;

// Default tone mapping properties
window.toneMapping = "CineonToneMapping";
window.toneMappingExposure = 0.5;