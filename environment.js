import { environmentUniforms } from './shaders.js';
import { shipY, shipX, shipZ } from './terrain.js';
import { WORLD_SEED } from './math.js';
import { createGlowTex, createMoonTex } from './textures.js';

export const celestial = {};
export let sunGlobal = null;
export let moonGlobal = null;
export let ambientLight = null;

export const cachedLightingColors = {
    skyColor: new THREE.Color(),
    groundColor: new THREE.Color(),
    sunLightColor: new THREE.Color(),
    moonLightColor: new THREE.Color(0xaaccff),
    cNightSky: new THREE.Color(0x202b42),
    cNightGround: new THREE.Color(0x151b2b),
    cTwilightSky: new THREE.Color(0x3a4b7a),
    cTwilightGround: new THREE.Color(0x1a2035),
    cTwilightSun: new THREE.Color(0xff5e00),
    cGoldenSky: new THREE.Color(0xff6a00),
    cGoldenGround: new THREE.Color(0x886033),
    cGoldenSun: new THREE.Color(0xffaa44),
    cDaySky: new THREE.Color(0x87ceeb),
    cDayGround: new THREE.Color(0x4a3525),
    cDaySun: new THREE.Color(0xfff8f0)
};

export function getDayWind(day) { 
    let x = Math.sin(day * 12.9898 + WORLD_SEED) * 43758.5453; 
    return x - Math.floor(x); 
}

export function initEnvironment(scene) {
    ambientLight = new THREE.HemisphereLight(0x87ceeb, 0x4a3525, 0.7); 
    scene.add(ambientLight);
    
    sunGlobal = new THREE.DirectionalLight(0xfff5e6, 1.0);
    sunGlobal.castShadow = true; 
    sunGlobal.shadow.autoUpdate = true;
    sunGlobal.shadow.mapSize.set(2048, 2048); 
    sunGlobal.shadow.camera.left = -40;
    sunGlobal.shadow.camera.right = 40;
    sunGlobal.shadow.camera.top = 40;
    sunGlobal.shadow.camera.bottom = -40;
    sunGlobal.shadow.camera.near = 0.1;
    sunGlobal.shadow.camera.far = 150;
    sunGlobal.shadow.bias = -0.0005; 
    sunGlobal.shadow.normalBias = 0.06; 
    sunGlobal.target.position.set(shipX, shipY, shipZ);
    scene.add(sunGlobal);
    scene.add(sunGlobal.target);
    window.sunGlobal = sunGlobal;

    moonGlobal = new THREE.DirectionalLight(0xaaccff, 0.0);
    moonGlobal.castShadow = true;
    moonGlobal.shadow.autoUpdate = true;
    moonGlobal.shadow.mapSize.set(2048, 2048);
    moonGlobal.shadow.camera.left = -40;
    moonGlobal.shadow.camera.right = 40;
    moonGlobal.shadow.camera.top = 40;
    moonGlobal.shadow.camera.bottom = -40;
    moonGlobal.shadow.camera.near = 0.1;
    moonGlobal.shadow.camera.far = 150;
    moonGlobal.shadow.bias = -0.0005;
    moonGlobal.shadow.normalBias = 0.06;
    scene.add(moonGlobal);
    scene.add(moonGlobal.target);
    window.moonGlobal = moonGlobal;

    window.celestial = celestial;
    
    // 1. Sun (Scaled up 5x, depthWrite disabled)
    const sunGeo = new THREE.SphereGeometry(25, 32, 32);
    const sunMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uZenith: { value: 0 }, uColor: { value: new THREE.Vector3(1, 0.8, 0) } },
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uTime; uniform float uZenith; uniform vec3 uColor; varying vec3 vNormal; void main() { float intensity = 1.0 + uZenith * 0.5; float pulse = 0.9 + 0.1 * sin(uTime * 2.0); gl_FragColor = vec4(uColor * intensity * pulse, 1.0); }`,
        side: THREE.FrontSide,
        depthWrite: false
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.renderOrder = -999; // Render behind world
    celestial.sun = sunMesh;
    scene.add(sunMesh);

    // Corona (Scaled up 5x, fog disabled)
    const coronaGeo = new THREE.PlaneGeometry(300, 300);
    const coronaMat = new THREE.MeshBasicMaterial({ 
        map: createGlowTex(), transparent: true, opacity: 0.5, 
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false 
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.renderOrder = -999;
    celestial.corona = coronaMesh;
    scene.add(coronaMesh);

    // 2. Moon (Scaled up 5x, depthWrite and fog disabled)
    const moonGeo = new THREE.SphereGeometry(20, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({ 
        map: createMoonTex(), roughness: 0.9, metalness: 0.1, fog: false 
    });
    moonMat.depthWrite = false;
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.renderOrder = -999; // Render behind world
    celestial.moon = moonMesh;
    scene.add(moonMesh);

    // 3. Stars (Ensure they render behind everything)
    const starCount = 3000;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    for(let i=0; i<starCount; i++) {
        const r = 400 + Math.random()*200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        starPos[i*3+2] = r * Math.cos(phi);
        starSizes[i] = 0.5 + Math.random() * 1.5;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    const starMat = new THREE.ShaderMaterial({
        uniforms: { uSunY: { value: 0 }, uTime: { value: 0 } },
        vertexShader: `attribute float size; void main() { vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * (300.0 / -mvPosition.z); gl_Position = projectionMatrix * mvPosition; }`,
        fragmentShader: `uniform float uSunY; uniform float uTime; void main() { float alpha = clamp((-uSunY - 0.1) * 3.0, 0.0, 1.0); float twinkle = sin(uTime * 3.0 + gl_FragCoord.x * 0.1); if (alpha <= 0.0) discard; vec2 coord = gl_PointCoord - vec2(0.5); if(length(coord) > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * (0.7 + 0.3*twinkle)); }`,
        transparent: true,
        depthWrite: false
    });
    const starSystem = new THREE.Points(starGeo, starMat);
    starSystem.renderOrder = -1000; // Ultimate background
    celestial.stars = starSystem;
    scene.add(starSystem);

    // 4. Clouds (Kept physical so they drift properly)
    const cloudCount = 200;
    const cloudGeo = new THREE.BoxGeometry(8, 4, 8);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, flatShading: true });
    const cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
    const dummy = new THREE.Object3D();
    for(let i=0; i<cloudCount; i++) {
        dummy.position.set((Math.random()-0.5)*600, 70 + (Math.random()-0.5)*10, (Math.random()-0.5)*600);
        dummy.scale.set(1 + Math.random(), 0.5 + Math.random()*0.5, 1 + Math.random());
        dummy.updateMatrix();
        cloudMesh.setMatrixAt(i, dummy.matrix);
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
    celestial.clouds = cloudMesh;
    scene.add(cloudMesh);
}

export function updateLightingCycle(scene, camera, zoomLevel, sunAngle, sunY, sx, sy, sz, snapX, snapY, snapZ, currentHumidity) {
    let aspect = window.innerWidth / window.innerHeight;
    let shadowSize = 60; 
    let shadowY = Math.max(20, Math.abs(sy));
    
    const snapGrid = 16.0;
    const snappedX = Math.floor(snapX / snapGrid) * snapGrid + snapGrid/2;
    const snappedZ = Math.floor(snapZ / snapGrid) * snapGrid + snapGrid/2;
    const stableY = (typeof shipY !== 'undefined') ? shipY + 3.0 : 10.0;

    let moonAngle = sunAngle + Math.PI;
    let moonY = Math.sin(moonAngle);
    let mx = Math.cos(moonAngle) * 80;
    let my = Math.sin(moonAngle) * 80;
    let mz = Math.cos(moonAngle) * 32;
    let moonShadowY = Math.max(20, Math.abs(my));
    
    // Physical Lights stay at distance 80 for shadow map precision
    if (sunGlobal) {
        sunGlobal.position.set(snappedX + sx, stableY + shadowY, snappedZ + sz);
        sunGlobal.target.position.set(snappedX, stableY, snappedZ);
        sunGlobal.target.updateMatrixWorld();
        
        sunGlobal.shadow.camera.left = -shadowSize;
        sunGlobal.shadow.camera.right = shadowSize;
        sunGlobal.shadow.camera.top = shadowSize;
        sunGlobal.shadow.camera.bottom = -shadowSize;
        sunGlobal.shadow.camera.far = 500;
        sunGlobal.shadow.camera.updateProjectionMatrix();
        
        if (environmentUniforms.uSunPos) {
            environmentUniforms.uSunPos.value.copy(sunGlobal.position).sub(sunGlobal.target.position).normalize();
        }
        
        if (celestial) {
            const cx = camera.position.x;
            const cy = camera.position.y;
            const cz = camera.position.z;
            
            // Visual meshes get pushed 5x further away (Distance 400) to act like a Skybox
            if (celestial.sun) {
                celestial.sun.position.set(cx + (sx * 5), cy + (sy * 5), cz + (sz * 5));
                celestial.sun.material.uniforms.uZenith.value = Math.max(0, sunY);
            }
            if (celestial.corona) {
                celestial.corona.position.copy(celestial.sun.position);
                celestial.corona.lookAt(camera.position);
                let camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
                let sunDir = new THREE.Vector3().copy(celestial.sun.position).sub(camera.position).normalize();
                let glare = Math.max(0, camDir.dot(sunDir));
                let s = 200 + glare * 200; // Scaled up 5x
                celestial.corona.scale.set(s, s, 1);
                celestial.corona.material.opacity = 0.3 + glare * 0.4;
            }
            if (celestial.moon) {
                celestial.moon.position.set(cx + (mx * 5), cy + (my * 5), cz + (mz * 5));
                celestial.moon.rotation.y += 0.001;
                if (sunY < -0.2) {
                    celestial.moon.material.emissive.setHex(0x002244);
                    celestial.moon.material.emissiveIntensity = 0.2;
                } else {
                    celestial.moon.material.emissive.setHex(0x000000);
                }
            }
            if (celestial.stars) {
                celestial.stars.position.set(cx, cy, cz);
                celestial.stars.material.uniforms.uSunY.value = sunY;
            }
            if (celestial.clouds) {
                celestial.clouds.material.color.copy(cachedLightingColors.skyColor).lerp(new THREE.Color(0xffffff), 0.5);
                if (sunY < 0) celestial.clouds.material.emissive.setHex(0x111122);
                else celestial.clouds.material.emissive.setHex(0x000000);
            }
        }
    }
    if (environmentUniforms.uSunIntensity) environmentUniforms.uSunIntensity.value = Math.max(0, sunY);
    
    let skyColor = cachedLightingColors.skyColor;
    let groundColor = cachedLightingColors.groundColor;
    let sunLightColor = cachedLightingColors.sunLightColor;
    let moonLightColor = cachedLightingColors.moonLightColor;
    const cNightSky = cachedLightingColors.cNightSky;
    const cNightGround = cachedLightingColors.cNightGround;
    const cTwilightSky = cachedLightingColors.cTwilightSky;
    const cTwilightGround = cachedLightingColors.cTwilightGround;
    const cTwilightSun = cachedLightingColors.cTwilightSun;
    const cGoldenSky = cachedLightingColors.cGoldenSky;
    const cGoldenGround = cachedLightingColors.cGoldenGround;
    const cGoldenSun = cachedLightingColors.cGoldenSun;
    const cDaySky = cachedLightingColors.cDaySky;
    const cDayGround = cachedLightingColors.cDayGround;
    const cDaySun = cachedLightingColors.cDaySun;
    let ambientInt = 0.5;
    let sunInt = 0;
    let moonInt = 0;

    if (sunY > 0.3) {
        let t = Math.min(1, (sunY - 0.3) / 0.7);
        skyColor.copy(cGoldenSky).lerp(cDaySky, t);
        groundColor.copy(cGoldenGround).lerp(cDayGround, t);
        sunLightColor.copy(cGoldenSun).lerp(cDaySun, t);
        sunInt = 0.8 + t * 0.2; 
        ambientInt = 0.5 + t * 0.2; 
    } else if (sunY > 0.0) {
        let t = sunY / 0.3;
        skyColor.copy(cTwilightSky).lerp(cGoldenSky, t);
        groundColor.copy(cTwilightGround).lerp(cGoldenGround, t);
        sunLightColor.copy(cTwilightSun).lerp(cGoldenSun, t);
        sunInt = 0.4 + t * 0.4; 
        ambientInt = 0.45 + t * 0.05; 
    } else if (sunY > -0.2) {
        let t = (sunY + 0.2) / 0.2;
        skyColor.copy(cNightSky).lerp(cTwilightSky, t);
        groundColor.copy(cNightGround).lerp(cTwilightGround, t);
        sunLightColor.copy(cTwilightSun); 
        sunInt = t * 0.4; 
        ambientInt = 0.35 + t * 0.1; 
        moonInt = (1 - t) * 0.8; 
    } else {
        skyColor.copy(cNightSky);
        groundColor.copy(cNightGround);
        sunInt = 0;
        ambientInt = 0.35; 
        moonInt = 0.8 + Math.abs(sunY) * 0.5; 
    }
    scene.background = skyColor;
    
    let chunkRadius = Math.min(5, Math.max(3, Math.ceil(zoomLevel / 12)));
    let chunkRenderRadiusWorld = chunkRadius * 16;
    let currentHumid = currentHumidity || 0.0;
    let fogFactor = Math.max(0.0, Math.min(1.0, (currentHumid - 0.1) / 0.8));
    
    let baseFogNear = 40 + chunkRenderRadiusWorld - 10;
    let baseFogFar = 50 + chunkRenderRadiusWorld + 10;
    
    let targetFogNear = baseFogNear - (fogFactor * 30.0);
    let targetFogFar = baseFogFar - (fogFactor * 40.0);
    
    scene.fog.near += (targetFogNear - scene.fog.near) * 0.05;
    scene.fog.far += (targetFogFar - scene.fog.far) * 0.05;
    scene.fog.color.copy(skyColor);
    
    if (sunGlobal) {
        sunGlobal.color = sunLightColor;
        sunGlobal.intensity = sunInt;
        sunGlobal.shadow.autoUpdate = (sunInt > 0.01);
    }
    
    if (moonGlobal) {
        moonGlobal.color = moonLightColor;
        moonGlobal.intensity = moonInt;
        moonGlobal.shadow.autoUpdate = (moonInt > 0.01);
        
        moonGlobal.position.set(snappedX + mx, stableY + moonShadowY, snappedZ + mz);
        moonGlobal.target.position.set(snappedX, stableY, snappedZ);
        moonGlobal.target.updateMatrixWorld();
        
        moonGlobal.shadow.camera.left = -shadowSize;
        moonGlobal.shadow.camera.right = shadowSize;
        moonGlobal.shadow.camera.top = shadowSize;
        moonGlobal.shadow.camera.bottom = -shadowSize;
        moonGlobal.shadow.camera.far = 500;
        moonGlobal.shadow.camera.updateProjectionMatrix();
    }
    if (ambientLight) {
        ambientLight.intensity = ambientInt;
        ambientLight.color.copy(skyColor);
        ambientLight.groundColor.copy(groundColor);
    }
}