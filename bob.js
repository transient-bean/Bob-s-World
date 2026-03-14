import { createBobTexture, createArmPlaidTexture } from './textures.js';
import { shipX, shipY, shipZ } from './terrain.js';
import { SHIP_FLOOR_Y, SHIP_ELEV } from './ship.js';
import { wobbleInject } from './shaders.js';

export let bob = null;
export let bodyGroup = null;
export let eyePivot = null;
export let leftArmMover = null;
export let rightArmMover = null;
export let leftFlashLight = null;
export let rightFlashLight = null;
export let bobThruster = null;
export const toolMeshes = {};

export function initBob(scene, fpvCamera) {
    const bobMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: createBobTexture(), roughness: 0.95, metalness: 0.0, alphaTest: 0.5 });
    const armMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 });
    
    bob = new THREE.Group(); const r = 0.45, h = 0.9;
    bodyGroup = new THREE.Group();
    
    const top = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32, 0, Math.PI*2, 0, Math.PI/2), bobMat);
    window.bobTop = top;
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64), bobMat);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32, 0, Math.PI*2, Math.PI/2, Math.PI/2), bobMat);
    top.position.y = h + r - 0.005; mid.position.y = h/2 + r; bot.position.y = r + 0.005; 
    [top, mid, bot].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
    
    const mapUV = (g, s, e) => { const uv = g.attributes.uv; for(let i=0; i<uv.count; i++) uv.setY(i, s + uv.getY(i)*(e-s)); };
    mapUV(bot.geometry, 0, 0.25); mapUV(mid.geometry, 0.25, 0.75); mapUV(top.geometry, 0.75, 1.0);
    bodyGroup.add(top, mid, bot); bodyGroup.rotation.y = Math.PI;

    const toolHandleMat = new THREE.MeshStandardMaterial({color: 0x5d4037, roughness: 0.9}); toolHandleMat.onBeforeCompile = wobbleInject;
    const toolHeadMat = new THREE.MeshStandardMaterial({color: 0x9e9e9e, roughness: 0.6}); toolHeadMat.onBeforeCompile = wobbleInject;

    const createIntegratedArm = (isLeft) => {
        const assembly = new THREE.Group();
        const upperMat = new THREE.MeshStandardMaterial({ map: createArmPlaidTexture(), roughness: 0.95 });
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 16), upperMat);
        shoulder.scale.set(1.1, 1.2, 1.0); shoulder.rotation.z = Math.PI/2; shoulder.rotation.y = Math.PI/2; shoulder.castShadow = true; shoulder.receiveShadow = true; assembly.add(shoulder);
        const pivot = new THREE.Group(); pivot.position.set(isLeft ? 0.05 : -0.05, -0.05, 0);
        const forearmG = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 16); forearmG.translate(0, -0.2, 0);
        const forearm = new THREE.Mesh(forearmG, armMat); forearm.castShadow = true; forearm.receiveShadow = true; pivot.add(forearm);
        const hand = new THREE.Group(); hand.position.y = -0.4;
        const fingerG = new THREE.CylinderGeometry(0.035, 0.01, 0.15, 12); fingerG.translate(0, -0.075, 0); 
        for(let i=0; i<3; i++) { const fPivot = new THREE.Group(); fPivot.rotation.y = (i / 3) * Math.PI * 2; const f = new THREE.Mesh(fingerG, armMat); f.position.x = 0.07; f.rotation.z = -0.15; f.castShadow = true; f.receiveShadow = true; fPivot.add(f); hand.add(fPivot); }
        
        if(!isLeft) {
            const toolRoot = new THREE.Group();
            toolRoot.position.set(0, -0.05, 0.05); 
            toolRoot.rotation.x = -Math.PI / 2;
            hand.add(toolRoot);
            function createToolMesh(type) {
                const g = new THREE.Group();
                const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8), toolHandleMat);
                handle.position.y = 0.4; handle.castShadow = true; handle.receiveShadow = true;
                g.add(handle);
                if (type === 'pickaxe') {
                    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), toolHeadMat);
                    head.position.set(0, 0.7, 0); head.castShadow = true; head.receiveShadow = true; g.add(head);
                } else if (type === 'axe') {
                    const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.25), toolHeadMat);
                    head.position.set(0, 0.6, 0.08); head.castShadow = true; head.receiveShadow = true; g.add(head);
                } else if (type === 'shovel') {
                    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.04), toolHeadMat);
                    head.position.set(0, 0.8, 0); head.castShadow = true; head.receiveShadow = true; g.add(head);
                } else if (type === 'hoe') {
                    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), toolHeadMat);
                    head.position.set(0, 0.7, 0.1); head.castShadow = true; head.receiveShadow = true; g.add(head);
                }
                g.visible = false;
                toolRoot.add(g);
                return g;
            }
            toolMeshes.pickaxe = createToolMesh('pickaxe');
            toolMeshes.axe = createToolMesh('axe');
            toolMeshes.shovel = createToolMesh('shovel');
            toolMeshes.hoe = createToolMesh('hoe');
        }
        
        pivot.add(hand); assembly.add(pivot); return { group: assembly, mover: pivot };
    };
    const lArm = createIntegratedArm(true); lArm.group.position.set(0.44, 0.95, 0); bodyGroup.add(lArm.group); leftArmMover = lArm.mover;
    const rArm = createIntegratedArm(false); rArm.group.position.set(-0.44, 0.95, 0); bodyGroup.add(rArm.group); rightArmMover = rArm.mover;
    
    window.glassUniforms = window.glassUniforms ?? { 
        uEyePitch: { value: 0.0 }, 
        uEyeYaw: { value: 0.0 }, 
        uEyeOpen: { value: 1.0 } 
    }; 
    
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    const innerCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, h, 32), voidMat);
    window.bobInnerCyl = innerCyl;
    innerCyl.position.y = h/2 + r;
    const innerTop = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI*2, 0, Math.PI/2), voidMat);
    window.bobInnerTop = innerTop;
    innerTop.position.y = h + r - 0.005;
    const innerBot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI*2, Math.PI/2, Math.PI/2), voidMat);
    window.bobInnerBot = innerBot;
    innerBot.position.y = r + 0.005;
    bodyGroup.add(innerCyl, innerTop, innerBot);

    const glassMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x050505, roughness: 0.1, metalness: 0.1, 
        transparent: true, opacity: 0.8, clearcoat: 1.0, clearcoatRoughness: 0.1, side: THREE.DoubleSide
    });
    const glassMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.35, 32), glassMat);
    window.glassMesh = glassMesh;
    glassMesh.position.set(0, 1.25, 0); 
    bodyGroup.add(glassMesh);

    const eyeScreenMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff, transparent: true, opacity: 1.0, depthWrite: false, side: THREE.FrontSide
    });
    
    eyeScreenMat.onBeforeCompile = (shader) => {
        shader.uniforms.uEyePitch = window.glassUniforms.uEyePitch;
        shader.uniforms.uEyeYaw = window.glassUniforms.uEyeYaw;
        shader.uniforms.uEyeOpen = window.glassUniforms.uEyeOpen;
        
        shader.vertexShader = `varying vec3 vLocalPos;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>\n vLocalPos = position;`
        );
        shader.fragmentShader = `
            uniform float uEyePitch;
            uniform float uEyeYaw;
            uniform float uEyeOpen;
            varying vec3 vLocalPos;
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             float theta = atan(vLocalPos.x, -vLocalPos.z);
             float y = vLocalPos.y;
             
             float shiftedTheta = theta - uEyeYaw;
             float shiftedY = y + uEyePitch * 0.44;
             
             vec2 eyeUV = vec2(shiftedTheta * 0.44, shiftedY);
             
             vec2 lUv = eyeUV - vec2(0.12, 0.0);
             vec2 rUv = eyeUV - vec2(-0.12, 0.0);
             
             lUv.y /= max(0.01, uEyeOpen);
             rUv.y /= max(0.01, uEyeOpen);
             
             float eyeRadius = 0.065;
             if (vLocalPos.z < 0.0 && (length(lUv) < eyeRadius || length(rUv) < eyeRadius)) {
                 diffuseColor = vec4(1.0, 1.0, 1.0, 1.0);
             } else {
                 diffuseColor = vec4(0.0, 0.0, 0.0, 0.0);
             }
            `
        );
    };
    const eyeScreenMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.442, 0.442, 0.35, 32, 1, true), eyeScreenMat);
    window.eyeScreenMesh = eyeScreenMesh;
    eyeScreenMesh.position.set(0, 1.25, 0); 
    bodyGroup.add(eyeScreenMesh);

    eyePivot = new THREE.Group(); eyePivot.position.set(0, 1.25, 0); bodyGroup.add(eyePivot);
    
    leftFlashLight = new THREE.SpotLight(0xeeffff, 0, 30, Math.PI / 5, 1.0, 2.0); leftFlashLight.position.set(0.15, 0, -0.46); leftFlashLight.castShadow = true; 
    leftFlashLight.shadow.mapSize.set(512, 512); leftFlashLight.shadow.bias = -0.0005; leftFlashLight.shadow.normalBias = 0.01; leftFlashLight.shadow.camera.near = 0.1; leftFlashLight.shadow.camera.far = 15;
    const leftTarget = new THREE.Object3D(); leftTarget.position.set(0.7, -1.2, -8.0); eyePivot.add(leftTarget); leftFlashLight.target = leftTarget; eyePivot.add(leftFlashLight);
    
    rightFlashLight = new THREE.SpotLight(0xeeffff, 0, 30, Math.PI / 5, 1.0, 2.0); rightFlashLight.position.set(-0.15, 0, -0.46); rightFlashLight.castShadow = true; 
    rightFlashLight.shadow.mapSize.set(512, 512); rightFlashLight.shadow.bias = -0.0005; rightFlashLight.shadow.normalBias = 0.01; rightFlashLight.shadow.camera.near = 0.1; rightFlashLight.shadow.camera.far = 15;
    const rightTarget = new THREE.Object3D(); rightTarget.position.set(-0.7, -1.2, -8.0); eyePivot.add(rightTarget); rightFlashLight.target = rightTarget; eyePivot.add(rightFlashLight);

    const ant = new THREE.Group(); ant.position.set(0, 1.8, 0); ant.rotation.z = -Math.PI/4;
    const matBlackMetal = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.9, metalness: 0.0});
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8, 6), matBlackMetal);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06), armMat);
    stem.position.y = 0.15; stem.castShadow = true; stem.receiveShadow = true;
    ball.position.y = 0.3; ball.castShadow = true; ball.receiveShadow = true; 
    ant.add(stem, ball); bodyGroup.add(ant); 
    
    const thrusterGeo = new THREE.CylinderGeometry(0.15, 0.05, 0.2, 8);
    const thrusterMat = new THREE.MeshStandardMaterial({color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.8}); 
    bobThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    bobThruster.position.set(0, 0.1, 0); bobThruster.visible = false;
    bob.add(bobThruster); 
    
    bob.add(bodyGroup); 
    
    bob.position.set(shipX, shipY + SHIP_FLOOR_Y + SHIP_ELEV + 0.1, shipZ + 1.0);
    bob.targetPosition = new THREE.Vector3().copy(bob.position);
    
    bob.add(fpvCamera);
    fpvCamera.position.set(0, 1.25, 0.0);
    fpvCamera.near = 0.01;
    fpvCamera.updateProjectionMatrix();
    scene.add(bob);
}