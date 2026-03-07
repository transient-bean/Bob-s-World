// bobs world resources(v0.2).js
import { getHighestTerrainY, getRawElevation } from './terrain.js';
import { blocksData, chunkManager, obstacles, grassInstances, engineRefs, isExposed } from './chunking.js';
import { giveItemOrDrop } from './inventory.js';

export const dropMatsCache = {};

export function getDropMat(colorHex) {
    if (!dropMatsCache[colorHex]) {
        let m = new THREE.MeshStandardMaterial({color: colorHex});
        if(window.wobbleInject) m.onBeforeCompile = window.wobbleInject;
        dropMatsCache[colorHex] = m;
    }
    return dropMatsCache[colorHex];
}

export function checkResourceRespawn() {
    if (!window.resourceMemory || !window.resourceMemory.harvestedSticks) return;
    for (let i = window.resourceMemory.harvestedSticks.length - 1; i >= 0; i--) {
        let h = window.resourceMemory.harvestedSticks[i];
        let prob = h.isUnderTree ? 0.15 : 0.08; 
        if (Math.random() < prob) {
            let rx = h.x + (Math.floor(Math.random() * 3) - 1);
            let rz = h.z + (Math.floor(Math.random() * 3) - 1);
            if (!obstacles.has(rx + ',' + rz)) {
                spawnStick(rx, rz, { isUnderTree: h.isUnderTree, respawned: true });
                window.resourceMemory.harvestedSticks.splice(i, 1);
            }
        }
    }
    
    if (!window.resourceMemory.harvestedPebbles) return;
    for (let i = window.resourceMemory.harvestedPebbles.length - 1; i >= 0; i--) {
        let h = window.resourceMemory.harvestedPebbles[i];
        let prob = h.isSlope ? 0.05 : 0.0;
        if (Math.random() < prob) {
            let rx = h.x + (Math.floor(Math.random() * 3) - 1);
            let rz = h.z + (Math.floor(Math.random() * 3) - 1);
            if (!obstacles.has(rx + ',' + rz)) {
                spawnPebble(rx, rz, { isSlope: true, respawned: true });
                window.resourceMemory.harvestedPebbles.splice(i, 1);
            }
        }
    }
}

export function spawnStick(x, z, opts = {}) {
    const g = new THREE.Group();
    const variation = Math.floor(Math.random() * 3); 
    const scale = 0.85 + Math.random() * 0.3; 
    g.scale.setScalar(scale);
    
    if (variation === 0) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), getDropMat(0x5d4037));
        stick.rotation.z = Math.PI/2 + (Math.random()-0.5); stick.position.y = 0.04; 
        stick.castShadow = true; stick.receiveShadow = true;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.08), getDropMat(0x43a047));
        leaf.position.set(0.2, 0.06, 0.05); leaf.castShadow = true; leaf.receiveShadow = true; 
        g.add(stick, leaf); 
    } else if (variation === 1) {
        const stick1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.25), getDropMat(0x6d5047));
        stick1.rotation.z = Math.PI/2 + (Math.random()-0.3); stick1.position.set(-0.05, 0.03, 0); 
        stick1.castShadow = true; stick1.receiveShadow = true;
        const stick2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22), getDropMat(0x5d4037));
        stick2.rotation.z = Math.PI/2 + (Math.random()-0.3); stick2.position.set(0.08, 0.06, 0.05); 
        stick2.castShadow = true; stick2.receiveShadow = true;
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), getDropMat(0x4a3a30));
        node.position.set(0.02, 0.05, 0.02); node.scale.set(0.8, 1.2, 0.9);
        node.castShadow = true; node.receiveShadow = true;
        g.add(stick1, stick2, node);
    } else {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.38), getDropMat(0x4a3a30));
        stick.rotation.z = Math.PI/2 + (Math.random()-0.5); stick.position.y = 0.04; 
        stick.castShadow = true; stick.receiveShadow = true;
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), getDropMat(0x3a2a20));
        knot.position.set(-0.15, 0.02, 0); knot.scale.set(1, 0.7, 1);
        knot.castShadow = true; knot.receiveShadow = true;
        g.add(stick, knot);
    }
    
    let y = getHighestTerrainY(Math.round(x), Math.round(z));
    g.position.set(x, y + 0.45, z); 
    g.rotation.y = Math.random() * Math.PI * 2;
    if(window.scene) window.scene.add(g); 
    
    const metadata = { harvestedDate: null, lastSeenTime: window.gameTime, confidence: 1.0, isUnderTree: opts.isUnderTree || false, ...opts };
    if(window.collectibleItems) window.collectibleItems.push({ mesh: g, type: 'stick', metadata });
}

export function spawnPebble(x, z, opts = {}) {
    const variation = Math.floor(Math.random() * 3); 
    const g = new THREE.Group();
    const scale = 1.0 + (Math.random() * 0.4 - 0.2); 
    g.scale.setScalar(scale);

    if (variation === 0) {
        const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), getDropMat(0x9e9e9e));
        pebble.scale.set(1.2, 0.7, 1); pebble.castShadow = true; pebble.receiveShadow = true;
        g.add(pebble);
    } else if (variation === 1) {
        const rock = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), getDropMat(0x888888));
        rock.scale.set(1.3, 0.6, 1.1); rock.rotation.set(Math.random()*0.5, Math.random()*0.5, Math.random()*0.5);
        rock.castShadow = true; rock.receiveShadow = true;
        g.add(rock);
    } else {
        const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 6), getDropMat(0xa0a0a0));
        p1.position.set(-0.03, 0, -0.02); p1.scale.set(1.1, 0.65, 0.95);
        p1.castShadow = true; p1.receiveShadow = true;
        const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), getDropMat(0x909090));
        p2.position.set(0.04, 0.02, 0.03); p2.scale.set(0.95, 0.7, 1.05);
        p2.castShadow = true; p2.receiveShadow = true;
        g.add(p1, p2);
    }
    
    let y = getHighestTerrainY(Math.round(x), Math.round(z));
    g.position.set(x, y + 0.45 + 0.056, z); 
    g.rotation.y = Math.random() * Math.PI * 2;
    if(window.scene) window.scene.add(g); 
    
    const metadata = { harvestedDate: null, lastSeenTime: window.gameTime, confidence: 1.0, isSlope: opts.isSlope || false, ...opts };
    if(window.collectibleItems) window.collectibleItems.push({ mesh: g, type: 'pebble', metadata });
}

export function spawnDroppedItem(type, x, z) {
    let color = 0xffffff;
    if(type==='dirt') color = 0x4a3525;
    if(type==='wood') color = 0x5d4037;
    if(type==='stone') color = 0x777777;
    if(type==='fiber') color = 0xcddc39;
    if(type==='seed') color = 0x8bc34a;
    if(type==='wheat') color = 0xffeb3b;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), getDropMat(color));
    mesh.castShadow = true; mesh.receiveShadow = true;
    let y = getHighestTerrainY(Math.round(x), Math.round(z));
    mesh.position.set(x, y + 0.45 + 0.075, z); 
    mesh.rotation.set(0, Math.random()*Math.PI, 0);
    if(window.scene) window.scene.add(mesh); 
    if(window.collectibleItems) window.collectibleItems.push({mesh, type});
}

export function harvestGrass(mesh, instanceId) {
    if (!mesh.userData.instances) return;
    let gObj = mesh.userData.instances[instanceId];
    if (!gObj || !gObj.active) return;
    
    let yieldAmt = 0;
    if (gObj.stage === 3) yieldAmt = 4 + Math.floor(Math.random() * 2);
    else if (gObj.stage === 2) yieldAmt = 2 + Math.floor(Math.random() * 2);
    else if (gObj.stage === 1) yieldAmt = 1;
    
    if (yieldAmt > 0) giveItemOrDrop('fiber', yieldAmt);
    
    gObj.stage--;
    gObj.metadata.lastSeen = window.gameTime;
    gObj.metadata.confidence = 1.0;
    
    if (gObj.stage <= 0) {
        gObj.active = false;
        const m = new THREE.Matrix4().makeScale(0,0,0);
        mesh.setMatrixAt(instanceId, m);
    } else {
        let pos = new THREE.Vector3(); let quat = new THREE.Quaternion(); let scl = new THREE.Vector3();
        gObj.m.decompose(pos, quat, scl);
        let newSY = (gObj.stage === 2) ? (0.8 + Math.random() * 0.4) : (0.3 + Math.random() * 0.3);
        let newM = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(scl.x, newSY, scl.z));
        mesh.setMatrixAt(instanceId, newM);
        gObj.m = newM;
    }
    mesh.instanceMatrix.needsUpdate = true;
}

export function breakBlock(b) {
    if (b.isInstance) {
        const m = new THREE.Matrix4().makeScale(0,0,0);
        b.mesh.setMatrixAt(b.index, m);
        let minIdx = b.mesh.userData.updateMin ?? b.index;
        let maxIdx = b.mesh.userData.updateMax ?? b.index;
        b.mesh.userData.updateMin = Math.min(minIdx, b.index);
        b.mesh.userData.updateMax = Math.max(maxIdx, b.index);
        b.mesh.userData.needsRangeUpdate = true;
    } else {
        if(window.scene) window.scene.remove(b.mesh);
    }
    let key = `${b.basePos.x},${b.basePos.y},${b.basePos.z}`;
    blocksData.delete(key);
    chunkManager.brokenBlocks.add(key);
    
    let yElev = getRawElevation(b.basePos.x, b.basePos.z);
    if(b.basePos.y >= yElev) obstacles.delete(`${b.basePos.x},${b.basePos.z}`);
    
    if(b.type === 'dirt' || b.type === 'grass' || b.type === 'tilled') {
        grassInstances.forEach(g => {
            if(g.active && g.bx === b.basePos.x && g.bz === b.basePos.z) {
                g.active = false;
                const mScale = new THREE.Matrix4().makeScale(0,0,0);
                g.mesh.setMatrixAt(g.index, mScale);
                let gMin = g.mesh.userData.updateMin ?? g.index;
                let gMax = g.mesh.userData.updateMax ?? g.index;
                g.mesh.userData.updateMin = Math.min(gMin, g.index);
                g.mesh.userData.updateMax = Math.max(gMax, g.index);
                g.mesh.userData.needsRangeUpdate = true;
            }
        });
    }
    
    function localUpdate(x, y, z) {
        let k = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
        let nb = blocksData.get(k);
        if (nb && nb.isInstance && nb.mesh) {
            const m = new THREE.Matrix4();
            if (isExposed(x, y, z)) m.makeTranslation(x, y, z); else m.makeScale(0, 0, 0);
            nb.mesh.setMatrixAt(nb.index, m);
            let minIdx = nb.mesh.userData.updateMin ?? nb.index;
            let maxIdx = nb.mesh.userData.updateMax ?? nb.index;
            nb.mesh.userData.updateMin = Math.min(minIdx, nb.index);
            nb.mesh.userData.updateMax = Math.max(maxIdx, nb.index);
            nb.mesh.userData.needsRangeUpdate = true;
        }
    }
    
    localUpdate(b.basePos.x + 1, b.basePos.y, b.basePos.z);
    localUpdate(b.basePos.x - 1, b.basePos.y, b.basePos.z);
    localUpdate(b.basePos.x, b.basePos.y + 1, b.basePos.z);
    localUpdate(b.basePos.x, b.basePos.y - 1, b.basePos.z);
    localUpdate(b.basePos.x, b.basePos.y, b.basePos.z + 1);
    localUpdate(b.basePos.x, b.basePos.y, b.basePos.z - 1);
}

export function placeBlock(x, y, z, type) {
    let mat = (window.placedMats && window.placedMats[type]) ? window.placedMats[type] : new THREE.MeshStandardMaterial({color: 0x777777, roughness:0.9});
    const mesh = new THREE.Mesh(engineRefs.box, mat);
    mesh.position.set(x,y,z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    if(engineRefs.scene) engineRefs.scene.add(mesh);
    
    let bData = {type: type, isInstance: false, mesh: mesh, basePos: new THREE.Vector3(x,y,z), hp: 15, maxHp: 15};
    blocksData.set(`${x},${y},${z}`, bData);
    chunkManager.placedBlocks.set(`${x},${y},${z}`, bData);
    
    let yElev = getRawElevation(x, z);
    if(y >= yElev) obstacles.add(`${x},${z}`);
    
    function localUpdate(lx, ly, lz) {
        let k = `${Math.round(lx)},${Math.round(ly)},${Math.round(lz)}`;
        let nb = blocksData.get(k);
        if (nb && nb.isInstance && nb.mesh) {
            const m = new THREE.Matrix4();
            if (isExposed(lx, ly, lz)) m.makeTranslation(lx, ly, lz); else m.makeScale(0, 0, 0);
            nb.mesh.setMatrixAt(nb.index, m);
            let minIdx = nb.mesh.userData.updateMin ?? nb.index;
            let maxIdx = nb.mesh.userData.updateMax ?? nb.index;
            nb.mesh.userData.updateMin = Math.min(minIdx, nb.index);
            nb.mesh.userData.updateMax = Math.max(maxIdx, nb.index);
            nb.mesh.userData.needsRangeUpdate = true;
        }
    }

    localUpdate(x + 1, y, z);
    localUpdate(x - 1, y, z);
    localUpdate(x, y + 1, z);
    localUpdate(x, y - 1, z);
    localUpdate(x, y, z + 1);
    localUpdate(x, y, z - 1);
}

export function spawnInitialResources() {
    var resourceMemory = window.resourceMemory ?? { stickLocations: [], pebbleLocations: [], harvestedSticks: [], harvestedPebbles: [] };
    window.resourceMemory = resourceMemory;
    
    const spawnRadius = 25; 
    let stickCount = 0;
    let pebbleCount = 0;

    for (let x = -spawnRadius; x <= spawnRadius; x++) {
        for (let z = -spawnRadius; z <= spawnRadius; z++) {
            let wx = Math.round(window.shipX + x);
            let wz = Math.round(window.shipZ + z);
            if (window.obstacles && window.obstacles.has(wx + ',' + wz)) continue;
            
            if (pebbleCount < 30 && Math.random() < 0.015) {
                spawnPebble(wx, wz, { isSlope: false });
                resourceMemory.pebbleLocations.push({x: wx, z: wz});
                pebbleCount++;
            }

            let bData = window.getBiomeData ? window.getBiomeData(wx, wz) : { humid: 0, fertility: 0 };
            if (stickCount < 40 && window.isNaturalTreeSpot && window.isNaturalTreeSpot(wx, wz, bData) && Math.random() < 0.2) {
                spawnStick(wx, wz, { isUnderTree: true });
                resourceMemory.stickLocations.push({x: wx, z: wz});
                stickCount++;
            }
        }
    }
}