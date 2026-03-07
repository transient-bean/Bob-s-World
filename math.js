// bobs world math(v0.2).js
export function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; 
    }
    return Math.abs(hash);
}

export const urlParams = new URLSearchParams(window.location.search);
window.urlParams = urlParams;

const urlSeed = urlParams.get('seed');
export let WORLD_SEED;
if (urlSeed) {
    WORLD_SEED = isNaN(urlSeed) ? hashString(urlSeed) : parseFloat(urlSeed);
} else {
    WORLD_SEED = Math.floor(Math.random() * 999999);
}
window.WORLD_SEED = WORLD_SEED;

export function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}
export const seedRand = mulberry32(WORLD_SEED);
window.seedRand = seedRand;

export const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
window.F2 = F2;
export const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
window.G2 = G2;

export function dot(g, x, y) { return g[0]*x + g[1]*y; }

export const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
window.grad3 = grad3;

export const p = new Uint8Array(256);
for (let i=0; i<256; i++) p[i] = Math.floor(seedRand()*256);
window.p = p;

export const perm = new Uint8Array(512);
export const permMod12 = new Uint8Array(512);
for (let i=0; i<512; i++) { 
    perm[i] = p[i & 255]; 
    permMod12[i] = (perm[i] % 12); 
}
window.perm = perm;
window.permMod12 = permMod12;

export function simplex2D(xin, yin) {
    let n0, n1, n2;
    let s = (xin+yin)*F2;
    let i = Math.floor(xin+s), j = Math.floor(yin+s);
    let t = (i+j)*G2;
    let X0 = i-t, Y0 = j-t;
    let x0 = xin-X0, y0 = yin-Y0;
    let i1, j1;
    if(x0>y0) {i1=1; j1=0;} else {i1=0; j1=1;}
    let x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
    let ii = i & 255, jj = j & 255;
    let gi0 = permMod12[ii+perm[jj]], gi1 = permMod12[ii+i1+perm[jj+j1]], gi2 = permMod12[ii+1+perm[jj+1]];
    let t0 = 0.5 - x0*x0-y0*y0; if(t0<0) n0=0.0; else { t0*=t0; n0=t0*t0*dot(grad3[gi0],x0,y0); }
    let t1 = 0.5 - x1*x1-y1*y1; if(t1<0) n1=0.0; else { t1*=t1; n1=t1*t1*dot(grad3[gi1],x1,y1); }
    let t2 = 0.5 - x2*x2-y2*y2; if(t2<0) n2=0.0; else { t2*=t2; n2=t2*t2*dot(grad3[gi2],x2,y2); }
    return 70.0 * (n0 + n1 + n2);
}
window.simplex2D = simplex2D;