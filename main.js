import { hashString, WORLD_SEED, seedRand, F2, G2, dot, grad3, p, perm, permMod12, simplex2D } from './math.js';
import { createStationTex, createChestTex, createSlatNormalMap, createNoiseTexture, createLeafTexture, createGrassSideTexture, renderDenimSubtle, createBobTexture, createArmPlaidTexture, createGrassTex, createGlowTex, createMoonTex } from './textures.js';
import { shipX, shipZ, shipY, elevationCache, getBiomeData, isNaturalTreeSpot, getBaseElevation, getRawElevation, findLandingSite, getHighestTerrainY } from './terrain.js';  
import { Chunk, chunkManager, obstacles, blocksData, grassInstances, walkableMeshes, isSolidBlock, isExposed, initChunkEngine } from './chunking.js';
import { inventorySlots, buildInventoryUI, updateInventoryUI, addItemToInventory, giveItemOrDrop, countItem, consumeItem, useTool, getBestTool } from './inventory.js';
import { dropMatsCache, getDropMat, checkResourceRespawn, spawnStick, spawnPebble, spawnDroppedItem, harvestGrass, breakBlock, placeBlock } from './resources.js';
import { environmentUniforms, commonWobbleGLSL, injectTerrainJitter, injectTerrainDepthJitter, injectWindJitter, wobbleInject } from './shaders.js';
import { downRaycaster, downVector, getBobTargetY_Raycast, findPath } from './pathfinding.js';
import { SHIP_FLOOR_Y, SHIP_ELEV, shipGroup, shipShaderUniforms, hatchGroup, hatchMesh, spawnPhoenixLander } from './ship.js';
import { bob, bodyGroup, eyePivot, leftArmMover, rightArmMover, leftFlashLight, rightFlashLight, bobThruster, toolMeshes, initBob } from './bob.js';
import { initEnvironment, updateLightingCycle, getDayWind, ambientLight, sunGlobal, moonGlobal } from './environment.js';

const _v2A = new THREE.Vector2();
const _v2B = new THREE.Vector2();
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3W = new THREE.Vector3();
const _quat = new THREE.Quaternion();

let glassUniforms = { uEyePitch: { value: 0.0 }, uEyeYaw: { value: 0.0 }, uEyeOpen: { value: 1.0 } };

let amberLights = [];
let ambientLightsLastUpdate = 0;

const bodyEl = document.getElementById('body');
const cineBtn = document.getElementById('cineBtn');
const timeSlider = document.getElementById('timeSlider');
const timeControl = document.getElementById('timeControl');
const inventoryModal = document.getElementById('inventoryModal');
const closeInvBtn = document.getElementById('closeInv');

let undergroundCutoutVal = 0.0;
let shipCutoutVal = 0.0;

document.getElementById('seedBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    let input = prompt("Enter an alphanumeric seed (leave blank for random):");
    if (input === null) return; 
    if (input.trim() === '') input = Math.floor(Math.random() * 999999).toString();
    window.location.href = window.location.href.split('?')[0] + '?seed=' + encodeURIComponent(input);
});

const CHUNK_SIZE = 16;
const TEX_RES = 32;
let SPAWN_Y = 0;

let rotationAngle = Math.PI / 4;
let zoomLevel = 15;
let bobState = 'staying';
const bobTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
let targetItem = null;
let targetBlock = null;
let harvestTimer = 0;
let bobVelocityY = 0;
let bobTimer = 2.0;
let waitTimer = 0;
let curiosityTimer = 0;
let blinkTimer = 2.0;
let blinkAction = 0;
let isCinematic = false;
let isFirstPerson = false;
let isDraggingTime = false;

let isInitialized = false;
let physicsEnabled = false;

let currentPath = [];
let pathStepIndex = 0;

const WALK_SPEED = 2.5;
const TURN_SPEED = 7.0;

const activePointers = new Map();
let lastPinchDist = 0;
let lastTime = 0;
let gameTime = 1150;
let currentDay = 0;

let isHolding = false;
let holdStartTime = 0;
let boostActive = false;
let didRotate = false;

let battery = 100;
const batteryBar = document.getElementById('batteryBar');

function updateBattery(amt) {
    battery = Math.max(0, Math.min(100, battery + amt));
    if(batteryBar) {
        batteryBar.style.width = battery + '%';
        batteryBar.style.background = battery > 20 ? '#00ffff' : '#ff0000';
    }
}

const collectibleItems = []; 

const DIRT_MAIN = '#4a3525';
const DIRT_ALT = '#3b291c';
const GRASS_MAIN = '#3a5f1b';
const GRASS_ALT = '#325215';

let scene, camera, renderer, marker;
let orthoCamera, perspCamera, fpvCamera;

let windParticles = [], windIndex = 0, dustSpawnTimer = 0;
let currentWindDir = new THREE.Vector3(1, 0, 0.5).normalize();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const box = new THREE.BoxGeometry(1, 1, 1);

const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

const globalMats = {};
const placedMats = {};

window.scene = scene; window.collectibleItems = collectibleItems;

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0xffaa55, 60, 110); 
    
    orthoCamera = new THREE.OrthographicCamera(-30, 30, 30, -30, 0.1, 1000);
    perspCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
    fpvCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera = orthoCamera;
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });         
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.body.appendChild(renderer.domElement);
    
    initEnvironment(scene);

    const grassTopTex = createNoiseTexture(GRASS_MAIN, GRASS_ALT);
    const grassSideTex = createGrassSideTexture();
    const dirtTex = createNoiseTexture(DIRT_MAIN, DIRT_ALT);
    const stoneTex = createNoiseTexture('#888888', '#777777');
    const bedrockTex = createNoiseTexture('#222222', '#111111');
    const grassAlphaTex = createGrassTex();
    const treeTrunkTex = createNoiseTexture('#4e342e', '#3e2723');
    const treeLeafTex = createLeafTexture('#3e6b1d', '#2b4d13');

    function makeVoxelMat(textures) {
        const mats = Array.isArray(textures) ? textures.map(t => new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })) : new THREE.MeshStandardMaterial({ map: textures, roughness: 0.9 });
        if (Array.isArray(mats)) mats.forEach(m => { m.onBeforeCompile = injectTerrainJitter; });
        else mats.onBeforeCompile = injectTerrainJitter;
        return mats;
    }
    const matGrass = makeVoxelMat([grassSideTex, grassSideTex, grassTopTex, dirtTex, grassSideTex, grassSideTex]);
    if (Array.isArray(matGrass)) matGrass.forEach(m => { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; });
    else { matGrass.emissive.setHex(0x000000); matGrass.emissiveIntensity = 0; }
    
    const matDirt = makeVoxelMat(dirtTex);
    const matStone = makeVoxelMat(stoneTex);
    const matBedrock = makeVoxelMat(bedrockTex);
    
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depthMat.onBeforeCompile = injectTerrainDepthJitter;

    const matTrunk = new THREE.MeshStandardMaterial({ map: treeTrunkTex, roughness: 0.9 });
    const matLeaf = new THREE.MeshStandardMaterial({ map: treeLeafTex, roughness: 0.9, transparent: false, alphaTest: 0.5 });
    matLeaf.shadowSide = THREE.DoubleSide; 
    matLeaf.onBeforeCompile = injectWindJitter;
    
    const windDepthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    
    const windDepthMatLeaf = new THREE.MeshDepthMaterial({ alphaTest: 0.5, map: treeLeafTex, depthPacking: THREE.RGBADepthPacking });
    windDepthMatLeaf.onBeforeCompile = injectWindJitter; 
    
    globalMats.grass = matGrass;
    globalMats.dirt = matDirt;
    globalMats.stone = matStone;
    globalMats.wood = matTrunk;
    globalMats.leaf = matLeaf;
    globalMats.bedrock = matBedrock;
    globalMats.tilled = new THREE.MeshStandardMaterial({color: 0x3e2723, roughness: 0.9});

    placedMats.grass = matGrass;
    placedMats.wood = new THREE.MeshStandardMaterial({ map: treeTrunkTex, roughness: 0.9 });
    placedMats.stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9 });
    placedMats.stone.onBeforeCompile = wobbleInject;
    placedMats.dirt = new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.9 });
    placedMats.dirt.onBeforeCompile = wobbleInject;
    placedMats.tilled = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
    placedMats.tilled.onBeforeCompile = wobbleInject;

    const s = 0.4;
    const hh = 1.0; 
    const gVerts = new Float32Array([
        -s, hh, -s,   s, hh,  s,  -s,  0, -s,   s,  0,  s,
         s, hh, -s,  -s, hh,  s,   s,  0, -s,  -s,  0,  s
    ]);
    const gUvs = new Float32Array([
        0,1, 1,1, 0,0, 1,0,
        0,1, 1,1, 0,0, 1,0
    ]);
    const gIndices = [
        0,2,1, 2,3,1,
        4,6,5, 6,7,5
    ];
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gVerts, 3));
    gGeo.setAttribute('uv', new THREE.BufferAttribute(gUvs, 2));
    gGeo.setIndex(gIndices);
    gGeo.computeVertexNormals(); 

    const customFoliageJitter = `
        #include <begin_vertex>
        vec4 wPos4 = modelMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING
            wPos4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
        
        float origY = position.y;
        float hFactor = max(0.0, origY);
        
        float phase = wPos4.x * 2.0 + wPos4.z * 2.0;
        float swayX = sin(uTime * 3.0 + phase) * 0.15 * uWindForce;
        float swayZ = cos(uTime * 2.5 + phase) * 0.12 * uWindForce;
        
        vec2 pushOffset = wPos4.xz - uBobPos.xz;
        float distToBob = length(pushOffset);
        vec2 pushDir = distToBob > 0.01 ? (pushOffset / distToBob) : vec2(1.0, 0.0);
        
        float influence = smoothstep(1.2, 0.0, distToBob);
        float thrusterWind = influence * sin(uTime * 30.0) * (uBoostActive > 0.5 ? 0.2 : 0.05);
        
        vec2 totalPush = vec2(swayX, swayZ) + pushDir * (influence * 1.5 + thrusterWind);
        vec3 worldPush = vec3(totalPush.x, 0.0, totalPush.y);
        
        #ifdef USE_INSTANCING
            vec3 right = instanceMatrix[0].xyz;
            vec3 up = instanceMatrix[1].xyz;
            vec3 forward = instanceMatrix[2].xyz;
            vec3 localPush = vec3(
                dot(worldPush, right) / dot(right, right),
                dot(worldPush, up) / dot(up, up),
                dot(worldPush, forward) / dot(forward, forward)
            );
        #else
            vec3 localPush = worldPush;
        #endif
        vec2 offsetXZ = vec2(localPush.x, localPush.z) * hFactor;
        
        float maxOffset = origY * 0.95; 
        float currentOffsetLen = length(offsetXZ);
        if (currentOffsetLen > maxOffset && maxOffset > 0.0) {
            offsetXZ = (offsetXZ / currentOffsetLen) * maxOffset;
        }
        
        float newY = sqrt(max(0.0, origY * origY - dot(offsetXZ, offsetXZ)));
        float dropY = origY - newY;
        
        transformed.x += offsetXZ.x;
        transformed.z += offsetXZ.y;
        transformed.y -= dropY;
    `;

    const setupGrassMaterial = (mat) => {
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = environmentUniforms.uTime; shader.uniforms.uWindForce = environmentUniforms.uWindForce; shader.uniforms.uBobPos = environmentUniforms.uBobPos; shader.uniforms.uBoostActive = environmentUniforms.uBoostActive;
            
            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                commonWobbleGLSL + '\nuniform float uTime; uniform float uWindForce; uniform vec3 uBobPos; uniform float uBoostActive;\nvoid main() {'
            );
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', customFoliageJitter);
            
            shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
                vec3 normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
                vec3 geometryNormal = normal;
            `);
        };
    };

    const instMat = new THREE.MeshStandardMaterial({ 
        map: grassAlphaTex, 
        alphaTest: 0.3, 
        roughness: 0.8, 
        side: THREE.DoubleSide, 
        emissive: 0x000000 
    }); 
    setupGrassMaterial(instMat);

    const grassDepthMat = new THREE.MeshDepthMaterial({ 
        depthPacking: THREE.RGBADepthPacking,
        map: grassAlphaTex,
        alphaTest: 0.3,
        side: THREE.DoubleSide
    });
    grassDepthMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = environmentUniforms.uTime; shader.uniforms.uWindForce = environmentUniforms.uWindForce; shader.uniforms.uBobPos = environmentUniforms.uBobPos; shader.uniforms.uBoostActive = environmentUniforms.uBoostActive;
        shader.uniforms.uUndergroundCutoutAmount = environmentUniforms.uUndergroundCutoutAmount;
        shader.uniforms.uCutoutY = environmentUniforms.uCutoutY;
        shader.vertexShader = shader.vertexShader.replace(
            'void main() {',
            commonWobbleGLSL + '\nuniform float uTime; uniform float uWindForce; uniform vec3 uBobPos; uniform float uBoostActive;\nvoid main() {'
        );
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', customFoliageJitter);
    };
    
    initChunkEngine({
        scene: scene,
        globalMats: globalMats,
        box: box,
        depthMat: depthMat,
        windDepthMat: windDepthMat,
        windDepthMatLeaf: windDepthMatLeaf,
        instMat: instMat,
        grassDepthMat: grassDepthMat,
        gGeo: gGeo
    });
    window.box = box; window.scene = scene; window.camera = camera;

    initBob(scene, fpvCamera);
    window.bob = bob;
    window.glassUniforms = glassUniforms;

    window.spawnInitialResources = function() {
        var resourceMemory = window.resourceMemory ?? { stickLocations: [], pebbleLocations: [], harvestedSticks: [], harvestedPebbles: [] };
        window.resourceMemory = resourceMemory;
        
        const spawnRadius = 25; 
        let stickCount = 0;
        let pebbleCount = 0;

        for (let x = -spawnRadius; x <= spawnRadius; x++) {
            for (let z = -spawnRadius; z <= spawnRadius; z++) {
                let wx = Math.round(shipX + x);
                let wz = Math.round(shipZ + z);
                if (obstacles && obstacles.has(wx + ',' + wz)) continue;
                
                if (pebbleCount < 30 && Math.random() < 0.015) {
                    spawnPebble(wx, wz, { isSlope: false });
                    resourceMemory.pebbleLocations.push({x: wx, z: wz});
                    pebbleCount++;
                }

                let bData = getBiomeData(wx, wz);
                if (stickCount < 40 && isNaturalTreeSpot(wx, wz, bData) && Math.random() < 0.2) {
                    spawnStick(wx, wz, { isUnderTree: true });
                    resourceMemory.stickLocations.push({x: wx, z: wz});
                    stickCount++;
                }
            }
        }
    };
    
    for (let i = 0; i < 20; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffee, transparent: true, opacity: 0.5 })); p.visible = false; p.userData = { life: 0, vel: new THREE.Vector3(), rotSpeed: new THREE.Vector3() }; scene.add(p); windParticles.push(p); }
    marker = new THREE.Group(); const xMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.8 });
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.15), xMat), bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.15), xMat);
    bar1.rotation.y = Math.PI/4; bar2.rotation.y = -Math.PI/4; marker.add(bar1, bar2); marker.position.y = 0.55; marker.visible = false; scene.add(marker);
    
    const pathGeo = new THREE.BufferGeometry();
    const pathPositions = new Float32Array(1000 * 3);
    pathGeo.setAttribute('position', new THREE.BufferAttribute(pathPositions, 3));
    const pathMat = new THREE.PointsMaterial({ color: 0x00ffff, size: 0.2, transparent: true, opacity: 0.4, sizeAttenuation: true });
    const pathDots = new THREE.Points(pathGeo, pathMat);
    pathDots.frustumCulled = false;
    pathDots.visible = false;
    scene.add(pathDots);
    window.pathDots = pathDots;

    buildInventoryUI(); updateCamera();

    function stopInput() { isHolding = false; boostActive = false; activePointers.clear(); bodyEl.classList.remove('speeding'); }
    timeSlider.addEventListener('pointerdown', (e) => { e.stopPropagation(); isDraggingTime = true; });
    timeSlider.addEventListener('pointerup', (e) => { e.stopPropagation(); isDraggingTime = false; });
    
    let sunAngle = (gameTime % 1440) / 1440 * Math.PI * 2 - Math.PI/2;
    let sunY = Math.sin(sunAngle);
    timeSlider.addEventListener('input', (e) => { 
        gameTime = parseFloat(timeSlider.value); 
        sunAngle = (gameTime % 1440) / 1440 * Math.PI * 2 - Math.PI/2;
        sunY = Math.sin(sunAngle);
    });
    
    cineBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    cineBtn.addEventListener('pointerup', (e) => { e.stopPropagation(); isCinematic = !isCinematic; if (isCinematic) { cineBtn.classList.add('active'); timeControl.classList.add('hidden'); stopInput(); } else { cineBtn.classList.remove('active'); timeControl.classList.remove('hidden'); } });
    const firstPersonBtn = document.getElementById('firstPersonBtn');
    firstPersonBtn.addEventListener('pointerup', (e) => { e.stopPropagation(); isFirstPerson = !isFirstPerson; if (isFirstPerson) { firstPersonBtn.classList.add('active'); cineBtn.classList.add('hidden'); stopInput(); } else { firstPersonBtn.classList.remove('active'); cineBtn.classList.remove('hidden'); } updateCamera(); });
    
    closeInvBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    closeInvBtn.addEventListener('pointerup', (e) => { e.stopPropagation(); inventoryModal.classList.remove('active'); });
    inventoryModal.addEventListener('pointerdown', (e) => e.stopPropagation());
    inventoryModal.addEventListener('pointerup', (e) => e.stopPropagation());

    window.addEventListener('pointerdown', (e) => {
        if (e.target.id === 'seedBtn') return;
        if (isFirstPerson) { isFirstPerson = false; firstPersonBtn.classList.remove('active'); cineBtn.classList.remove('hidden'); stopInput(); updateCamera(); return; }
        if (isCinematic) { isCinematic = false; cineBtn.classList.remove('active'); timeControl.classList.remove('hidden'); stopInput(); return; }
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
        isHolding = true; holdStartTime = Date.now(); didRotate = false;
    });

    window.addEventListener('pointermove', (e) => {
        if (!activePointers.has(e.pointerId)) return;
        const prev = activePointers.get(e.pointerId); const current = { x: e.clientX, y: e.clientY, startX: prev.startX, startY: prev.startY };
        const dragDist = Math.hypot(current.x - current.startX, current.y - current.startY); if (dragDist > 10) didRotate = true;
        
        if (activePointers.size === 1 && isHolding && didRotate) { 
            const dx = current.x - prev.x; const dy = current.y - prev.y;
            rotationAngle += dx * 0.005; 
            cameraPitch += dy * 0.005;
            cameraPitch = Math.max(45 * Math.PI/180, Math.min(60 * Math.PI/180, cameraPitch));
            updateCamera(); 
        }
        else if (activePointers.size === 2) { const pts = Array.from(activePointers.values()); const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); if (lastPinchDist > 0) { zoomLevel = Math.max(2, Math.min(100, zoomLevel + (lastPinchDist - dist) * 0.05)); updateCamera(); } lastPinchDist = dist; }
        activePointers.set(e.pointerId, current);
    });

    window.addEventListener('pointerup', (e) => {
        if (activePointers.size === 1 && !boostActive && !didRotate && isInitialized) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const bobHit = raycaster.intersectObject(bodyGroup, true);
            if (bobHit.length > 0) { stopInput(); inventoryModal.classList.add('active'); }
            else {
                let hitTargets = [...walkableMeshes];
                if (shipGroup) hitTargets.push(shipGroup);
                chunkManager.activeChunks.forEach(c => {
                    c.meshes.forEach(m => { if (m.userData.isGrass) hitTargets.push(m); });
                });
                
                const intersects = raycaster.intersectObjects(hitTargets, true);
                
                if (intersects.length > 0) {
                    let tx = Math.round(intersects[0].point.x);
                    let tz = Math.round(intersects[0].point.z);
                    let tY = getBobTargetY_Raycast(tx, getHighestTerrainY(tx, tz), tz);
                    
                    let isInsideShip = (Math.abs(bob.position.x - shipX) <= 3.5 && Math.abs(bob.position.z - shipZ) <= 3.5 && bob.position.y >= shipY + SHIP_FLOOR_Y + SHIP_ELEV - 0.5);
                    let rampLength = 9.0;
                    let apothem = window.shipApothem || 2.31;
                    let isOnRamp = (Math.abs(bob.position.x - shipX) <= 1.5 && bob.position.z >= shipZ + apothem && bob.position.z <= shipZ + apothem + rampLength && bob.position.y >= shipY + SHIP_ELEV);
                    
                    let floorY = shipY + SHIP_ELEV + SHIP_FLOOR_Y;
                    let inside = new THREE.Vector3(shipX, floorY, shipZ);
                    let doorPos = new THREE.Vector3(shipX, floorY, shipZ + apothem);
                    let alignRamp = new THREE.Vector3(shipX, window.rampGroundY || getHighestTerrainY(shipX, Math.round(window.worldRampEndZ || shipZ + apothem + 9.0)) + 0.6, window.worldRampEndZ || shipZ + apothem + 9.0);
                    
                    let clickIsShip = intersects[0].object.userData && intersects[0].object.userData.isShip;
                    if (intersects[0].object.userData.isGrass) {
                        harvestGrass(intersects[0].object, intersects[0].instanceId);
                        return;
                    }
                    
                    if (clickIsShip) {
                        if (isInsideShip) {
                            currentPath = [inside];
                        } else if (isOnRamp) {
                            currentPath = [doorPos, inside];
                        } else {
                            let pathGrid = findPath(bob.position, alignRamp);
                            if (pathGrid) {
                                currentPath = [...pathGrid, doorPos, inside];
                            } else {
                                currentPath = [alignRamp, doorPos, inside];
                            }
                        }
                        pathStepIndex = 0; bobState = 'walking'; targetItem = null; targetBlock = null; 
                        marker.position.copy(inside); marker.position.y += 0.05;
                        marker.visible = true; marker.scale.setScalar(0.1); waitTimer = 0;
                        bob.targetPosition.copy(currentPath[0]);
                    } else if (tY !== null) {
                        bobTarget.set(tx, tY, tz); 
                        
                        let targetIsOutside = Math.abs(tx - shipX) > 3.5 || Math.abs(tz - shipZ) > 3.5;

                        if (isInsideShip && targetIsOutside) {
                            let pathOut = findPath(alignRamp, bobTarget);
                            if (pathOut) {
                                currentPath = [doorPos, alignRamp, ...pathOut];
                                pathStepIndex = 0; bobState = 'walking'; marker.visible = true; marker.position.set(tx, tY + 0.05, tz); marker.scale.setScalar(0.1); waitTimer = 0;
                                bob.targetPosition.copy(currentPath[0]);
                            }
                        } else if (isOnRamp && targetIsOutside) {
                            let pathOut = findPath(alignRamp, bobTarget);
                            if (pathOut) {
                                currentPath = [alignRamp, ...pathOut];
                                pathStepIndex = 0; bobState = 'walking'; marker.visible = true; marker.position.set(tx, tY + 0.05, tz); marker.scale.setScalar(0.1); waitTimer = 0;
                                bob.targetPosition.copy(currentPath[0]);
                            }
                        } else {
                            const path = findPath(bob.position, bobTarget);
                            if (path) { currentPath = path; pathStepIndex = 0; bobState = 'walking'; targetItem = null; targetBlock = null; marker.position.set(tx, tY + 0.05, tz); marker.visible = true; marker.scale.setScalar(0.1); waitTimer = 0; bob.targetPosition.copy(currentPath[0]); }
                        }
                    }
                }
            }
        }
        activePointers.delete(e.pointerId); lastPinchDist = 0;
        if(activePointers.size === 0) stopInput();
    });
    window.addEventListener('pointercancel', stopInput);
    window.addEventListener('wheel', (e) => { if(!isCinematic && !isFirstPerson) { zoomLevel = Math.max(2, Math.min(100, zoomLevel + e.deltaY * 0.03)); updateCamera(); } });
    window.addEventListener('resize', () => { 
        renderer.setSize(window.innerWidth, window.innerHeight); 
        perspCamera.aspect = window.innerWidth / window.innerHeight;
        perspCamera.updateProjectionMatrix();
        updateCamera();
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isFirstPerson) { isFirstPerson = false; firstPersonBtn.classList.remove('active'); cineBtn.classList.remove('hidden'); stopInput(); updateCamera(); }
            else if (isCinematic) { isCinematic = false; cineBtn.classList.remove('active'); timeControl.classList.remove('hidden'); stopInput(); }
        }
    });
}

var cameraPitch = window.cameraPitch ?? 45 * Math.PI / 180; window.cameraPitch = cameraPitch;

function updateCamera() {
    if (!camera || !bob) return;
    const aspect = window.innerWidth / window.innerHeight;
    
    if (isFirstPerson && typeof fpvCamera !== 'undefined') {
        fpvCamera.aspect = window.innerWidth / window.innerHeight;
        fpvCamera.updateProjectionMatrix();
    } else {
        if (camera !== orthoCamera) camera = orthoCamera;
        const d = 50; 
        
        const camY = Math.sin(cameraPitch) * d;
        const xz = Math.cos(cameraPitch) * d;
        
        camera.position.set(
            bob.position.x + Math.cos(rotationAngle)*xz, 
            bob.position.y + camY, 
            bob.position.z + Math.sin(rotationAngle)*xz
        );
        
        camera.lookAt(bob.position);
        
        camera.left = -zoomLevel * aspect;
        camera.right = zoomLevel * aspect;
        camera.top = zoomLevel;
        camera.bottom = -zoomLevel;
    }
    camera.updateProjectionMatrix();
}

let bootPhase = 0;
let frameCount = 0;
let lastFpsTime = performance.now();
const fpsEl = document.getElementById('fpsCounter');

function animate(time) {
    requestAnimationFrame(animate);

    frameCount++;
    if (time - lastFpsTime >= 1000) {
        if(fpsEl) fpsEl.innerText = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsTime = time;
    }
    
    if (!isInitialized) {
        const updateUI = (text, pct) => {
            document.getElementById('loadingText').innerText = text;
            document.getElementById('progressBar').style.width = pct + '%';
            document.getElementById('bobIcon').style.left = pct + '%';
            document.getElementById('progressPct').innerText = pct + '%';
        };

        const yieldToBrowser = (callback) => {
            setTimeout(() => requestAnimationFrame(callback), 20);
        };

        if (bootPhase === 0) {
            updateUI("CALIBRATING SENSORS...", 10);
            bootPhase = 1;
        } else if (bootPhase === 1) {
            updateUI("SCANNING LANDING SITE...", 25);
            bootPhase = 1.5; 
            yieldToBrowser(() => {
                findLandingSite();
                if(window.sunGlobal) window.sunGlobal.target.position.set(shipX, shipY, shipZ);
                bootPhase = 2;
            });
        } else if (bootPhase === 2) {
            updateUI("CONSTRUCTING PHOENIX LANDER...", 40);
            bootPhase = 2.5; 
            yieldToBrowser(() => {
                spawnPhoenixLander(scene);
                bootPhase = 3;
            });
        } else if (bootPhase === 3) {
            updateUI("SCATTERING RESOURCES...", 55);
            bootPhase = 3.5; 
            yieldToBrowser(() => {
                spawnInitialResources();
                bootPhase = 4;
            });
        } else if (bootPhase === 4) {
            let targetPos = new THREE.Vector3(shipX, shipY, shipZ + 10);
            let zLevel = Math.max(10, zoomLevel);
            
            chunkManager.update(targetPos, zLevel, false); 
            
            let radius = Math.min(5, Math.max(3, Math.ceil(zLevel / 12)));
            let targetCount = Math.pow(radius * 2 + 1, 2);
            
            let bx = Math.floor(targetPos.x / CHUNK_SIZE), bz = Math.floor(targetPos.z / CHUNK_SIZE);
            let currentLoaded = 0;
            for(let x = bx - radius; x <= bx + radius; x++) {
                for(let z = bz - radius; z <= bz + radius; z++) {
                    if (chunkManager.activeChunks.has(`${x},${z}`)) currentLoaded++;
                }
            }
            
            let pct = 55 + Math.floor((currentLoaded / targetCount) * 35); 
            updateUI(`MAPPING TERRAIN (${currentLoaded}/${targetCount})...`, pct);
            
            if (currentLoaded >= targetCount) {
                bootPhase = 5;
            }
            return; 
        } else if (bootPhase === 5) {
            updateUI("COMPILING SHADERS...", 90);
            bootPhase = 5.5; 
            yieldToBrowser(() => {
                bob.position.set(shipX, shipY + SHIP_FLOOR_Y + SHIP_ELEV + 0.1, shipZ + 1.0);
                updateCamera();
                renderer.compile(scene, camera);
                bootPhase = 6;
            });
        } else if (bootPhase === 6) {
            updateUI("FINALIZING RENDER...", 95);
            bootPhase = 6.5;
            yieldToBrowser(() => {
                renderer.render(scene, camera);
                bootPhase = 7;
            });
        } else if (bootPhase === 7) {
            updateUI("BOB READY.", 100);
            bootPhase = 7.5; 
            isInitialized = true;
            
            document.getElementById('loadingUI').style.opacity = 0;
            setTimeout(() => {
                document.getElementById('loadingUI').style.display = 'none';
                physicsEnabled = true; 
                bobState = 'DEBARK';
                bob.targetPosition = new THREE.Vector3(shipX, shipY + SHIP_ELEV + 0.6, shipZ + 12);
                bobTarget.copy(bob.targetPosition);
            }, 500); 
        }
        
        return;
    }


    if (isHolding && !boostActive && Date.now() - holdStartTime > 1000) { boostActive = true; bodyEl.classList.add('speeding'); }
    const timeScale = boostActive ? 2.0 : 1.0;
    const dt = Math.min((time - lastTime) * 0.001, 0.1) * timeScale; lastTime = time;
    if (isCinematic) { rotationAngle += dt * 0.12; updateCamera(); }
    
    let sunAngle;
    if (!isDraggingTime) { 
        gameTime += dt * 1.0; 
        if(gameTime > 1440) {
            gameTime = 0;
            currentDay++;
            checkResourceRespawn();
        }
        timeSlider.value = gameTime; 
    } else { 
        gameTime = parseFloat(timeSlider.value); 
    }
    
    environmentUniforms.uTime.value = gameTime * 0.1;
    if (window.celestial) {
        if (window.celestial.sun) window.celestial.sun.material.uniforms.uTime.value = gameTime * 0.1;
        if (window.celestial.stars) window.celestial.stars.material.uniforms.uTime.value = gameTime * 0.1;
    }
    const dayLength = 1440, dayProgress = (gameTime % dayLength) / dayLength;
    const windForce = 0.1 + (getDayWind(currentDay) * (1 - dayProgress) + getDayWind(currentDay + 1) * dayProgress) * 1.5; environmentUniforms.uWindForce.value = windForce;
    sunAngle = dayProgress * Math.PI * 2 - Math.PI/2; 
    const sunY = Math.sin(sunAngle);
    
    if (window.sunGlobal && environmentUniforms.uSunPos && environmentUniforms.uSunIntensity) {
        let sx = Math.cos(sunAngle) * 80;
        let sy = Math.sin(sunAngle) * 80;
        let sz = Math.cos(sunAngle) * 32;
        
        let snapX = bob.position.x;
        let snapZ = bob.position.z;
        let snapY = bob.position.y;
        let bData = getBiomeData(bob.position.x, bob.position.z);
        window.currentHumidity = bData.humid;
        updateLightingCycle(scene, camera, zoomLevel, sunAngle, sunY, sx, sy, sz, snapX, snapY, snapZ, window.currentHumidity);
    }

    camera.updateMatrixWorld();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    ambientLightsLastUpdate = (ambientLightsLastUpdate || 0) + dt;
    if (ambientLightsLastUpdate > 0.05) {
        ambientLightsLastUpdate = 0;
        amberLights.forEach(item => {
            if (item && item.mat) {
                item.mat.emissiveIntensity = 0.8 + Math.sin(gameTime * 15.0 + item.offset) * 1.2;
            }
        });
    }

    for (let m of walkableMeshes) {
        if (m.userData.needsRangeUpdate && m.instanceMatrix) {
            m.instanceMatrix.updateRange.offset = m.userData.updateMin * 16;
            m.instanceMatrix.updateRange.count = (m.userData.updateMax - m.userData.updateMin + 1) * 16;
            m.instanceMatrix.needsUpdate = true;
            m.userData.needsRangeUpdate = false;
            m.userData.updateMin = null;
            m.userData.updateMax = null;
        }
    }

    if (bob) {
        chunkManager.update(bob.position, zoomLevel);
        
        let curElev = getRawElevation(Math.round(bob.position.x), Math.round(bob.position.z));
        let isInsideShip = (Math.abs(bob.position.x - shipX) <= 3.5 && Math.abs(bob.position.z - shipZ) <= 3.5 && bob.position.y >= shipY + SHIP_FLOOR_Y + SHIP_ELEV - 0.5);
        let isUnder = bob.position.y < curElev - 0.5;
        
        let targetUnderground = isUnder ? 1.0 : 0.0;
        undergroundCutoutVal += (targetUnderground - undergroundCutoutVal) * dt * 1.5;
        window.undergroundCutoutVal = undergroundCutoutVal;
        var smoothedCutoutY = window.smoothedCutoutY ?? bob.position.y;
        if (targetUnderground > 0.5) {
            smoothedCutoutY += (bob.position.y - smoothedCutoutY) * dt * 5.0;
        }
        window.smoothedCutoutY = smoothedCutoutY;
        
        if (environmentUniforms.uCutoutY) environmentUniforms.uCutoutY.value = smoothedCutoutY;
        if (environmentUniforms.uUndergroundCutoutAmount) environmentUniforms.uUndergroundCutoutAmount.value = undergroundCutoutVal;
        
        let targetShip = isInsideShip ? 1.0 : 0.0;
        shipCutoutVal += (targetShip - shipCutoutVal) * dt * 1.5;
        window.shipCutoutVal = shipCutoutVal;
        
        shipShaderUniforms.forEach(u => {
            if(u.uIsInsideShip) u.uIsInsideShip.value = isInsideShip ? 1.0 : 0.0;
            if(u.uShipCutoutAmount) u.uShipCutoutAmount.value = shipCutoutVal;
            if(u.uIsFirstPerson) u.uIsFirstPerson.value = isFirstPerson ? 1.0 : 0.0;
        });

        if (window.shipRampGroup && window.rampSegments) {
            let relX = Math.abs(bob.position.x - shipX);
            let relZ = bob.position.z - shipZ;
            let apothem = 2.5 * Math.cos(Math.PI / 8); 
            let rampLen = 9.0;
            
            let isNearRamp = (relX < 6.0 && relZ > 0.0 && relZ < apothem + rampLen + 8.0 && bob.position.y > curElev - 4.0);
            
            window.targetRampState = isNearRamp ? 1.0 : 0.0;
            window.rampState += (window.targetRampState - window.rampState) * dt * 4.0;
            
            for(let i=0; i<window.rampSegments.length; i++) {
                let seg = window.rampSegments[i];
                seg.position.z = THREE.MathUtils.lerp(seg.userData.retZ, seg.userData.extZ, window.rampState);
                seg.position.y = THREE.MathUtils.lerp(seg.userData.retY, seg.userData.extY, window.rampState);
                seg.rotation.x = THREE.MathUtils.lerp(seg.userData.retRotX, seg.userData.extRotX, window.rampState);
                seg.updateMatrixWorld(true);
            }
        }

        if (hatchMesh) {
            let relZ = bob.position.z - shipZ;
            let relX = Math.abs(bob.position.x - shipX);
            let relY = bob.position.y - (shipY + SHIP_FLOOR_Y + SHIP_ELEV);
            
            let isOpen = (relX < 1.5 && relZ > 2.0 && relZ < 6.0 && relY > -0.5);
            
            let closedZ = 0.00;
            let closedY = 2.5 / 2;
            let openZ = 0.4;
            let openY = (2.5 / 2) + 2.4;
            
            if (isOpen) {
                hatchMesh.position.z += (openZ - hatchMesh.position.z) * dt * 10.0;
                if (hatchMesh.position.z > 0.2) hatchMesh.position.y += (openY - hatchMesh.position.y) * dt * 8.0;
            } else {
                hatchMesh.position.y += (closedY - hatchMesh.position.y) * dt * 8.0;
                if (hatchMesh.position.y < closedY + 0.2) hatchMesh.position.z += (closedZ - hatchMesh.position.z) * dt * 10.0;
            }
        }

        if (physicsEnabled && bobState !== 'FREEZE') {
            let terrainHeight = getBobTargetY_Raycast(bob.position.x, bob.position.y, bob.position.z);
            
            if (terrainHeight === null) {
                terrainHeight = Math.max(0, getHighestTerrainY(Math.round(bob.position.x), Math.round(bob.position.z)));
            }
            
            let targetHeight = terrainHeight + 0.6; 
            let diff = targetHeight - bob.position.y;
            
            if (bobState.startsWith('walking') || bobState === 'WALKING' || bobState === 'DEBARK') {
                if (diff >= 2.1 && bobVelocityY <= 0) {
                    bobVelocityY = 7.0; 
                } else if (diff >= 1.1 && bobVelocityY <= 0) {
                    bobVelocityY = 5.0; 
                }
            }
            
            if (bobVelocityY > 0) {
                bobVelocityY -= 20.0 * dt; 
                bob.position.y += bobVelocityY * dt;
                if (bobVelocityY < 0 && bob.position.y <= targetHeight) {
                    bob.position.y = targetHeight;
                    bobVelocityY = 0;
                }
            } else {
                bobVelocityY = 0; 
                bob.position.y += diff * dt * 10.0; 
            }
            
            if (environmentUniforms.uBobIsUnderground) environmentUniforms.uBobIsUnderground.value = isUnder ? 1.0 : 0.0;
            
            if (bob.position.y <= shipY + SHIP_FLOOR_Y + SHIP_ELEV + 0.5 && bobVelocityY === 0 && (typeof missionState !== 'undefined' && missionState !== 'done')) {
                if (typeof runAutonomousMission === 'function') runAutonomousMission(dt);
            }
        }
        
        if (isInsideShip && bobVelocityY === 0 && bobState === 'staying') {
            updateBattery(5.0 * dt);
        } else {
            if (bobState === 'staying' || bobState === 'thinking') updateBattery(-0.05 * dt);
        }
        
        for (let i = collectibleItems.length - 1; i >= 0; i--) {
            let itm = collectibleItems[i];
            if (itm.isCrop) continue;
            
            let bx = Math.round(itm.mesh.position.x), bz = Math.round(itm.mesh.position.z);
            let yOffset = 0.075;
            if (itm.type === 'pebble') yOffset = 0.056;
            if (itm.type === 'stick') yOffset = 0.0; 
            
            let targetY = getHighestTerrainY(bx, bz) + 0.45 + yOffset;
            if (Math.abs(bx - shipX) <= 3.5 && Math.abs(bz - shipZ) <= 3.5) targetY = shipY + SHIP_FLOOR_Y + SHIP_ELEV + 0.55;
            
            let dist = Math.hypot(bob.position.x - itm.mesh.position.x, bob.position.z - itm.mesh.position.z);
            if (dist < 1.5) {
                let allowedWithoutTools = ['fiber', 'pebble', 'stick'];
                if (!allowedWithoutTools.includes(itm.type)) {
                    let hasTool = false;
                    for(let s of inventorySlots) {
                        if (s.type && (s.type === 'pickaxe' || s.type === 'axe' || s.type === 'shovel' || s.type === 'hoe')) {
                            hasTool = true; break;
                        }
                    }
                    if (!hasTool) continue;
                }

                let currentCount = countItem(itm.type);
                if (currentCount < 5 && addItemToInventory(itm.type, 1)) {
                    scene.remove(itm.mesh);
                    collectibleItems.splice(i, 1);
                    
                    if (itm.type === 'stick') {
                        if (!resourceMemory.harvestedSticks) resourceMemory.harvestedSticks = [];
                        resourceMemory.harvestedSticks.push({
                            x: bx, z: bz, 
                            harvestedDate: currentDay, 
                            isUnderTree: itm.metadata ? itm.metadata.isUnderTree : false
                        });
                    }
                    if (itm.type === 'pebble') {
                        if (!resourceMemory.harvestedPebbles) resourceMemory.harvestedPebbles = [];
                        resourceMemory.harvestedPebbles.push({
                            x: bx, z: bz, 
                            harvestedDate: currentDay, 
                            isSlope: itm.metadata ? itm.metadata.isSlope : false
                        });
                    }

                    let memList = itm.type === 'stick' ? resourceMemory.stickLocations : resourceMemory.pebbleLocations;
                    let mIdx = memList.findIndex(p => Math.abs(p.x - bx) < 1 && Math.abs(p.z - bz) < 1);
                    if (mIdx > -1) memList.splice(mIdx, 1);
                    continue;
                }
            }
            
            if (itm.mesh.position.y > targetY + 0.05) itm.mesh.position.y -= dt * 6.0;
            else if (itm.mesh.position.y < targetY - 0.05) itm.mesh.position.y = targetY;
        }
        
        let cx = Math.floor(bob.position.x / CHUNK_SIZE);
        let cz = Math.floor(bob.position.z / CHUNK_SIZE);
        let currentChunk = chunkManager.activeChunks.get(`${cx},${cz}`);
        if (currentChunk && currentChunk.grassInstances) {
            currentChunk.grassInstances.forEach(g => {
                if (g.active && Math.abs(g.x - bob.position.x) < 5 && Math.abs(g.z - bob.position.z) < 5) {
                    g.metadata.lastSeen = gameTime;
                    g.metadata.confidence = 1.0;
                }
            });
        }

        if (marker.visible) { marker.scale.lerp(new THREE.Vector3(1,1,1), 0.1 * timeScale); marker.rotation.y += dt * 2; }
        
        if (environmentUniforms.uBobPos) environmentUniforms.uBobPos.value.copy(bob.position); 
        if (environmentUniforms.uBoostActive) environmentUniforms.uBoostActive.value = boostActive ? 1.0 : 0.0;
        
        blinkTimer -= dt; if (blinkTimer <= 0 && blinkAction === 0) blinkAction = 1;
        
        let eyeOpen = 1.0;
        if (blinkAction === 1) { 
            eyeOpen = Math.max(0.1, 1.0 - (2.0 - blinkTimer) * 5.0);
             if(eyeOpen <= 0.1) blinkAction = 2;
        } else if (blinkAction === 2) {
            eyeOpen = Math.min(1.0, window.glassUniforms.uEyeOpen.value + dt * 15);
            if (eyeOpen >= 1.0) { eyeOpen = 1.0; blinkAction = 0; blinkTimer = 2 + Math.random() * 4; }
        }
        window.glassUniforms.uEyeOpen.value = eyeOpen;
        
        let lightFactor = 0.1 + Math.max(0, (1.0 - Math.max(0, sunY)) * 0.9);
        if (leftFlashLight && rightFlashLight) { leftFlashLight.intensity = rightFlashLight.intensity = 3.0 * lightFactor * (blinkAction > 0 ? (0.4 + eyeOpen * 0.6) : 1.0); }
        
        if (bobState === 'thinking') {
            if (window.pathDots) window.pathDots.visible = false;
            curiosityTimer -= dt; if(curiosityTimer <= 0) { lookTarget.set(bob.position.x+(Math.random()-0.5)*25, bob.position.y, bob.position.z+(Math.random()-0.5)*25); curiosityTimer = 0.5+Math.random()*1.5; }
            bobTimer -= dt; 
            if(bobTimer <= 0) { 
                let findTarget = null; let tx = Math.floor(bob.position.x + (Math.random()*28-14)), tz = Math.floor(bob.position.z + (Math.random()*28-14)); 
                if (!obstacles.has(tx + ',' + tz)) {
                    let ty = getBobTargetY_Raycast(tx, bob.position.y, tz) ?? (getHighestTerrainY(tx, tz) + 0.6);
                    findTarget = new THREE.Vector3(tx, ty, tz); 
                }
                targetItem = null;
                if (findTarget) { const path = findPath(bob.position, findTarget); if (path) { currentPath = path; pathStepIndex = 0; bob.targetPosition.copy(findTarget); bobState = 'walking'; marker.visible = false; } }
                bobTimer = 1.0;
            }
            bodyGroup.rotation.z *= Math.pow(0.95, timeScale); leftArmMover.rotation.x *= Math.pow(0.9, timeScale); rightArmMover.rotation.x *= Math.pow(0.9, timeScale);
        } 
        else if (bobState === 'DEBARK' || bobState === 'walking' || bobState === 'WALKING' || bobState === 'PLANT_FLAG') {
            if (bobState === 'walking' || bobState === 'WALKING') {
                let stepTarget = currentPath ? currentPath[pathStepIndex] : null;
                if (stepTarget) {
                    let ty = stepTarget.y; 
                    if (ty === undefined) ty = getBobTargetY_Raycast(stepTarget.x, bob.position.y, stepTarget.z) ?? (getHighestTerrainY(stepTarget.x, stepTarget.z) + 0.6);
                    bob.targetPosition.set(stepTarget.x, ty, stepTarget.z);
                }
            }
            
            _v2A.set(bob.position.x, bob.position.z);
            _v2B.set(bob.targetPosition.x, bob.targetPosition.z);
            let dist = _v2A.distanceTo(_v2B);

            if (dist > 0.1) {
                updateBattery(-0.1 * dt);
                let moveAmount = Math.min(WALK_SPEED * dt, dist);
                
                let dir2D_x = (_v2B.x - _v2A.x) / dist;
                let dir2D_y = (_v2B.y - _v2A.y) / dist;
                _v2A.x += dir2D_x * moveAmount;
                _v2A.y += dir2D_y * moveAmount;
                
                bob.position.x = _v2A.x;
                bob.position.z = _v2A.y;

                let dir = new THREE.Vector3(bob.targetPosition.x - bob.position.x, 0, bob.targetPosition.z - bob.position.z).normalize();
                if (dir.lengthSq() > 0) {
                    let targetRot = Math.atan2(dir.x, dir.z);
                    let diff = targetRot - bob.rotation.y; 
                    while(diff > Math.PI) diff -= Math.PI*2; while(diff < -Math.PI) diff += Math.PI*2;
                    bob.rotation.y += diff * TURN_SPEED * dt;
                }
                bodyGroup.rotation.z = Math.sin(gameTime * 8.0) * 0.15; leftArmMover.rotation.x = Math.sin(gameTime * 8.0) * 0.8; rightArmMover.rotation.x = Math.sin(gameTime * 8.0 + Math.PI) * 0.8;
                
                _v3A.set(0, 0, 10).applyMatrix4(bob.matrixWorld);
                lookTarget.lerp(_v3A, dt * 5.0);
                
                if(bobThruster) bobThruster.visible = (bobVelocityY > 0.1); 
            } else {
                if (bobState === 'walking' || bobState === 'WALKING') {
                    pathStepIndex++;
                    if (!currentPath || pathStepIndex >= currentPath.length) {
                        bobState = 'staying'; waitTimer = 1.0; marker.visible = false; 
                    }
                } else if (bobState === 'DEBARK') {
                    bobState = 'PLANT_FLAG';
                } else if (bobState === 'PLANT_FLAG') {
                    if (typeof spawnFlag === 'function') spawnFlag(bob.position.x, bob.position.z);
                    bobState = 'staying';
                    waitTimer = 1.0;
                    window.missionState = 'done';
                }
                if(bobThruster) bobThruster.visible = false;
            }
            
            if (window.pathDots && currentPath) {
                const posAttr = window.pathDots.geometry.attributes.position;
                let count = 0;
                posAttr.setXYZ(count++, bob.position.x, bob.position.y + 0.2, bob.position.z);
                for (let i = pathStepIndex; i < currentPath.length; i++) {
                    if (count >= 1000) break;
                    posAttr.setXYZ(count++, currentPath[i].x, currentPath[i].y + 0.2, currentPath[i].z);
                }
                window.pathDots.geometry.setDrawRange(0, count);
                posAttr.needsUpdate = true;
                window.pathDots.visible = true;
            }
        }
        else if (bobState === 'staying' || bobState === 'IDLE') { if (window.pathDots) window.pathDots.visible = false; waitTimer -= dt; bodyGroup.rotation.z *= Math.pow(0.95, timeScale); leftArmMover.rotation.x *= Math.pow(0.9, timeScale); rightArmMover.rotation.x *= Math.pow(0.9, timeScale); curiosityTimer -= dt; if(curiosityTimer <= 0) { lookTarget.set(bob.position.x+(Math.random()-0.5)*10, bob.position.y, bob.position.z+(Math.random()-0.5)*10); curiosityTimer = 1.0; } if (waitTimer <= 0 && (typeof missionState !== 'undefined' && missionState === 'done')) { bobState = 'thinking'; bobTimer = 1.0; marker.visible = false; } }
        
        else if (bobState === 'thinking') {
            // Smart resource seeking logic
            bobTimer -= dt;
            let stickCount = countItem('stick');
            let pebbleCount = countItem('pebble');
            let hasNearbyStick = false;
            let hasNearbyPebble = false;
            let nearbyStickPos = null;
            let nearbyPebblePos = null;
            
            // Check for nearby items (within 15 blocks)
            for (let item of collectibleItems) {
                if (item.type === 'stick' && Math.hypot(item.mesh.position.x - bob.position.x, item.mesh.position.z - bob.position.z) < 15) {
                    hasNearbyStick = true;
                    if (!nearbyStickPos) nearbyStickPos = {x: item.mesh.position.x, z: item.mesh.position.z};
                }
                if (item.type === 'pebble' && Math.hypot(item.mesh.position.x - bob.position.x, item.mesh.position.z - bob.position.z) < 15) {
                    hasNearbyPebble = true;
                    if (!nearbyPebblePos) nearbyPebblePos = {x: item.mesh.position.x, z: item.mesh.position.z};
                }
            }
            
            // Decide if Bob needs resources and should seek them
            let needsSticks = stickCount < 5;
            let needsPebbles = pebbleCount < 5;
            let targetResource = null;
            
            if (needsSticks && (hasNearbyStick || resourceMemory.stickLocations.length > 0)) {
                targetResource = nearbyStickPos || resourceMemory.stickLocations[Math.floor(Math.random() * resourceMemory.stickLocations.length)];
            } else if (needsPebbles && (hasNearbyPebble || resourceMemory.pebbleLocations.length > 0)) {
                targetResource = nearbyPebblePos || resourceMemory.pebbleLocations[Math.floor(Math.random() * resourceMemory.pebbleLocations.length)];
            }
            
            if (targetResource && bobTimer <= 0) {
                let path = pathfind(Math.round(bob.position.x), Math.round(bob.position.z), targetResource.x, targetResource.z);
                if (path && path.length > 1) {
                    currentPath = path;
                    pathStepIndex = 0;
                    bobState = 'walking';
                    bob.targetPosition.copy(currentPath[0]);
                    marker.visible = true;
                    marker.position.set(targetResource.x, getHighestTerrainY(targetResource.x, targetResource.z) - 0.05, targetResource.z);
                    marker.scale.setScalar(0.1);
                }
            } else if (bobTimer <= 0) {
                bobState = 'staying';
                waitTimer = 2.0;
                marker.visible = false;
            }
        }
        
        document.getElementById('versionTag').style.display = isCinematic ? 'none' : 'block';
        
        dustSpawnTimer -= dt; 
        if (dustSpawnTimer <= 0) {
            let particlesPerSec = 4;
            if (bobThruster && bobThruster.visible) {
                particlesPerSec = 60;
            } else if (bobState.startsWith('walking')) {
                particlesPerSec = 15;
            }
            dustSpawnTimer = 1.0 / particlesPerSec;
            
            const p = windParticles[windIndex]; 
            p.visible = true; 
            p.userData.life = 1.0; 
            p.material.opacity = 0.5; 
            const ang = Math.random() * Math.PI * 2, rad = Math.random() * 0.2; 
            p.position.set(bob.position.x + Math.cos(ang)*rad, bob.position.y - 0.05 + Math.random() * 0.05, bob.position.z + Math.sin(ang)*rad);
            
            let upVel = (bobThruster && bobThruster.visible) ? (Math.random() * 2.0 + 1.0) : (Math.random() * 0.4 + 0.1);
            p.userData.vel.set(Math.cos(ang) * (Math.random()*0.5+0.2), upVel, Math.sin(ang) * (Math.random()*0.5+0.2)); 
            p.userData.rotSpeed.set(Math.random()*5, Math.random()*5, Math.random()*5);
            windIndex = (windIndex + 1) % windParticles.length;
        }
        for(let p of windParticles) if (p.visible) { p.userData.vel.x += currentWindDir.x * windForce * dt * 1.5; p.userData.vel.z += currentWindDir.z * windForce * dt * 1.5; p.position.addScaledVector(p.userData.vel, dt); p.rotation.x += p.userData.rotSpeed.x * dt; p.rotation.y += p.userData.rotSpeed.y * dt; p.userData.life -= dt * 1.5; const s = Math.max(0, p.userData.life); p.scale.setScalar(s); p.material.opacity = s * 0.5; if (p.userData.life <= 0) p.visible = false; }
        
        eyePivot.getWorldPosition(_v3W);
        const lD = lookTarget.clone().sub(_v3W).normalize().applyQuaternion(eyePivot.parent.getWorldQuaternion(_quat).invert());
            
        let clampedY = Math.max(-1.0, Math.min(1.0, lD.y));
        let tY = Math.atan2(lD.x, lD.z); 
        let tX = -Math.asin(clampedY); 
        if(tY > Math.PI) tY -= Math.PI*2;
        
        if (bobState.startsWith('walking') || bobState === 'WALKING') {
            tX = 0; tY = 0;
        }
        
        eyePivot.rotation.x += (Math.max(-0.08, Math.min(0.08, tX)) - eyePivot.rotation.x) * dt*8; 
        eyePivot.rotation.y += (Math.max(-0.35, Math.min(0.35, tY)) - eyePivot.rotation.y) * dt*8;
        
        window.glassUniforms.uEyePitch.value = eyePivot.rotation.x;
        window.glassUniforms.uEyeYaw.value = -eyePivot.rotation.y;
        
        if (typeof fpvCamera !== 'undefined' && fpvCamera) { fpvCamera.rotation.set(eyePivot.rotation.x, eyePivot.rotation.y + Math.PI, 0, 'YXZ'); }
        
        bodyGroup.rotation.x += (Math.max(-0.08, Math.min(0.08, tX))*0.8 - bodyGroup.rotation.x) * dt*5; 
        
        updateCamera();
    }
    
    let showHead = !isFirstPerson;
    if (window.bobTop) window.bobTop.visible = showHead;
    if (window.bobInnerTop) window.bobInnerTop.visible = showHead;
    if (window.bobInnerCyl) window.bobInnerCyl.visible = showHead;
    if (window.bobInnerBot) window.bobInnerBot.visible = showHead;
    if (window.glassMesh) window.glassMesh.visible = showHead;
    if (window.eyeScreenMesh) window.eyeScreenMesh.visible = showHead;

    renderer.render(scene, isFirstPerson ? fpvCamera : camera);
}

window.addEventListener('DOMContentLoaded', () => { 
    init(); 
    animate(0); 
});