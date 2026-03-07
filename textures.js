// bobs world textures(v0.2).js
const TEX_RES = window.TEX_RES ?? 32;
const DIRT_MAIN = window.DIRT_MAIN ?? '#4a3525';
const DIRT_ALT = window.DIRT_ALT ?? '#3b291c';
const GRASS_MAIN = window.GRASS_MAIN ?? '#3a5f1b';
const GRASS_ALT = window.GRASS_ALT ?? '#325215';

export function createStationTex(isEmissive, isActive = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (isEmissive) {
        ctx.fillStyle = '#000000'; ctx.fillRect(0,0,128,128);
        if (isActive) {
            ctx.fillStyle = '#00ff00'; ctx.fillRect(24, 24, 80, 40); 
        } else {
            ctx.fillStyle = '#220000'; ctx.fillRect(24, 24, 80, 40); 
            ctx.fillStyle = '#ff0055'; ctx.fillRect(24, 80, 10, 10); 
        }
    } else {
        ctx.fillStyle = '#263238'; ctx.fillRect(0,0,128,128);
        ctx.fillStyle = '#111122'; ctx.fillRect(20, 20, 88, 48); 
        ctx.strokeStyle = '#111111'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(110, 80); ctx.lineTo(110, 128); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(95, 85); ctx.lineTo(95, 128); ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}

export function createChestTex() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#263238'; ctx.fillRect(0,0,128,128); 
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 6;
    ctx.strokeRect(4,4,120,120); 
    ctx.fillStyle = '#aaaaaa'; ctx.fillRect(50, 60, 28, 12); 
    ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(64, 90, 8, 0, Math.PI*2); ctx.fill(); 
    return new THREE.CanvasTexture(canvas);
}

export function createSlatNormalMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8080ff'; 
    ctx.fillRect(0,0,64,64);
    ctx.fillStyle = '#ff80ff'; 
    for(let y=0; y<64; y+=8) ctx.fillRect(0, y, 64, 4);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 16);
    return tex;
}

export function createNoiseTexture(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_RES; canvas.height = TEX_RES;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = c1; ctx.fillRect(0,0,TEX_RES,TEX_RES);
    for(let i=0; i<(TEX_RES*TEX_RES*0.3); i++){
        ctx.fillStyle = Math.random() > 0.5 ? c1 : c2;
        ctx.fillRect(Math.floor(Math.random()*TEX_RES), Math.floor(Math.random()*TEX_RES), 1, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    return tex;
}

export function createLeafTexture(c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_RES; canvas.height = TEX_RES;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TEX_RES, TEX_RES);
    for(let x=0; x<TEX_RES; x++){
        for(let y=0; y<TEX_RES; y++){
            if (Math.random() > 0.3) {
                ctx.fillStyle = Math.random() > 0.7 ? c2 : c1;
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    return tex;
}

export function createGrassSideTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_RES; canvas.height = TEX_RES;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = DIRT_MAIN; ctx.fillRect(0, 0, TEX_RES, TEX_RES);
    for(let i=0; i<(TEX_RES*TEX_RES*0.3); i++){
        ctx.fillStyle = Math.random() > 0.5 ? DIRT_MAIN : DIRT_ALT;
        ctx.fillRect(Math.floor(Math.random()*TEX_RES), Math.floor(Math.random()*TEX_RES), 1, 1);
    }
    for (let x = 0; x < TEX_RES; x++) {
        const wave = Math.sin(x * 0.3) * 2 + Math.sin(x * 0.8) * 1;
        const baseH = 7 + wave;
        const h = Math.max(2, Math.floor(baseH + (Math.random() * 2))); 
        for (let y = 0; y < h; y++) {
            ctx.fillStyle = Math.random() > 0.7 ? GRASS_ALT : GRASS_MAIN;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    return tex;
}

export function renderDenimSubtle(ctx, w, h) {
    ctx.save(); ctx.clip(); ctx.lineWidth = 3; 
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; 
    for(let d = -h; d < w + h; d += 14) { ctx.beginPath(); ctx.moveTo(0, d); ctx.lineTo(w, d + w); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    for(let d = -h; d < w + h; d += 14) { ctx.beginPath(); ctx.moveTo(w, d); ctx.lineTo(0, d + w); ctx.stroke(); }
    ctx.restore();
}

export function createBobTexture() {
    const canvas = document.createElement('canvas');
    const w = 512, h = 1024;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    
    const mx = w/2, my = 330, maskW = 200, maskH = 110;
    
    const shirtY = 460;
    ctx.fillStyle = '#b71c1c'; ctx.fillRect(0, shirtY, w, 200);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for(let y=shirtY; y<shirtY+200; y+=60) ctx.fillRect(0, y, w, 30);
    for(let x=0; x<w; x+=60) ctx.fillRect(x, shirtY, 30, 200);
    
    const denim = '#1565c0', pantsY = 660, bibW = 180, sW = 45;
    ctx.beginPath();
    ctx.rect(0, pantsY, w, 300); ctx.rect(mx - bibW/2, shirtY + 80, bibW, pantsY - (shirtY + 80));
    ctx.rect(mx - bibW/2, shirtY, sW, 100); ctx.rect(mx + bibW/2 - sW, shirtY, sW, 100);
    ctx.rect(64 - sW/2, shirtY, sW, pantsY - shirtY); ctx.rect(448 - sW/2, shirtY, sW, pantsY - shirtY);
    ctx.fillStyle = denim; ctx.fill();
    renderDenimSubtle(ctx, w, h);
    
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.arc(mx - bibW/2 + sW/2, shirtY + 90, 12, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + bibW/2 - sW/2, shirtY + 90, 12, 0, Math.PI*2); ctx.fill();
    
    ctx.fillStyle = '#3e2723'; ctx.fillRect(0, 930, w, 94);
    
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mx - maskW/2, my - maskH/2, maskW, maskH, 50);
    else ctx.rect(mx - maskW/2, my - maskH/2, maskW, maskH); 
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

export function createArmPlaidTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#b71c1c'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for(let y=0; y<128; y+=40) ctx.fillRect(0, y, 128, 20);
    for(let x=0; x<128; x+=40) ctx.fillRect(x, 0, 20, 128);
    
    const denimX = 52, denimW = 24;
    ctx.beginPath(); ctx.rect(denimX, 0, denimW, 128); ctx.fillStyle = '#1565c0'; ctx.fill();
    renderDenimSubtle(ctx, 128, 128);
    
    return new THREE.CanvasTexture(canvas);
}

export function createGrassTex() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    for(let i=0; i<12; i++){
        ctx.fillStyle = Math.random() > 0.5 ? '#4b7324' : '#40631d'; 
        ctx.beginPath();
        let bx = 10 + Math.random() * 44;
        let th = 20 + Math.random() * 40;
        let tx = bx + (Math.random() * 30 - 15);
        ctx.moveTo(bx - 3, 64);
        ctx.lineTo(bx + 3, 64);
        ctx.lineTo(tx, 64 - th);
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    return tex;
}

export function createGlowTex() {
    const c = document.createElement('canvas'); c.width=64; c.height=64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32,32,0,32,32,32);
    grd.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grd.addColorStop(0.4, 'rgba(255, 200, 100, 0.4)');
    grd.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = grd; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
}

export function createMoonTex() {
    const c = document.createElement('canvas'); c.width=128; c.height=128;
    const ctx = c.getContext('2d');
    ctx.fillStyle='#aaddff'; ctx.fillRect(0,0,128,128);
    for(let i=0; i<400; i++) {
        ctx.fillStyle = Math.random()>0.5 ? '#99ccff' : '#88bbff';
        ctx.fillRect(Math.random()*128, Math.random()*128, 2, 2);
    }
    for(let i=0; i<20; i++) {
        let r = 2 + Math.random()*6;
        let x = Math.random()*128; let y = Math.random()*128;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.1)'; ctx.fill();
    }
    return new THREE.CanvasTexture(c);
}