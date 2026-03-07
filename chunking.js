// bobs world chunking(v0.2).js
import { simplex2D, seedRand } from './math.js';
import { shipX, shipZ, getBiomeData, isNaturalTreeSpot, getRawElevation, setBlocksDataRef } from './terrain.js';

export const CHUNK_SIZE = 16;
export const obstacles = new Set();
export const blocksData = new Map();
setBlocksDataRef(blocksData);
export const grassInstances = [];
export const walkableMeshes = [];

export const engineRefs = {
    scene: null, globalMats: null, box: null, depthMat: null, 
    windDepthMat: null, windDepthMatLeaf: null, instMat: null, 
    grassDepthMat: null, gGeo: null
};

export function initChunkEngine(refs) { Object.assign(engineRefs, refs); }

export function isSolidBlock(x, y, z) {
    let key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
    if (chunkManager.brokenBlocks.has(key)) return false;
    if (blocksData.has(key)) {
        let pType = blocksData.get(key).type;
        if (pType === 'ship_floor' || pType === 'ship_ramp' || pType === 'invisible_wall' || pType === 'ship_wall') return false; 
    }
    if (chunkManager.placedBlocks.has(key)) {
        let pType = chunkManager.placedBlocks.get(key).type;
        if(pType === 'wood' || pType === 'leaf' || pType === 'invisible_wall' || pType === 'ship_wall' || pType === 'ship_floor' || pType === 'ship_ramp') return false; 
        return true;
    }
    let elev = getRawElevation(x, z);
    if (y <= elev && y >= -32) return true;
    return false;
}

export function isExposed(x, y, z) {
    if (!isSolidBlock(x+1, y, z)) return true;
    if (!isSolidBlock(x-1, y, z)) return true;
    if (!isSolidBlock(x, y+1, z)) return true;
    if (!isSolidBlock(x, y-1, z)) return true;
    if (!isSolidBlock(x, y, z+1)) return true;
    if (!isSolidBlock(x, y, z-1)) return true;
    return false;
}

export class Chunk {
    constructor(cx, cz) {
        this.cx = cx; this.cz = cz;
        this.key = `${cx},${cz}`;
        this.meshes = [];
        this.blockKeys = [];
        this.build();
    }
    
    build() {
        let lists = { grass: [], dirt: [], stone: [], bedrock: [], wood: [], leaf: [] };
        let cs = CHUNK_SIZE;
        let startX = this.cx * cs;
        let startZ = this.cz * cs;
        let gInstances = [];
        
        for(let x = startX; x < startX + cs; x++) {
            for(let z = startZ; z < startZ + cs; z++) {
                let yElev = getRawElevation(x, z);
                let distToCenter = Math.hypot(x - shipX, z - shipZ);
                let inShipFootprint = distToCenter < 7.0 || (Math.abs(x - shipX) < 4.0 && z >= shipZ && z <= shipZ + 12.0);
                let b = getBiomeData(x, z);
                
                let inTreeClearance = Math.abs(x - shipX) <= 20;
                if (!inTreeClearance && !inShipFootprint && isNaturalTreeSpot(x, z, b)) {
                    let treeBaseKey = `${Math.round(x)},${Math.round(yElev+1)},${Math.round(z)}`;
                    if (!chunkManager.brokenBlocks.has(treeBaseKey) && !chunkManager.placedBlocks.has(treeBaseKey)) {
                        let th = (b.fertility > 0.4 && b.temp > 0.2) ? 4 : 3;
                        
                        let overlap = false;
                        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (obstacles.has((x+dx) + ',' + (z+dz))) overlap = true;
                        
                        if (!overlap) {
                            obstacles.add(x + ',' + z);
                            for (let y = 1; y <= th; y++) { lists.wood.push({x, y: yElev+y, z}); obstacles.add(x + ',' + z + ',' + (yElev+y)); }
                            if (th === 3) {
                                for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) === 1 && Math.abs(dz) === 1 && Math.random() > 0.5) continue; else lists.leaf.push({x: x+dx, y: yElev+th+1, z: z+dz});
                                lists.leaf.push({x, y: yElev+th+2, z}); lists.leaf.push({x: x+1, y: yElev+th+2, z}); lists.leaf.push({x: x-1, y: yElev+th+2, z});
                                lists.leaf.push({x, y: yElev+th+2, z: z+1}); lists.leaf.push({x, y: yElev+th+2, z: z-1});
                            } else {
                                for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; else lists.leaf.push({x: x+dx, y: yElev+th+1, z: z+dz});
                                for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue; else lists.leaf.push({x: x+dx, y: yElev+th+2, z: z+dz});
                            }
                        }
                    }
                }

                let burnBaseRadius = 8.0;
                let isBurnMark = distToCenter < burnBaseRadius + (Math.random() * 3.0 - 1.5);

                let minNeighborElev = Math.min(
                    getRawElevation(x, z-1), getRawElevation(x, z+1), getRawElevation(x+1, z), getRawElevation(x-1, z)
                );
                let bottomY = Math.max(-32, minNeighborElev - 1);

                for(let y = yElev; y >= bottomY; y--) {
                    if (!isExposed(x, y, z)) continue;
                    let key = `${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
                    
                    if (chunkManager.brokenBlocks.has(key)) continue;
                    if (chunkManager.placedBlocks.has(key)) {
                        let pType = chunkManager.placedBlocks.get(key).type;
                        if (pType !== 'invisible_wall' && pType !== 'ship_wall' && pType !== 'ship_floor' && pType !== 'ship_ramp') continue;
                    }
                    
                    let type = 'stone';
                    if (y === -32) type = 'bedrock';
                    else if (y === yElev) type = isBurnMark ? 'dirt' : 'grass';
                    else if (y >= yElev - 2) type = 'dirt'; 
                    
                    lists[type].push({x, y, z});
                }

                if (!inShipFootprint && !isBurnMark) {
                    let f = b.fertility; 
                    let grassNoise = (simplex2D(x * 0.05, z * 0.05) + 1.0) * 0.5; 
                    let smoothMask = Math.max(0, Math.min(1.0, (grassNoise - 0.4) / 0.5)); 
                    let baseChance = 0.01 + smoothMask * 0.15; 
                    let localHash = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
                    localHash = localHash - Math.floor(localHash);
                    
                    if (localHash < baseChance * (f + 1.0)) {
                        let actualDensity = smoothMask > 0.8 && localHash < baseChance * 0.2 ? 2 : 1;
                        for(let i=0; i<actualDensity; i++) {
                            let gx = x + seedRand() - 0.5, gz = z + seedRand() - 0.5, gy = yElev + 0.48;
                            let stage = 1, rStage = seedRand();
                            if (rStage > 0.6) stage = 3; else if (rStage > 0.3) stage = 2;
                            
                            let sX = 0.4 + seedRand() * 0.3;
                            let sY = stage === 3 ? 1.4 + seedRand() * 0.6 : (stage === 2 ? 0.8 + seedRand() * 0.4 : 0.3 + seedRand() * 0.3);
                            
                            let m = new THREE.Matrix4().makeTranslation(gx, gy, gz);
                            m.multiply(new THREE.Matrix4().makeRotationY(seedRand() * Math.PI * 2));
                            m.scale(new THREE.Vector3(sX, sY, sX));
                            
                            let gObj = { bx: Math.round(gx), bz: Math.round(gz), x: gx, z: gz, active: true, m: m, chunkKey: this.key, stage: stage, metadata: { lastSeen: 0, confidence: 0 } };
                            gInstances.push(gObj);
                            grassInstances.push(gObj);
                        }
                    }
                }
            }
        }

        const createM = (list, mat, bType) => {
            if (list.length === 0) return;
            const mesh = new THREE.InstancedMesh(engineRefs.box, mat, list.length);
            mesh.receiveShadow = true; 
            mesh.castShadow = false; // Shadow optimization included
            
            let dMat = engineRefs.depthMat;
            if (bType === 'wood') dMat = engineRefs.windDepthMat;
            else if (bType === 'leaf') dMat = engineRefs.windDepthMatLeaf;
            if(dMat) mesh.customDepthMaterial = dMat;
            
            mesh.matrixAutoUpdate = false;
            mesh.frustumCulled = false; 
            
            const m4 = new THREE.Matrix4();
            const color = new THREE.Color();

            list.forEach((p, i) => { 
                m4.makeTranslation(p.x, p.y, p.z);
                mesh.setMatrixAt(i, m4); 
                
                if (bType === 'grass' || bType === 'leaf') {
                    let b = getBiomeData(p.x, p.z);
                    let temp = Math.max(0, Math.min(1, (b.temp + 1.0) * 0.5));
                    let humid = Math.max(0, Math.min(1, (b.humid + 1.0) * 0.5));
                    let fert = Math.max(0, Math.min(1, (b.fertility + 1.0) * 0.5));
                    color.setRGB(0.85 + temp * 0.15, 0.90 + fert * 0.10, 0.80 + humid * 0.20);
                    mesh.setColorAt(i, color);
                }

                if(bType) {
                    let baseHp = (bType==='stone') ? 15 : (bType==='wood' ? 9 : (bType==='leaf' ? 1 : 3));
                    blocksData.set(`${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`, {type: bType, isInstance: true, mesh, index: i, hp: baseHp, maxHp: baseHp, basePos: new THREE.Vector3(Math.round(p.x), Math.round(p.y), Math.round(p.z))});
                    this.blockKeys.push(`${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`);
                }
            });

            if (bType === 'grass' || bType === 'leaf') mesh.instanceColor.needsUpdate = true;

            mesh.updateMatrix();
            if(engineRefs.scene) engineRefs.scene.add(mesh);
            this.meshes.push(mesh);
            if (bType !== 'wood' && bType !== 'leaf') walkableMeshes.push(mesh);
        };

        if(engineRefs.globalMats) {
            createM(lists.grass, engineRefs.globalMats.grass, 'grass');
            createM(lists.dirt, engineRefs.globalMats.dirt, 'dirt');
            createM(lists.stone, engineRefs.globalMats.stone, 'stone');
            createM(lists.bedrock, engineRefs.globalMats.bedrock, null);
            createM(lists.wood, engineRefs.globalMats.wood, 'wood');
            createM(lists.leaf, engineRefs.globalMats.leaf, 'leaf');
        }

        if (gInstances.length > 0 && engineRefs.gGeo && engineRefs.instMat && engineRefs.grassDepthMat) {
            let chunkGrassMesh = new THREE.InstancedMesh(engineRefs.gGeo, engineRefs.instMat, gInstances.length);
            chunkGrassMesh.castShadow = false; // Shadow optimization included
            chunkGrassMesh.receiveShadow = true; 
            chunkGrassMesh.matrixAutoUpdate = false;
            chunkGrassMesh.frustumCulled = false; 
            chunkGrassMesh.customDepthMaterial = engineRefs.grassDepthMat;

            const gColor = new THREE.Color();
            gInstances.forEach((g, i) => {
                chunkGrassMesh.setMatrixAt(i, g.m);
                let b = getBiomeData(g.x, g.z);
                let temp = Math.max(0, Math.min(1, (b.temp + 1.0) * 0.5));
                let humid = Math.max(0, Math.min(1, (b.humid + 1.0) * 0.5));
                let fert = Math.max(0, Math.min(1, (b.fertility + 1.0) * 0.5));
                gColor.setRGB(0.85 + temp * 0.15, 0.90 + fert * 0.10, 0.80 + humid * 0.20);
                chunkGrassMesh.setColorAt(i, gColor);
                g.mesh = chunkGrassMesh;
                g.index = i;
            });
            chunkGrassMesh.userData.isGrass = true;
            chunkGrassMesh.userData.instances = gInstances;
            this.grassInstances = gInstances;

            chunkGrassMesh.instanceColor.needsUpdate = true;
            chunkGrassMesh.updateMatrix();
            if(engineRefs.scene) engineRefs.scene.add(chunkGrassMesh);
            this.meshes.push(chunkGrassMesh);
        }
    }

    dispose() {
        this.meshes.forEach(m => {
            if(engineRefs.scene) engineRefs.scene.remove(m);
            if (m.dispose) m.dispose(); 
            let idx = walkableMeshes.indexOf(m);
            if (idx > -1) walkableMeshes.splice(idx, 1);
        });
        this.blockKeys.forEach(k => blocksData.delete(k));
        
        for (let i = grassInstances.length - 1; i >= 0; i--) {
            if (grassInstances[i].chunkKey === this.key) grassInstances.splice(i, 1);
        }
    }
}

export const chunkManager = {
    activeChunks: new Map(), brokenBlocks: new Set(), placedBlocks: new Map(), chunkSize: CHUNK_SIZE,
    loadChunk: function(cx, cz) { this.activeChunks.set(`${cx},${cz}`, new Chunk(cx, cz)); },
    unloadChunk: function(cx, cz) {
        const key = `${cx},${cz}`; const chunk = this.activeChunks.get(key);
        if (chunk) { chunk.dispose(); this.activeChunks.delete(key); }
    },
    update: function(bobPos, zoom, forceLoad = false) { 
        if (this.lastZoom === undefined) this.lastZoom = zoom;
        let zoomChange = Math.abs(zoom - this.lastZoom) / this.lastZoom;
        if (zoomChange > 0.1) this.lastZoom = zoom;
        
        let bx = Math.floor(bobPos.x / this.chunkSize), bz = Math.floor(bobPos.z / this.chunkSize);
        let radius = Math.min(5, Math.max(3, Math.ceil(this.lastZoom / 12))); 
        
        let needed = new Set();
        for(let x = bx - radius; x <= bx + radius; x++) for(let z = bz - radius; z <= bz + radius; z++) needed.add(`${x},${z}`);
        
        for(let [key, chunk] of this.activeChunks) {
            if(!needed.has(key)) {
                let [cx, cz] = key.split(',').map(Number);
                this.unloadChunk(cx, cz);
            } else {
                let [cx, cz] = key.split(',').map(Number);
                let dist = Math.hypot(cx * this.chunkSize - bobPos.x, cz * this.chunkSize - bobPos.z);
                let isHighLOD = dist < 45; 
                chunk.meshes.forEach(m => {
                    if (m.castShadow !== isHighLOD) {
                        m.castShadow = isHighLOD;
                        if (m !== chunk.meshes[chunk.meshes.length - 1] || !m.geometry || !m.geometry.attributes.uv) m.receiveShadow = isHighLOD; 
                    }
                });
            }
        }
        
        let loadedThisFrame = 0;
        for(let key of needed) {
            if(!this.activeChunks.has(key)) {
                if (loadedThisFrame >= 3 && !forceLoad) break; 
                let [cx, cz] = key.split(',').map(Number);
                this.loadChunk(cx, cz);
                loadedThisFrame++;
            }
        }
    }
};