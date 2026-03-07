// bobs world inventory(v0.2).js
import { spawnDroppedItem } from './resources.js';

export const inventorySlots = Array(36).fill(null).map(() => ({ type: null, count: 0, durability: 0 }));

export function buildInventoryUI() {
    const mainGrid = document.getElementById('mainInventory'), hotGrid = document.getElementById('hotbarInventory');
    mainGrid.innerHTML = ''; hotGrid.innerHTML = '';
    for(let i=0; i<36; i++){
        const slot = document.createElement('div'); slot.className = 'slot'; slot.innerHTML = `<div class="slot-inner" id="slot-${i}"></div>`;
        if(i < 27) mainGrid.appendChild(slot); else hotGrid.appendChild(slot);
    }
}

export function updateInventoryUI() {
    for(let i=0; i<36; i++){
        const data = inventorySlots[i], el = document.getElementById(`slot-${i}`);
        if(data.type) {
            let iconColor = '#9e9e9e', borderRadius = '50%', borderEx = '';
            if (data.type === 'stick') { iconColor = '#5d4037'; borderRadius = '2px'; borderEx = 'border-top: 4px solid #43a047;'; }
            else if (data.type === 'pebble') { iconColor = '#9e9e9e'; borderRadius = '10px 10px 8px 8px'; }
            else if (data.type === 'fiber') { iconColor = '#cddc39'; borderRadius = '10px 0 10px 0'; borderEx = 'border-left: 3px solid #9ccc65;'; }
            else if (data.type === 'pickaxe') { iconColor = '#9e9e9e'; borderRadius = '4px 14px 4px 14px'; borderEx = 'border-bottom: 3px solid #5d4037;'; }
            else if (data.type === 'axe') { iconColor = '#757575'; borderRadius = '12px 4px 4px 4px'; borderEx = 'border-bottom: 3px solid #5d4037;'; }
            else if (data.type === 'shovel') { iconColor = '#e0e0e0'; borderRadius = '8px 8px 4px 4px'; borderEx = 'border-bottom: 4px solid #5d4037;'; }
            else if (data.type === 'hoe') { iconColor = '#9e9e9e'; borderRadius = '4px 14px 4px 14px'; borderEx = 'border-bottom: 4px solid #5d4037;'; }
            else if (data.type === 'stone') { iconColor = '#777777'; borderRadius = '4px'; }
            else if (data.type === 'wood') { iconColor = '#5d4037'; borderRadius = '0px'; }
            else if (data.type === 'dirt' || data.type === 'tilled') { iconColor = '#4a3525'; borderRadius = '2px'; }
            else if (data.type === 'seed') { iconColor = '#8bc34a'; borderRadius = '50%'; borderEx = 'width:12px; height:12px; margin:5px;'; }
            else if (data.type === 'wheat') { iconColor = '#ffeb3b'; borderRadius = '2px 10px 2px 10px'; borderEx = 'border-left: 2px solid #cddc39;'; }
            
            let durBar = data.durability ? `<div style="position:absolute; bottom:0; left:0; height:4px; background:#4CAF50; width:${(data.durability/20)*100}%; border-radius:0 0 4px 4px;"></div>` : '';
            el.innerHTML = `<div class="item-icon" style="background:${iconColor}; border-radius:${borderRadius}; ${borderEx}"></div><div class="item-count">${data.count}</div>${durBar}`;
        } else { el.innerHTML = ''; }
    }
}

export function addItemToInventory(type, amount=1, durability=0) {
    for(let i=0; i<36; i++){ if(inventorySlots[i].type === type && inventorySlots[i].count < 256 && !durability) { inventorySlots[i].count += amount; updateInventoryUI(); return true; } }
    for(let i=0; i<36; i++){ if(!inventorySlots[i].type) { inventorySlots[i].type = type; inventorySlots[i].count = amount; if(durability) inventorySlots[i].durability = durability; updateInventoryUI(); return true; } }
    return false;
}

export function giveItemOrDrop(type, amount=1, durability=0) { 
    if(!addItemToInventory(type, amount, durability)) {
        if(window.bob) spawnDroppedItem(type, window.bob.position.x, window.bob.position.z);
    }
}

export function countItem(type) { 
    let c = 0; for(let s of inventorySlots) if(s.type === type) c += s.count; return c; 
}

export function consumeItem(type, amount=1) {
    for(let s of inventorySlots) {
        if(s.type === type) {
            if(s.count >= amount) { s.count -= amount; if(s.count<=0) { s.type = null; s.durability = 0; } updateInventoryUI(); return true; }
            else { amount -= s.count; s.count = 0; s.type = null; s.durability = 0; }
        }
    }
    updateInventoryUI(); return false;
}

export function useTool(type) {
    if(!type) return false;
    for(let s of inventorySlots) {
        if(s.type === type) {
            s.durability = (s.durability || 20) - 1;
            if(s.durability <= 0) { s.count--; if(s.count<=0) s.type = null; }
            updateInventoryUI(); return true;
        }
    }
    return false;
}

export function getBestTool(bType) {
    if(bType==='stone') return 'pickaxe';
    if(bType==='wood') return 'axe';
    if(bType==='grass' || bType==='dirt') return 'shovel';
    if(bType==='tilled') return 'hoe';
    return null;
}