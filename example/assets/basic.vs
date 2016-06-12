
uniform mat4 projectionMat;
uniform mat4 modelViewMat;
// uniform mat3 normalMat;

attribute vec3 position;
attribute vec2 texCoord;
attribute vec3 vertexNormal; //Not used, this is for the diffuse
varying vec2 vTexCoord;

void main() {
  vTexCoord = texCoord;
  gl_Position = projectionMat * modelViewMat * vec4( position, 1.0 );
}
