# Bob's World Loading Performance Analysis

## Problem Summary
Your loading screen freezes for 30+ seconds on "INITIALIZING GRAPHICS..." due to **synchronous shader compilation** triggered by a single `renderer.render()` call.

---

## Root Cause Analysis

### 1. **Bottleneck Location**
**File:** `index.html` (lines 1970-1979)
```javascript
} else if (bootPhase === 5) {
    updateUI("INITIALIZING GRAPHICS...", 95);
    bootPhase = 5.5;
    yieldToBrowser(() => {
        // Do one sneaky frame render behind the UI to lazily compile shaders
        renderer.render(scene, camera);  // ← SYNCHRONOUS COMPILATION
        bootPhase = 6;
    });
}
```

**The Problem:** When `renderer.render()` is called, Three.js synchronously compiles ALL materials with `onBeforeCompile` callbacks that haven't been compiled yet.

### 2. **20+ Materials with Shader Injection**
Every time a shader-injected material renders for the first time, it:
- Parses the original shader
- Runs the `onBeforeCompile` callback
- Recompiles the shader with modifications
- Uploads to GPU

**Affected materials:**
```
Terrain (6): grass, dirt, stone, bedrock + depth variants
Leaves: injectWindJitter (wind sway animation)
Ship hull: 10+ materials with lighting injection
Placed blocks: stone, dirt, tilled (wobbleInject)
Tools: handles, heads
Bob character: body, textures
Structure: glass, windows
```

### 3. **Shader Injection Complexity**
Each injection adds significant GLSL code:
- `injectTerrainJitter`: ~50 lines of GLSL
- `injectWindJitter`: ~60 lines with sine/cosine calculations
- `injectTerrainDepthJitter`: ~40 lines
- Ship shaders: ~100+ lines each

Compiling 20+ shaders with complex calculations = **30+ second freeze**.

---

## Solution 1: Async Shader Compilation with `compileAsync()`

**Approach:** Use Three.js `renderer.compileAsync()` to compile materials on a per-frame budget instead of all at once.

**Implementation:**
```javascript
} else if (bootPhase === 5) {
    updateUI("INITIALIZING GRAPHICS...", 95);
    bootPhase = 5.5;
    yieldToBrowser(() => {
        // Trigger async compilation
        (async () => {
            try {
                await renderer.compileAsync(scene, camera);
                bootPhase = 6;
            } catch (e) {
                console.warn('Shader compilation issue:', e);
                bootPhase = 6; // Continue anyway
            }
        })();
    });
}
```

**Pros:**
- Built into Three.js (no polyfills needed)
- Compiles on GPU's idle time
- Zero main-thread stalls
- Most predictable FPS

**Cons:**
- Requires r129+ of Three.js
- May need frame delay before rendering

**Three.js Version Check:** You're using `three.min.js r128`, so upgrade to r129+.

---

## Solution 2: Progressive Compilation with RequestIdleCallback

**Approach:** Compile materials one-by-one during browser idle time.

**Implementation:**
```javascript
} else if (bootPhase === 5) {
    updateUI("INITIALIZING GRAPHICS...", 95);
    bootPhase = 5.5;
    
    // Collect all materials with pending compilation
    const materialsToCompile = [];
    scene.traverse((obj) => {
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                materialsToCompile.push(...obj.material);
            } else {
                materialsToCompile.push(obj.material);
            }
        }
    });
    
    let compiledCount = 0;
    const compileNextBatch = () => {
        if (compiledCount >= materialsToCompile.length) {
            bootPhase = 6;
            return;
        }
        
        // Compile 2-3 materials per idle callback
        const batchSize = 3;
        for (let i = 0; i < batchSize && compiledCount < materialsToCompile.length; i++) {
            const mat = materialsToCompile[compiledCount++];
            // Trigger compilation by rendering a minimal scene
            if (mat.onBeforeCompile) {
                const tmp = new THREE.Scene();
                const geo = new THREE.PlaneGeometry(1, 1);
                const mesh = new THREE.Mesh(geo, mat);
                tmp.add(mesh);
                renderer.render(tmp, camera);
            }
        }
        
        // Update progress
        const pct = 95 + Math.floor((compiledCount / materialsToCompile.length) * 4);
        updateUI(`INITIALIZING GRAPHICS... (${compiledCount}/${materialsToCompile.length})`, pct);
        
        // Schedule next batch during idle
        if (compiledCount < materialsToCompile.length) {
            requestIdleCallback(compileNextBatch, { timeout: 50 });
        } else {
            bootPhase = 6;
        }
    };
    
    yieldToBrowser(compileNextBatch);
}
```

**Pros:**
- Uses browser idle time
- Progressive loading feels responsive
- Works on any Three.js version
- Can show compilation progress

**Cons:**
- More complex code
- Slower than compileAsync
- Overhead from multiple render calls

---

## Solution 3: Deferred Shader Compilation with Lazy Rendering

**Approach:** Skip the initialization render entirely and let shaders compile lazily during gameplay.

**Implementation:**
```javascript
} else if (bootPhase === 5) {
    updateUI("INITIALIZING GRAPHICS...", 95);
    bootPhase = 5.5;
    
    // OPTION A: Skip render entirely (fastest)
    // Shaders will compile on first frame of gameplay
    bootPhase = 6;
    
    // OPTION B: Render high-Z-index only (ship/Bob without terrain)
    /*
    yieldToBrowser(() => {
        // Only render Bob and ship, not 100+ terrain chunks
        scene.children.forEach(child => {
            if (!child.name.includes('chunk')) {
                child.visible = true;
            } else {
                child.visible = false;
            }
        });
        renderer.render(scene, camera);
        
        // Restore visibility
        scene.children.forEach(child => {
            child.visible = true;
        });
        bootPhase = 6;
    });
    */
}
```

**Pros:**
- Instant "graphics ready" (no 30s wait)
- Shaders compile invisibly during gameplay
- Minimal code changes

**Cons:**
- First few gameplay frames may stutter
- Less predictable user experience
- Some players may see a 1-2s hitch on first terrain chunk

---

## Performance Profiling Guide

### Add Performance Markers
Insert timing code to identify the exact culprit:

```javascript
} else if (bootPhase === 5) {
    updateUI("INITIALIZING GRAPHICS...", 95);
    bootPhase = 5.5;
    
    yieldToBrowser(() => {
        const startTime = performance.now();
        
        // Profile render time
        const beforeRender = performance.now();
        renderer.render(scene, camera);
        const renderTime = performance.now() - beforeRender;
        
        console.log(`Render compilation time: ${renderTime.toFixed(2)}ms`);
        console.log(`Total boot time: ${(performance.now() - startTime).toFixed(2)}ms`);
        
        // If > 5000ms, shader compilation is definitely the culprit
        if (renderTime > 5000) {
            console.warn('⚠️ SHADER COMPILATION IS BLOCKING MAIN THREAD');
            console.warn('Solution: Use renderer.compileAsync() or deferred compilation');
        }
        
        bootPhase = 6;
    });
}
```

### Chrome DevTools Profiling
1. Open DevTools → Performance tab
2. Start recording
3. Wait through loading screen
4. Stop recording
5. Look for long JavaScript frames during "INITIALIZING GRAPHICS"
6. Expand to see which functions take longest

**Expected output if shader compilation is the issue:**
```
WebGLRenderingContext (shader compilation) - 28,000ms
├── shaderProgramCompile
├── linkProgram
└── validateProgram
```

---

## Recommended Solution Priority

1. **🏆 Best:** Use `renderer.compileAsync()` (Solution 1)
   - Minimal code changes
   - Best performance
   - Smooth user experience
   - Just upgrade Three.js to r129+

2. **✅ Good:** Progressive compilation (Solution 2)
   - Works on current Three.js version
   - Shows progress
   - More complex but reliable

3. **⚡ Fast:** Deferred compilation (Solution 3)
   - Instant loading
   - Gameplay hiccup on first terrain chunk
   - Best if you can tolerate frame drops

---

## Three.js Version Check

Your current version: `r128` (from CDN in index.html line 8)

To upgrade to r129+ for `compileAsync()`:
```html
<!-- Change this: -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

<!-- To this: -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r147/three.min.js"></script>
```

---

## Next Steps

1. **Verify the bottleneck** using the performance markers above
2. **Choose your solution** based on complexity vs. performance trade-off
3. **Test with Performance Profiler** to confirm the fix
4. **Monitor gameplay FPS** after first terrain chunk loads
