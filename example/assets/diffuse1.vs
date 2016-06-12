attribute vec3 position;
attribute vec2 texCoord;
attribute vec3 vertexNormal;
// out vec3 lightIntensity;

// uniform vec4 lightPosition; // in eye coords
// uniform vec3 Kd;            // diffuse reflect
// uniform vec3 Ld;            // light source intensn

uniform mat4 modelViewMat;
uniform mat4 projectionMat;
uniform mat3 normalMat;
uniform vec3 baseColor;


// uniform mat4 MVP;           // proj * modelview

// void main () {
//     vec3 tnorm = normalize(normalMat * vertexNormal);
//     vec3 eyeCoords = modelViewMat * vec4(position, 1.0);
//     vec3 s = normalize(vec3(lightPosition - eyeCoords));
//
//     lightIntensity = Ld * Kd * max(dot(s, tnorm), 0.0);
//
//     gl_Position = MVP * vec4(position, 1.0);
// }

varying highp vec3 vColor;
varying highp vec3 L;
varying highp vec3 N;

void main () {
    // gl_Position = MVP * vec4(position, 1.0);
    gl_Position = projectionMat * modelViewMat * vec4( position, 1.0 );
    
    vec3 pointLightPosition = vec3(1.0, 5.0, -1.0);
    vec3 pointLightDirection = normalize(vec3(pointLightPosition.xyz - position.xyz));
    vec3 ambientColor = vec3(0.2, 0.2, 0.2);
    // vec3 color = vec3(0.2, 0.2, 0.7);
    //
    L = vec3(projectionMat * modelViewMat * vec4(pointLightDirection, 1.0));
    N = normalMat * vertexNormal;

    vColor = baseColor;
}

