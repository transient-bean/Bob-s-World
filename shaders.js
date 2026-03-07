// bobs world shaders(v0.2).js
export const environmentUniforms = { 
    uTime: { value: 0.0 }, 
    uWindForce: { value: 0.0 },
    uBobPos: { value: new THREE.Vector3() },
    uBoostActive: { value: 0.0 },
    uBobIsUnderground: { value: 0.0 },
    uUndergroundCutoutAmount: { value: 0.0 },
    uCutoutY: { value: 0.0 },
    uSunPos: { value: new THREE.Vector3(0, 1, 0) },
    uSunIntensity: { value: 1.0 }
}; 

export const commonWobbleGLSL = `
    vec3 tri(vec3 x) {
        return abs(fract(x) * 2.0 - 1.0);
    }
`;

export function injectTerrainJitter(shader) {
    shader.uniforms.uBobPos = environmentUniforms.uBobPos;
    shader.uniforms.uBobIsUnderground = environmentUniforms.uBobIsUnderground;
    shader.uniforms.uUndergroundCutoutAmount = environmentUniforms.uUndergroundCutoutAmount;
    shader.uniforms.uCutoutY = environmentUniforms.uCutoutY;
    shader.vertexShader = `varying vec3 vWorldPositionCustom;\n` + shader.vertexShader;
    
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec4 wPos4 = modelMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING
            wPos4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
        vWorldPositionCustom = wPos4.xyz;
        vec3 p = wPos4.xyz * 0.8;
        vec3 wobbleOff = (abs(fract(p.xyz) * 2.0 - 1.0) * 0.5 + abs(fract(p.yzx + 0.5) * 2.0 - 1.0) * 0.5 - 0.5) * 0.25;
        
        #ifdef USE_INSTANCING
            vec3 right = instanceMatrix[0].xyz;
            vec3 up = instanceMatrix[1].xyz;
            vec3 forward = instanceMatrix[2].xyz;
            vec3 localOffset = vec3(
                dot(wobbleOff, right) / dot(right, right),
                dot(wobbleOff, up) / dot(up, up),
                dot(wobbleOff, forward) / dot(forward, forward)
            );
            transformed += localOffset;
        #else
            transformed += wobbleOff;
        #endif
    `);
    shader.fragmentShader = `
        uniform vec3 uBobPos;
        uniform float uBobIsUnderground;
        uniform float uUndergroundCutoutAmount;
        uniform float uCutoutY;
        varying vec3 vWorldPositionCustom;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        `
        #include <clipping_planes_fragment>
        if (uUndergroundCutoutAmount > 0.0) {
            vec3 toCam = normalize(cameraPosition - uBobPos);
            vec3 toPixel = vWorldPositionCustom - uBobPos;
            
            float distAlongCamLine = dot(toPixel, toCam);
            float distPerp = length(toPixel - toCam * distAlongCamLine);
            
            float currentRadius = uUndergroundCutoutAmount * 12.0; 
            
            if (vWorldPositionCustom.y > uCutoutY + 0.1) {
                if (distAlongCamLine > 1.2 && distPerp < currentRadius) {
                    discard;
                }
            }
        }
        `
    );
}

export function injectTerrainDepthJitter(shader) {
    shader.uniforms.uTime = environmentUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec4 wPos4 = modelMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING
            wPos4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
        vec3 p = wPos4.xyz * 0.8;
        vec3 wobbleOff = (abs(fract(p.xyz) * 2.0 - 1.0) * 0.5 + abs(fract(p.yzx + 0.5) * 2.0 - 1.0) * 0.5 - 0.5) * 0.25;
        
        #ifdef USE_INSTANCING
            vec3 right = instanceMatrix[0].xyz;
            vec3 up = instanceMatrix[1].xyz;
            vec3 forward = instanceMatrix[2].xyz;
            vec3 localOffset = vec3(
                dot(wobbleOff, right) / dot(right, right),
                dot(wobbleOff, up) / dot(up, up),
                dot(wobbleOff, forward) / dot(forward, forward)
            );
            transformed += localOffset;
        #else
            transformed += wobbleOff;
        #endif
    `);
}

export function injectWindJitter(shader) {
    shader.uniforms.uTime = environmentUniforms.uTime;
    shader.uniforms.uWindForce = environmentUniforms.uWindForce;
    shader.vertexShader = `uniform float uTime;\nuniform float uWindForce;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec4 wPos4 = modelMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING
            wPos4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
        float heightFactor = max(0.0, position.y - 0.5); 
        float phase = wPos4.x * 0.3 + wPos4.z * 0.3;
        float swayX = sin(uTime * 3.0 + phase) * 0.06 * uWindForce;
        float swayZ = cos(uTime * 2.5 + phase) * 0.04 * uWindForce;
        
        vec3 basePos = wPos4.xyz;
        basePos.y -= position.y; 
        vec3 p = basePos * 0.8;
        vec3 wobbleOff = (abs(fract(p.xyz) * 2.0 - 1.0) * 0.5 + abs(fract(p.yzx + 0.5) * 2.0 - 1.0) * 0.5 - 0.5) * 0.25;
        vec3 worldOffset = vec3(swayX * heightFactor + wobbleOff.x, wobbleOff.y, swayZ * heightFactor + wobbleOff.z);
        
        #ifdef USE_INSTANCING
            vec3 right = instanceMatrix[0].xyz;
            vec3 up = instanceMatrix[1].xyz;
            vec3 forward = instanceMatrix[2].xyz;
            vec3 localOffset = vec3(
                dot(worldOffset, right) / dot(right, right),
                dot(worldOffset, up) / dot(up, up),
                dot(worldOffset, forward) / dot(forward, forward)
            );
            transformed += localOffset;
        #else
            transformed += worldOffset;
        #endif
    `);
}

export const wobbleInject = (shader) => {
    shader.uniforms.uTime = environmentUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace(
        'void main() {',
        commonWobbleGLSL + '\nvoid main() {'
    );
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec4 wPos4 = modelMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING
            wPos4 = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
        vec3 p = wPos4.xyz * 0.8;
        vec3 wobbleOff = (abs(fract(p.xyz) * 2.0 - 1.0) * 0.5 + abs(fract(p.yzx + 0.5) * 2.0 - 1.0) * 0.5 - 0.5) * 0.25;
        
        #ifdef USE_INSTANCING
            vec3 right = instanceMatrix[0].xyz;
            vec3 up = instanceMatrix[1].xyz;
            vec3 forward = instanceMatrix[2].xyz;
            vec3 localOffset = vec3(
                dot(wobbleOff, right) / dot(right, right),
                dot(wobbleOff, up) / dot(up, up),
                dot(wobbleOff, forward) / dot(forward, forward)
            );
            transformed += localOffset;
        #else
            transformed += wobbleOff;
        #endif
    `);
};