// bobs world terrain(v0.2).js
import { simplex2D, seedRand } from './math.js';

let blocksDataRef = null;
export function setBlocksDataRef(ref) { blocksDataRef = ref; }

export let shipX = window.shipX ?? 0;
export let shipZ = window.shipZ ?? 0;
export let shipY = window.shipY ?? 0;

export const elevationCache = new Map();
window.elevationCache = elevationCache;

export function getBiomeData(x, z) {
    return {
        temp: simplex2D(x * 0.005 + 1000, z * 0.005 + 1000),
        humid: simplex2D(x * 0.005 - 1000, z * 0.005 - 1000),
        fertility: simplex2D(x * 0.02, z * 0.02)
    };
}

export function isNaturalTreeSpot(x, z, b) {
    let isForest = b.humid > 0.2 && b.fertility > 0.2;
    let gridSpacing = isForest ? 3 : 8; 
    
    let gridX = Math.floor(x / gridSpacing);
    let gridZ = Math.floor(z / gridSpacing);
    
    let hash = Math.abs(Math.sin(gridX * 12.9898 + gridZ * 78.233) * 43758.5453);
    let offsetX = Math.floor(hash * 100) % gridSpacing;
    let offsetZ = Math.floor(hash * 10000) % gridSpacing;
    
    let cx = gridX * gridSpacing + offsetX;
    let cz = gridZ * gridSpacing + offsetZ;
    
    if (x === cx && z === cz) {
        let spawnHash = Math.abs(Math.sin(x * 1.23 + z * 4.56) * 10000);
        spawnHash = spawnHash - Math.floor(spawnHash);
        
        if (isForest) {
            if (spawnHash < 0.8) return true; 
        } else if (b.humid > -0.4 && b.fertility > -0.4) {
            if (spawnHash < 0.2) return true; 
        }
    }
    return false;
}

export function getBaseElevation(x, z) {
    let plainsNoise = simplex2D(x * 0.015, z * 0.015);
    let base = Math.floor(plainsNoise * 1.5); 
    let macro = (simplex2D(x * 0.004, z * 0.004) + 1.0) * 0.5;
    let elev = base;
    if (macro > 0.6) { 
        let hillNoise = (simplex2D(x * 0.02, z * 0.02) + 1.0) * 0.5;
        let blend = Math.min(1.0, (macro - 0.6) / 0.15); 
        elev += Math.floor(Math.pow(hillNoise, 1.5) * 20.0 * blend);
    }
    return elev;
}

export function getRawElevation(x, z) {
    let key = `${x},${z}`;
    if (elevationCache.has(key)) return elevationCache.get(key);
    let elev = getBaseElevation(x, z);
    
    let distToThruster = Math.hypot(x - shipX, z - shipZ);
    let craterNoise = simplex2D(x * 0.5, z * 0.5);
    let craterRadius = 3.5 + craterNoise * 1.5; 
    if (distToThruster < craterRadius) {
        elev -= 1; 
    }
    
    elevationCache.set(key, elev);
    return elev;
}

export function findLandingSite() {
    let maxRadius = 50; 
    let shipWidth = 14; 
    for(let r=0; r<maxRadius; r+=2) {
        for(let x=-r; x<=r; x+=2) {
            for(let z=-r; z<=r; z+=2) {
                if(Math.abs(x)===r || Math.abs(z)===r) {
                    let ce = getBaseElevation(x, z);
                    let flat = true;
                    
                    let padLeft = 5 + Math.floor(seedRand() * 6);
                    let padRight = 5 + Math.floor(seedRand() * 6);
                    let halfWidth = Math.floor(shipWidth / 2);
                    
                    for(let dx = -halfWidth - padLeft; dx <= halfWidth + padRight; dx++) {
                        for(let dz = -14; dz <= 18; dz++) {
                            let nx = x + dx, nz = z + dz;
                            if(getBaseElevation(nx, nz) !== ce) { flat = false; break; }
                            
                            let b = getBiomeData(nx, nz);
                            if (b.humid > 0.2 || b.fertility > 0.5) { flat = false; break; }
                        }
                        if(!flat) break;
                    }
                    
                    if(flat) {
                        shipX = x; shipZ = z; shipY = ce + 1;
                        window.shipX = shipX; window.shipZ = shipZ; window.shipY = shipY; // THE FIX
                        return;
                    }
                }
            }
        }
    }
    shipX = 0; shipZ = 0; shipY = getBaseElevation(0,0) + 1;
    window.shipX = shipX; window.shipZ = shipZ; window.shipY = shipY; // THE FIX
}

export function getHighestTerrainY(x, z) {
    let highest = getRawElevation(x, z);
    if (blocksDataRef) {
        for(let y = highest + 15; y >= highest - 5; y--) {
            let b = blocksDataRef.get(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`);
            if (b && b.type !== 'wood' && b.type !== 'leaf' && b.type !== 'invisible_wall') return y;
        }
    }
    return highest;
}