attribute highp vec3 aVertexPosition;
attribute highp vec2 aTextureCoord;
attribute highp vec3 aVertexNormal;
// out vec3 lightIntensity;

// uniform vec4 lightPosition; // in eye coords
// uniform vec3 Kd;            // diffuse reflect
// uniform vec3 Ld;            // light source intensn


uniform highp mat4 modelViewMat;
uniform highp mat4 projectionMat;
uniform highp mat4 normalMat;
uniform highp vec3 baseColor; /* Deprecated */

varying highp vec2 vTextureCoord;
varying highp vec3 vLighting;

varying highp vec3 vColor; /* Deprecated */

void main(void) {
    gl_Position = projectionMat * modelViewMat * vec4(aVertexPosition, 1.0);
    vTextureCoord = aTextureCoord;
    
    highp vec3 ambientLight = vec3(0.6, 0.6, 0.6);
    highp vec3 directionalLightColor = vec3(0.5, 0.5, 0.75);
    highp vec3 directionalVector = vec3(0.85, 0.8, 0.75);
    
    highp vec4 transformedNormal = normalMat * vec4(aVertexNormal, 1.0);
    
    highp float directional = max(dot(transformedNormal.xyz, directionalVector), 0.0);
    vLighting = ambientLight + (directionalLightColor * directional);
    
    vColor = baseColor; /* Deprecated */
    
}



