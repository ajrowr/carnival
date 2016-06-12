precision mediump float;
uniform sampler2D diffuse;
varying vec2 vTexCoord;

void main() {
  gl_FragColor = texture2D(diffuse, vTexCoord);
}

