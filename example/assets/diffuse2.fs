varying highp vec2 vTextureCoord;
varying highp vec3 vLighting;
varying highp vec3 vColor;

uniform sampler2D uSampler;

void main(void) {
    mediump vec4 texelColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
    gl_FragColor = vec4(texelColor.rgb * vLighting, texelColor.a);

    // gl_FragColor = vec4(vColor*vLighting, 1.0);
}
