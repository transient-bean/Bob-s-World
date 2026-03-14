import { shipX, shipY, shipZ, getHighestTerrainY } from './terrain.js';
import { environmentUniforms, commonWobbleGLSL } from './shaders.js';
import { obstacles, walkableMeshes } from './chunking.js';
import { createStationTex, createChestTex } from './textures.js';

export const SHIP_FLOOR_Y = 3.0;
export const SHIP_ELEV = 0.8;

export let shipGroup = null;
export let shipShaderUniforms = [];
export let hatchGroup = null;
export let hatchMesh = null;

export function spawnPhoenixLander(scene) {
    if(!shipGroup) shipGroup = new THREE.Group();
    shipGroup.position.set(shipX, shipY + SHIP_ELEV, shipZ);
    
    const R = 2.5;
    const H = 9.0;
    const apothem = R * Math.cos(Math.PI / 8);
    const doorWidth = 2.0;
    window.shipApothem = apothem;
    window.shipDoorWidth = doorWidth;

    const shaderInject = (shader) => {
        shader.uniforms.uBobPos = environmentUniforms.uBobPos;
        shader.uniforms.uIsInsideShip = { value: 0.0 };
        shader.uniforms.uShipCutoutAmount = { value: 0.0 };
        shader.uniforms.uIsFirstPerson = { value: 0.0 };
        shipShaderUniforms.push(shader.uniforms);
        
        shader.vertexShader = shader.vertexShader.replace(
            'void main() {',
            commonWobbleGLSL + '\nvarying vec3 vWorldPosShip;\nvoid main() {'
        );
        
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            vec4 wPos4 = modelMatrix * vec4(position, 1.0);
            vWorldPosShip = wPos4.xyz;
            
            vec3 wobbleSamplePos = wPos4.xyz;
            
            #if defined(IS_FLAG) || defined(IS_WINDOW) || defined(IS_HATCH)
                vec3 center = vec3(${shipX.toFixed(1)}, 0.0, ${shipZ.toFixed(1)});
                vec3 offset = wPos4.xyz - center;
                offset.y = 0.0;
                if (length(offset) > 0.001) {
                    offset = normalize(offset) * ${apothem.toFixed(3)};
                }
                wobbleSamplePos = vec3(center.x + offset.x, wPos4.y, center.z + offset.z);
            #endif
            vec3 p = vec3(wobbleSamplePos.x, ${shipY.toFixed(1)} + ${SHIP_FLOOR_Y.toFixed(1)}, wobbleSamplePos.z) * 0.8;
            vec3 wobbleOff = (abs(fract(p.xyz) * 2.0 - 1.0) * 0.5 + abs(fract(p.yzx + 0.5) * 2.0 - 1.0) * 0.5 - 0.5) * 0.15;
            
            transformed += wobbleOff;
        `);
        shader.fragmentShader = `
            uniform vec3 uBobPos;
            uniform float uIsInsideShip;
            uniform float uShipCutoutAmount;
            uniform float uIsFirstPerson;
            varying vec3 vWorldPosShip;
        ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `
            #include <clipping_planes_fragment>
            
            vec3 shipCenter = vec3(${shipX.toFixed(1)}, ${shipY.toFixed(1)}, ${shipZ.toFixed(1)});
            vec3 localPos = vWorldPosShip - vec3(${shipX.toFixed(1)}, 0.0, ${shipZ.toFixed(1)});
            
            #ifndef IS_HATCH
            if (localPos.z > ${apothem.toFixed(2)} - 0.5 && abs(localPos.x) < ${(doorWidth/2).toFixed(2)} && vWorldPosShip.y > ${shipY.toFixed(1)} + ${(SHIP_FLOOR_Y + SHIP_ELEV).toFixed(1)} && vWorldPosShip.y < ${shipY.toFixed(1)} + ${(SHIP_FLOOR_Y + SHIP_ELEV + 2.5).toFixed(1)}) {
                discard;
            }
            #endif
            
            #ifdef IS_FIN
                vec3 finLocal = vWorldPosShip - shipCenter;
                float angle = atan(finLocal.z, finLocal.x);
                float sector = mod(angle + 0.19634954, 0.78539816) - 0.39269908;
                float octDist = length(finLocal.xz) * cos(sector);
                if (octDist < 2.35) discard;
            #endif

            #ifndef IS_HATCH
            #ifndef IS_FLAG
            #ifndef IS_WINDOW
            float winY = shipCenter.y + ${(SHIP_FLOOR_Y + SHIP_ELEV + H*0.5).toFixed(1)};
            float dyWin = vWorldPosShip.y - winY;
            float dZ = length(vec2(localPos.z, dyWin));
            float dX = length(vec2(localPos.x, dyWin));
            if (localPos.x > 1.0 && abs(localPos.z) < 0.5 && dZ < 0.35) discard; 
            if (localPos.x < -1.0 && abs(localPos.z) < 0.5 && dZ < 0.35) discard; 
            if (localPos.z < -1.0 && abs(localPos.x) < 0.5 && dX < 0.35) discard; 
            #endif
            #endif
            #endif

            #ifndef IS_PROP
            if (uIsFirstPerson < 0.5 && uShipCutoutAmount > 0.0) {
                vec3 toCam = normalize(cameraPosition - uBobPos);
                vec3 toPixel = vWorldPosShip - uBobPos;
                float distAlongCamLine = dot(toPixel, toCam);
                float distPerp = length(toPixel - toCam * distAlongCamLine);
                float currentRadius = uShipCutoutAmount * 12.0; 
                
                #ifdef IS_FLAG
                    if (uShipCutoutAmount > 0.5) discard;
                #else
                #ifdef IS_ROOF
                    if (uShipCutoutAmount > 0.5) discard;
                #else
                    if (vWorldPosShip.y > shipCenter.y + ${(SHIP_FLOOR_Y + SHIP_ELEV).toFixed(1)} + 0.1) {
                        float heightFactor = (vWorldPosShip.y - (shipCenter.y + ${(SHIP_FLOOR_Y + SHIP_ELEV).toFixed(1)})) / ${H.toFixed(1)};
                        float backFactor = 0.5 * (1.0 - normalize(localPos).z);
                        float clipOffset = backFactor * heightFactor * 3.0;
                        if (distAlongCamLine > 1.3 - clipOffset && distPerp < currentRadius) {
                            discard;
                        }
                    }
                #endif
                #endif
            }
            #endif
            `
        );
    };

    const shipDepthShaderInject = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
            'void main() {',
            commonWobbleGLSL + '\nvarying vec3 vWorldPosShip;\nvoid main() {'
        );
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            #include <begin_vertex>
            vec4 wPos4 = modelMatrix * vec4(position, 1.0);
            vWorldPosShip = wPos4.xyz;
            
            vec3 wobbleSamplePos = wPos4.xyz;
            
            #if defined(IS_FLAG) || defined(IS_WINDOW) || defined(IS_HATCH)
                vec3 center = vec3(${shipX.toFixed(1)}, 0.0, ${shipZ.toFixed(1)});
                vec3 offset = wPos4.xyz - center;
                offset.y = 0.0;
                if (length(offset) > 0.001) {
                    offset = normalize(offset) * ${apothem.toFixed(3)};
                }
                wobbleSamplePos = vec3(center.x + offset.x, wPos4.y, center.z + offset.z);
            #endif
            vec3 p = vec3(wobbleSamplePos.x, ${shipY.toFixed(1)} + ${SHIP_FLOOR_Y.toFixed(1)}, wobbleSamplePos.z) * 0.8;
            vec3 wobbleOff = (abs(fract(p.xyz) * 2.0 - 1.0) * 0.5 + abs(fract(p.yzx + 0.5) * 2.0 - 1.0) * 0.5 - 0.5) * 0.15;
            
            transformed += wobbleOff;
        `);
        shader.fragmentShader = `uniform vec3 uBobPos;\nvarying vec3 vWorldPosShip;\n` + shader.fragmentShader;
    };

    const shipDepthMat = new THREE.MeshDepthMaterial({ side: THREE.DoubleSide, depthPacking: THREE.RGBADepthPacking });
    shipDepthMat.onBeforeCompile = shipDepthShaderInject;

    const matHull = new THREE.MeshStandardMaterial({
        color: 0x1A237E, roughness: 0.6, metalness: 0.2, 
        side: THREE.FrontSide, flatShading: true
    });
    
    const matSilverSmooth = new THREE.MeshStandardMaterial({color: 0xE0E0E0, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide, flatShading: true});
    const matSilver = new THREE.MeshStandardMaterial({color: 0xE0E0E0, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide, flatShading: true});
    const matChar = new THREE.MeshStandardMaterial({color: 0x263238, roughness: 0.8, metalness: 0.5, flatShading: true});
    
    const matHullFin = new THREE.MeshStandardMaterial({
        color: 0x1A237E, roughness: 0.6, metalness: 0.2, 
        side: THREE.DoubleSide, flatShading: true
    });
    matHullFin.defines = { IS_FIN: true, IS_HULL: true };
    
    const matCharFin = matChar.clone();
    matCharFin.defines = { IS_PROP: true };
    
    const matSilverFinSmooth = matSilverSmooth.clone();
    matSilverFinSmooth.defines = { IS_PROP: true };
    matSilverFinSmooth.onBeforeCompile = shaderInject;
    
    const matSilverFin = matSilver.clone();
    matSilverFin.defines = { IS_PROP: true };
    matSilverFin.onBeforeCompile = shaderInject;
    
    const matConsoleBase = matChar.clone();
    matConsoleBase.defines = { IS_PROP: true };
    
    const matSilverRoof = matSilver.clone();
    matSilverRoof.defines = { IS_ROOF: true };

    [matHull, matSilverSmooth, matSilver, matChar, matHullFin, matCharFin, matConsoleBase, matSilverRoof].forEach(m => {
        m.onBeforeCompile = shaderInject;
    });

    function addPart(geo, mat, yOffset) {
        let mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = yOffset;
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.isShip = true;
        mesh.frustumCulled = false;
        shipGroup.add(mesh);
        return mesh;
    }

    function createOctagon(r, h, segs, open) {
        const geo = new THREE.CylinderGeometry(r, r, h, segs * 8, 6, open);
        const pos = geo.attributes.position;
        const ap = r * Math.cos(Math.PI/8);
        for(let i=0; i<pos.count; i++) {
            let x = pos.getX(i);
            let z = pos.getZ(i);
            let angle = Math.atan2(z, x);
            let sector = Math.floor(angle / (Math.PI/4));
            let sectorCenter = sector * (Math.PI/4) + (Math.PI/8);
            let localAngle = angle - sectorCenter;
            let newR = ap / Math.cos(localAngle);
            pos.setX(i, newR * Math.cos(angle));
            pos.setZ(i, newR * Math.sin(angle));
        }
        geo.computeVertexNormals();
        return geo;
    }

    const hexGeo = createOctagon(R, H, 8, true);
    const hexMesh = addPart(hexGeo, [matHull, matSilver, matSilver], SHIP_FLOOR_Y + H/2); 
    hexMesh.rotation.y = Math.PI / 8;
    hexMesh.customDepthMaterial = shipDepthMat; 

    const matHullInterior = new THREE.MeshStandardMaterial({
        color: 0xdde2e6, roughness: 0.8, metalness: 0.1, 
        side: THREE.BackSide, flatShading: true
    });
    matHullInterior.defines = { IS_HULL: true };
    matHullInterior.onBeforeCompile = shaderInject;
    
    const interiorGeo = createOctagon(R - 0.05, H - 0.1, 8, true);
    const interiorMesh = new THREE.Mesh(interiorGeo, matHullInterior);
    interiorMesh.position.y = SHIP_FLOOR_Y + H/2;
    interiorMesh.rotation.y = Math.PI / 8;
    interiorMesh.userData.isShip = true;
    interiorMesh.receiveShadow = true;
    interiorMesh.customDepthMaterial = shipDepthMat;
    shipGroup.add(interiorMesh);
    
    const frameMatDoor = new THREE.MeshStandardMaterial({color: 0x333333, metalness: 0.7, roughness: 0.5});
    frameMatDoor.onBeforeCompile = shaderInject;

    let leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.2), frameMatDoor);
    leftPillar.position.set(-doorWidth/2 - 0.05, SHIP_FLOOR_Y + 1.25, apothem);
    let rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 0.2), frameMatDoor);
    rightPillar.position.set(doorWidth/2 + 0.05, SHIP_FLOOR_Y + 1.25, apothem);
    let topPillar = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.2, 0.1, 0.2), frameMatDoor);
    topPillar.position.set(0, SHIP_FLOOR_Y + 2.55, apothem);
    [leftPillar, rightPillar, topPillar].forEach(p => { p.userData.isShip=true; p.castShadow = true; p.receiveShadow = true; shipGroup.add(p); });
    
    const winMat = new THREE.MeshStandardMaterial({color: 0x4488ff, transparent: true, opacity: 0.6, metalness: 0.2, roughness: 0.1, emissive: 0x113366, side: THREE.DoubleSide, depthWrite: false});
    winMat.defines = { IS_WINDOW: true };
    winMat.onBeforeCompile = shaderInject;
    
    const frameMat = new THREE.MeshStandardMaterial({color: 0x555555, metalness: 0.8, roughness: 0.4});
    frameMat.defines = { IS_WINDOW: true }; 
    frameMat.onBeforeCompile = shaderInject;
    
    const windowAngles = [Math.PI/2, Math.PI, 3*Math.PI/2];
    for(let ang of windowAngles) {
        let wGroup = new THREE.Group();
        
        let outFrame = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 16, 32), frameMat);
        outFrame.position.z = apothem;
        outFrame.userData.isShip = true;
        
        let glass = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 32, 1), winMat);
        glass.rotation.x = Math.PI / 2;
        glass.position.z = apothem;
        glass.userData.isShip = true;
        
        wGroup.add(outFrame, glass);
        wGroup.rotation.y = ang;
        wGroup.position.set(0, SHIP_FLOOR_Y + H*0.5, 0);
        shipGroup.add(wGroup);
    }

    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 128; flagCanvas.height = 64;
    const fCtx = flagCanvas.getContext('2d');
    fCtx.fillStyle = '#fff'; fCtx.fillRect(0,0,128,64);
    fCtx.fillStyle = '#d32f2f'; fCtx.fillRect(0,0,32,64); fCtx.fillRect(96,0,32,64);
    fCtx.beginPath();
    fCtx.moveTo(64, 10);
    fCtx.lineTo(70, 30); fCtx.lineTo(84, 26); fCtx.lineTo(76, 40); fCtx.lineTo(80, 50);
    fCtx.lineTo(66, 46); fCtx.lineTo(66, 60); fCtx.lineTo(62, 60); fCtx.lineTo(62, 46);
    fCtx.lineTo(48, 50); fCtx.lineTo(52, 40); fCtx.lineTo(44, 26); fCtx.lineTo(58, 30);
    fCtx.fill();
    const flagTex = new THREE.CanvasTexture(flagCanvas);
    flagTex.magFilter = THREE.NearestFilter;
    
    const matFlag = new THREE.MeshStandardMaterial({ map: flagTex, transparent: false, alphaTest: 0.5, side: THREE.FrontSide });
    matFlag.defines = { IS_HULL: true, IS_FLAG: true };
    matFlag.onBeforeCompile = shaderInject;
    
    const flagMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7, 16, 8), matFlag);
    let faceAngle = 0; 
    flagMesh.position.set(0, SHIP_FLOOR_Y + H - 1.5, apothem + 0.08);
    flagMesh.rotation.y = faceAngle;
    flagMesh.customDepthMaterial = shipDepthMat;
    flagMesh.userData.isShip = true;
    flagMesh.frustumCulled = false;
    shipGroup.add(flagMesh);

    const noseGeo = new THREE.SphereGeometry(R, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const noseMesh = addPart(noseGeo, matSilverSmooth, SHIP_FLOOR_Y + H - 0.2); 
    noseMesh.rotation.y = Math.PI / 8;
    noseMesh.scale.y = 1.4;

    let tipAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6.0, 8, 4), matSilverRoof);
    tipAntenna.position.set(0, SHIP_FLOOR_Y + H + R*1.4 + 3.0, 0); 
    tipAntenna.userData.isShip = true;
    tipAntenna.frustumCulled = false;
    shipGroup.add(tipAntenna);
    
    let redMatRoof = new THREE.MeshStandardMaterial({color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.0});
    redMatRoof.defines = { IS_ROOF: true };
    redMatRoof.onBeforeCompile = shaderInject;
    let tipLight = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), redMatRoof);
    tipLight.position.set(0, SHIP_FLOOR_Y + H + R*1.4 + 6.0, 0);
    tipLight.userData.isShip = true;
    tipLight.frustumCulled = false;
    shipGroup.add(tipLight);

    const thrusterBaseGeo = new THREE.CylinderGeometry(1.0, 0.8, 0.4, 8);
    const thrusterBase = new THREE.Mesh(thrusterBaseGeo, matCharFin);
    thrusterBase.position.set(0, SHIP_FLOOR_Y - 0.3, 0); 
    thrusterBase.castShadow = true; thrusterBase.receiveShadow = true;
    thrusterBase.userData.isShip = true;
    shipGroup.add(thrusterBase);

    const mainThrusterGeo = new THREE.CylinderGeometry(0.8, 1.4, 2.2, 8, 1, true);
    const mainThruster = new THREE.Mesh(mainThrusterGeo, matCharFin);
    mainThruster.position.set(0, SHIP_FLOOR_Y - 1.6, 0); 
    mainThruster.customDepthMaterial = shipDepthMat;
    mainThruster.castShadow = true; mainThruster.receiveShadow = true;
    mainThruster.userData.isShip = true;
    shipGroup.add(mainThruster);
    
    for(let i=0; i<4; i++) {
        let angle = (i * Math.PI / 2) + Math.PI/4;
        let pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), matSilver);
        pipe.position.set(Math.cos(angle)*0.9, SHIP_FLOOR_Y - 0.7, Math.sin(angle)*0.9);
        pipe.rotation.x = Math.cos(angle) * 0.3;
        pipe.rotation.z = -Math.sin(angle) * 0.3;
        pipe.userData.isShip = true;
        shipGroup.add(pipe);
    }

    const glowGeo = new THREE.SphereGeometry(0.7, 8, 8);
    const glowMat = new THREE.MeshStandardMaterial({color: 0x882200, emissive: 0xaa2200, emissiveIntensity: 1.0}); 
    glowMat.onBeforeCompile = shaderInject;
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.set(0, SHIP_FLOOR_Y - 2.1, 0);
    glowMesh.scale.set(1.2, 0.5, 1.2);
    glowMesh.userData.isShip = true;
    shipGroup.add(glowMesh);

    const thrusterLight = new THREE.PointLight(0xff4400, 0.8, 8);
    thrusterLight.position.set(0, SHIP_FLOOR_Y - 2.4, 0);
    shipGroup.add(thrusterLight);

    const finGeo = new THREE.BoxGeometry(4.55, 7.5, 0.1, 4, 8, 6);
    finGeo.translate(2.275, 3.75, -0.05); 
    const finPos = finGeo.attributes.position;
    for(let i=0; i<finPos.count; i++) {
        let px = finPos.getX(i);
        let py = finPos.getY(i);
        let maxX = py <= 1.5 ? 3.5 : 3.5 - (py - 1.5) * 1.0;
        if (maxX < 0.2) maxX = 0.2;
        if (px > maxX) finPos.setX(i, maxX); 
        if (py < 4.0) finPos.setY(i, py - px * 0.4 * (1.0 - py/4.0));
    }
    finGeo.computeVertexNormals();

    function createPieGeo(radius, height, startAngle, endAngle) {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.arc(0, 0, radius, startAngle, endAngle, false);
        shape.lineTo(0, 0);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: height, curveSegments: 8, bevelEnabled: false, steps: 6 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, -height / 2, 0);
        return geo;
    }

    const finAngles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
    finAngles.forEach(ang => {
        let finContainer = new THREE.Group();
        finContainer.rotation.y = ang;
        
        let finRootX = 1.4; 
        let fin = new THREE.Mesh(finGeo, matHullFin);
        fin.rotation.z = -0.08;
        fin.position.set(finRootX, SHIP_FLOOR_Y, 0); 
        fin.castShadow = true; fin.receiveShadow = true;
        fin.frustumCulled = false;
        finContainer.add(fin);
        
        let tipX = apothem + 2.35;
        let localSurfaceY = -1.3; 
        let legRadius = 0.625;
        let topPillarHeight = 1.15;
        let topPillarY = SHIP_FLOOR_Y + 3.0; 
        
        let topPillar = new THREE.Mesh(new THREE.CylinderGeometry(legRadius, legRadius, topPillarHeight, 8, 4), matCharFin);
        topPillar.position.set(tipX, topPillarY, 0);
        topPillar.castShadow = true; topPillar.receiveShadow = true;
        topPillar.frustumCulled = false;
        finContainer.add(topPillar);
        
        let coreHeight = 4.5;
        let coreY = topPillarY - topPillarHeight/2 - coreHeight/2; 
        const innerGeo = createPieGeo(legRadius, coreHeight, Math.PI/3, Math.PI * 5/3);
        let mainPillar = new THREE.Mesh(innerGeo, matCharFin);
        mainPillar.position.set(tipX, coreY, 0);
        mainPillar.castShadow = true; mainPillar.receiveShadow = true;
        mainPillar.frustumCulled = false;
        finContainer.add(mainPillar);
        
        let outwardOffset = 0.9; 
        let dropX = tipX + outwardOffset;
        let footHeight = 0.3;
        let foldHeight = Math.max(0.1, coreY - (localSurfaceY + footHeight));
        let dropY = localSurfaceY + footHeight + foldHeight/2;
        
        const outerGeo = createPieGeo(legRadius + 0.05, foldHeight, -Math.PI/3, Math.PI/3);
        let foldPart = new THREE.Mesh(outerGeo, matSilverFinSmooth);
        foldPart.position.set(dropX, dropY, 0);
        foldPart.castShadow = true; foldPart.receiveShadow = true;
        foldPart.frustumCulled = false;
        
        let footGeo = new THREE.CylinderGeometry(0.9, 1.05, footHeight, 8, 3);
        let foot = new THREE.Mesh(footGeo, matCharFin);
        foot.position.set(dropX, localSurfaceY + footHeight/2, 0);
        foot.castShadow = true; foot.receiveShadow = true;
        foot.frustumCulled = false;
        finContainer.add(foot);
        
        let startY1 = coreY + coreHeight/3;
        let endY1 = dropY + foldHeight/3;
        let startY2 = coreY - coreHeight/3;
        let endY2 = dropY - foldHeight/3;
        
        function createPost(sx, sy, ex, ey) {
            let dx = ex - sx;
            let dy = ey - sy;
            let len = Math.hypot(dx, dy);
            let angle = Math.atan2(dy, dx);
            
            let pGroup = new THREE.Group();
            
            let post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, len, 8, 6), matSilverFin);
            post.position.set(sx + dx/2, sy + dy/2, 0);
            post.rotation.z = angle - Math.PI/2;
            post.castShadow = true; post.receiveShadow = true;
            post.frustumCulled = false;
            pGroup.add(post);
            
            let hingeGeo = new THREE.CylinderGeometry(0.225, 0.225, 0.4, 8);
            hingeGeo.rotateX(Math.PI/2);
            
            let h1 = new THREE.Mesh(hingeGeo, matCharFin);
            h1.position.set(sx, sy, 0);
            h1.userData.isShip = true;
            pGroup.add(h1);
            
            let h2 = new THREE.Mesh(hingeGeo, matCharFin);
            h2.position.set(ex, ey, 0);
            h2.userData.isShip = true;
            pGroup.add(h2);
            
            return pGroup;
        }
        finContainer.add(createPost(tipX + 0.3, startY1, dropX - 0.3, endY1));
        finContainer.add(createPost(tipX + 0.3, startY2, dropX - 0.3, endY2));
        finContainer.add(foldPart);
        
        shipGroup.add(finContainer);
    });

    hatchGroup = new THREE.Group();
    hatchGroup.position.set(0, SHIP_FLOOR_Y, apothem); 
    
    const matHatch = matSilver.clone();
    matHatch.defines = { IS_HATCH: true };
    matHatch.onBeforeCompile = shaderInject;
    hatchMesh = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, 2.5, 0.1, 8, 8, 2), matHatch);
    hatchMesh.position.set(0, 2.5/2, 0.0); 
    hatchMesh.castShadow = true; hatchMesh.receiveShadow = true;
    hatchMesh.customDepthMaterial = shipDepthMat;
    hatchMesh.userData.isShip = true;
    hatchGroup.add(hatchMesh);
    shipGroup.add(hatchGroup);

    const rampLength = 9.0;
    let worldRampEndZ = shipZ + apothem + rampLength;
    let groundY = getHighestTerrainY(Math.round(shipX), Math.round(worldRampEndZ));
    let localGroundY = groundY - (shipY + SHIP_ELEV) + 0.6; 
    window.worldRampEndZ = worldRampEndZ;
    window.rampGroundY = groundY;
    
    let rampGroupY = SHIP_FLOOR_Y - 0.15;
    const dy = localGroundY - rampGroupY;
    const actualRampLength = Math.hypot(rampLength, dy);
    const pitchAngle = -Math.atan2(dy, rampLength); 
    window.shipRampGroup = new THREE.Group();
    window.shipRampGroup.position.set(0, rampGroupY, apothem);
    window.shipRampGroup.rotation.x = 0; 
    
    window.rampSegments = [];
    let numSegs = 4;
    let segLen = actualRampLength / numSegs;
    let rampMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, metalness: 0.6, flatShading: true });
    rampMat.onBeforeCompile = shaderInject;
    
    for(let i=0; i<numSegs; i++) {
        let segGeo = new THREE.BoxGeometry(doorWidth - (i*0.2), 0.1, segLen, 1, 1, 1);
        segGeo.translate(0, -0.05, segLen / 2);
        let seg = new THREE.Mesh(segGeo, rampMat);
        seg.castShadow = true; seg.receiveShadow = true;
        seg.customDepthMaterial = shipDepthMat;
        seg.userData.isShip = true;
        
        seg.userData.extZ = i * segLen * Math.cos(pitchAngle);
        seg.userData.extY = -i * segLen * Math.sin(pitchAngle) + 0.1;
        seg.userData.extRotX = pitchAngle;
        
        seg.userData.retZ = -segLen - 0.1; 
        seg.userData.retY = -0.25 - (i * 0.02); 
        seg.userData.retRotX = 0;
        seg.position.set(0, seg.userData.retY, seg.userData.retZ);
        seg.rotation.x = seg.userData.retRotX;
        window.shipRampGroup.add(seg);
        window.rampSegments.push(seg);
        walkableMeshes.push(seg);
    }
    shipGroup.add(window.shipRampGroup);
    
    window.shipRampLen = actualRampLength;
    window.targetRampState = 0.0;
    window.rampState = 0.0;

    let cabinLight = new THREE.PointLight(0xFFF9C4, 2.5, 6.5);
    cabinLight.position.set(0, SHIP_FLOOR_Y + 4.0, 0); 
    cabinLight.castShadow = false;
    shipGroup.add(cabinLight);
    
    let cabinLight2 = new THREE.PointLight(0xE8E0D8, 1.5, 5.5);
    cabinLight2.position.set(-0.8, SHIP_FLOOR_Y + 2.0, 1.2); 
    cabinLight2.castShadow = false;
    shipGroup.add(cabinLight2);
    
    let cabinLight3 = new THREE.PointLight(0xE8E0D8, 1.5, 5.5);
    cabinLight3.position.set(0.8, SHIP_FLOOR_Y + 2.0, 1.2); 
    cabinLight3.castShadow = false;
    shipGroup.add(cabinLight3);

    const stationGeo = new THREE.BoxGeometry(0.8, 2.0, 0.8, 4, 4, 4);
    const stationMat = new THREE.MeshStandardMaterial({
        color: 0x222222, map: createStationTex(false), emissiveMap: createStationTex(true, false), emissive: 0xffffff, flatShading: true
    });
    stationMat.defines = { IS_PROP: true }; 
    stationMat.onBeforeCompile = shaderInject;
    let station = new THREE.Mesh(stationGeo, stationMat);
    
    let stationGrp = new THREE.Group();
    stationGrp.rotation.y = -Math.PI / 2; 
    station.position.set(0, SHIP_FLOOR_Y + 1.0, apothem - 0.55); 
    station.rotation.y = Math.PI; 
    station.castShadow = true; station.receiveShadow = true;
    station.customDepthMaterial = shipDepthMat;
    station.userData.isShip = true;
    station.frustumCulled = false;
    stationGrp.add(station);
    shipGroup.add(stationGrp);
    window.baseStationMat = stationMat;

    const chestGeo = new THREE.BoxGeometry(1.0, 0.8, 0.8, 4, 4, 4);
    const chestMat = new THREE.MeshStandardMaterial({ color: 0x333333, map: createChestTex(), flatShading: true });
    chestMat.defines = { IS_PROP: true }; 
    chestMat.onBeforeCompile = shaderInject;
    let chest = new THREE.Mesh(chestGeo, chestMat);
    
    let chestGrp = new THREE.Group();
    chestGrp.rotation.y = Math.PI / 2; 
    chest.position.set(0, SHIP_FLOOR_Y + 0.4, apothem - 0.55); 
    chest.rotation.y = Math.PI; 
    chest.castShadow = true; chest.receiveShadow = true;
    chest.customDepthMaterial = shipDepthMat;
    chest.userData.isShip = true;
    chest.frustumCulled = false;
    chestGrp.add(chest);
    shipGroup.add(chestGrp);

    let consoleGrp = new THREE.Group();
    consoleGrp.rotation.y = 0;
    
    let consoleBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.6), matConsoleBase);
    consoleBase.position.set(0, SHIP_FLOOR_Y + 0.45, -apothem + 0.5);
    consoleBase.castShadow = true; consoleBase.receiveShadow = true;
    consoleBase.customDepthMaterial = shipDepthMat;
    consoleBase.userData.isShip = true;
    consoleGrp.add(consoleBase);
    
    let screenMat = new THREE.MeshStandardMaterial({color: 0x111122, emissive: 0x00aaff, emissiveIntensity: 0.4, roughness: 0.2});
    screenMat.defines = { IS_PROP: true };
    screenMat.onBeforeCompile = shaderInject;
    let consoleScreen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), screenMat);
    consoleScreen.position.set(0, SHIP_FLOOR_Y + 1.0, -apothem + 0.35);
    consoleScreen.rotation.x = 0.0;
    consoleScreen.castShadow = true;
    consoleGrp.add(consoleScreen);
    
    let chairMat = new THREE.MeshStandardMaterial({color: 0x333344, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide});
    chairMat.defines = { IS_PROP: true };
    chairMat.onBeforeCompile = shaderInject;

    let chairGrp = new THREE.Group();
    chairGrp.position.set(0, SHIP_FLOOR_Y, -1.0);
    chairGrp.rotation.y = Math.PI;
    
    let chairBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.3, 8), chairMat);
    chairBase.position.set(0, 0.15, 0);
    chairBase.castShadow = true; chairBase.receiveShadow = true;
    chairGrp.add(chairBase);

    let bowlChairGeo = new THREE.LatheGeometry([
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.42, 0.05),
        new THREE.Vector2(0.48, 0.15),
        new THREE.Vector2(0.50, 0.30),
        new THREE.Vector2(0.45, 0.45),
        new THREE.Vector2(0.40, 0.40),
        new THREE.Vector2(0.42, 0.30),
        new THREE.Vector2(0.35, 0.15),
        new THREE.Vector2(0.01, 0.10)
    ], 16);
    let bowlChair = new THREE.Mesh(bowlChairGeo, chairMat);
    bowlChair.position.set(0, 0.45, 0);
    bowlChair.castShadow = true; bowlChair.receiveShadow = true;
    chairGrp.add(bowlChair);
    
    consoleGrp.add(chairGrp);

    let redBtn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), new THREE.MeshStandardMaterial({color: 0xff0000, emissive: 0xaa0000}));
    redBtn.position.set(0.3, SHIP_FLOOR_Y + 0.92, -apothem + 0.65);
    redBtn.defines = { IS_PROP: true };
    redBtn.onBeforeCompile = shaderInject;
    consoleGrp.add(redBtn);

    let greenBtn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), new THREE.MeshStandardMaterial({color: 0x00ff00, emissive: 0x00aa00}));
    greenBtn.position.set(-0.3, SHIP_FLOOR_Y + 0.92, -apothem + 0.65);
    greenBtn.defines = { IS_PROP: true };
    greenBtn.onBeforeCompile = shaderInject;
    consoleGrp.add(greenBtn);

    shipGroup.add(consoleGrp);

    const floorMat = new THREE.MeshStandardMaterial({color: 0x2a2a2a, roughness: 0.7, metalness: 0.6});
    floorMat.defines = { IS_PROP: true }; 
    floorMat.onBeforeCompile = shaderInject; 
    
    let floorGeo = new THREE.CylinderGeometry(R, R, 0.1, 64, 6, false);
    let floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, SHIP_FLOOR_Y, 0); 
    floorMesh.rotation.y = Math.PI / 8;
    floorMesh.receiveShadow = true;
    floorMesh.updateMatrixWorld();
    shipGroup.add(floorMesh);
    walkableMeshes.push(floorMesh);

    let sillGeo = new THREE.BoxGeometry(doorWidth, 0.1, 1.5, 16, 1, 8);
    let sillMesh = new THREE.Mesh(sillGeo, floorMat);
    sillMesh.position.set(0, SHIP_FLOOR_Y, apothem - 0.75);
    sillMesh.receiveShadow = true;
    sillMesh.updateMatrixWorld();
    shipGroup.add(sillMesh);
    walkableMeshes.push(sillMesh);
    scene.add(shipGroup);
    
    window.missionState = {
        hullRepaired: false, thrustersOnline: false, navSystemOnline: false, coreStable: false,
        requires: {
            hull: { stick: 10, rock: 5 },
            thruster: { rock: 15, shiny: 2 },
            nav: { shiny: 5 },
            core: { shiny: 10, crystal: 1 }
        }
    };

    const hullWalls = [
        [-2,-2], [-1,-2], [0,-2], [1,-2], [2,-2],
        [-2,-1], [2,-1],
        [-2,0],  [2,0],
        [-2,1],  [2,1],
        [-2,2], [-1,2], [1,2], [2,2]
    ];
    for (let w of hullWalls) {
        let wx = Math.round(shipX + w[0]);
        let wz = Math.round(shipZ + w[1]);
        obstacles.add(`${wx},${wz}`);
    }
    
    for (let dz = 2; dz <= 10; dz++) {
        let wx = Math.round(shipX);
        let wz = Math.round(shipZ + dz);
        obstacles.add(`${wx-2},${wz}`);
        obstacles.add(`${wx-1},${wz}`);
        obstacles.add(`${wx+1},${wz}`);
        obstacles.add(`${wx+2},${wz}`);
    }
    
    let legDist = apothem - 0.05 + 4.0;
    let dropX = legDist + 1.5;
    [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4].forEach(ang => {
        let lx1 = Math.round(shipX + Math.cos(ang) * legDist);
        let lz1 = Math.round(shipZ - Math.sin(ang) * legDist); 
        let lx2 = Math.round(shipX + Math.cos(ang) * dropX);
        let lz2 = Math.round(shipZ - Math.sin(ang) * dropX);
        for(let dx=-2; dx<=2; dx++) {
            for(let dz=-2; dz<=2; dz++) {
                obstacles.add(`${lx1+dx},${lz1+dz}`);
                obstacles.add(`${lx2+dx},${lz2+dz}`);
            }
        }
    });
}