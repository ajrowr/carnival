// #version 400
// in vec3 LightIntensity;
// layout (location=0) out vec4 FragColor;
// void main () {
//     FragColor = vec4(LightIntensity, 1.0);
// }
uniform sampler2D diffuse;


varying highp vec3 vColor;
varying highp vec3 N;
varying highp vec3 L;

void main (void) {
    highp float lambert = max(dot(normalize(N), normalize(L)), 0.3);
    gl_FragColor = vec4(vColor * lambert, 1.0);
    // gl_FragColor = vec4(0.2, 0.7, 0.2, 1.0);
}

