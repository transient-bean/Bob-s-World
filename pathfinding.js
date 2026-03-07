// bobs world pathfinding(v0.2).js
import { getHighestTerrainY, shipX, shipZ } from './terrain.js';
import { walkableMeshes, obstacles, isSolidBlock } from './chunking.js';

export const downRaycaster = new THREE.Raycaster();
export const downVector = new THREE.Vector3(0, -1, 0);

export function getBobTargetY_Raycast(px, py, pz) {
    let isNearShip = Math.abs(px - shipX) <= 6.0 && Math.abs(pz - shipZ) <= 12.0;
    if (isNearShip) {
        let rayStartY = py + 4.5;
        downRaycaster.set(new THREE.Vector3(px, rayStartY, pz), downVector);
        const hits = downRaycaster.intersectObjects(walkableMeshes || [], false);
        let bestY = null;
        let minDist = Infinity;
        for (let hit of hits) {
            if (hit.point.y <= py + 5.0) {
                let d = rayStartY - hit.point.y;
                if (d < minDist) {
                    minDist = d;
                    bestY = hit.point.y;
                }
            }
        }
        if (bestY !== null) return Math.max(0, bestY); 
    }
    return Math.max(0, getHighestTerrainY(Math.round(px), Math.round(pz)));
}

export function findPath(start, target) {
    const sX = Math.round(start.x), sZ = Math.round(start.z);
    const tX = Math.round(target.x), tZ = Math.round(target.z);
    if (sX === tX && sZ === tZ) return null;
    
    const queue = [[{x: sX, z: sZ}]];
    const visited = new Set();
    visited.add(`${sX},${sZ}`);
    
    let loopCount = 0;
    while(queue.length > 0) {
        loopCount++;
        if (loopCount > 5000) break;
        const path = queue.shift();
        const node = path[path.length - 1];
        
        if (node.x === tX && node.z === tZ) { path.shift(); return path; }
        
        const neighbors = [{x: node.x + 1, z: node.z}, {x: node.x - 1, z: node.z}, {x: node.x, z: node.z + 1}, {x: node.x, z: node.z - 1}, {x: node.x + 1, z: node.z + 1}, {x: node.x - 1, z: node.z - 1}, {x: node.x + 1, z: node.z - 1}, {x: node.x - 1, z: node.z + 1}];
        
        let cy = getHighestTerrainY(node.x, node.z);
        
        for(let n of neighbors) {
            const key = `${n.x},${n.z}`;
            if (!visited.has(key)) {
                let isObstacle = obstacles && obstacles.has(key);
                let ny = getHighestTerrainY(n.x, n.z);
                
                let blockedDiagonal = false;
                if (n.x !== node.x && n.z !== node.z) { 
                    let ox = obstacles && obstacles.has(`${n.x},${node.z}`);
                    let oz = obstacles && obstacles.has(`${node.x},${n.z}`);
                    if (ox || oz) blockedDiagonal = true; 
                }
                
                if (ny - cy > 3.1) blockedDiagonal = true; 
                if (isSolidBlock && (isSolidBlock(n.x, Math.floor(ny) + 1, n.z) || isSolidBlock(n.x, Math.floor(ny) + 2, n.z))) blockedDiagonal = true;
                
                if (isObstacle) continue; 
                
                if (!blockedDiagonal) { visited.add(key); queue.push([...path, n]); }
            }
        }
    }
    return null;
}