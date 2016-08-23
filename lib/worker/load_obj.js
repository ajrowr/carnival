
var parseMesh = function (objectData) {

    var verts = [], vertNormals = [], textures = [], unpacked = {};
    // unpacking stuff
    unpacked.verts = [];
    unpacked.norms = [];
    unpacked.textures = [];
    unpacked.hashindices = {};
    unpacked.indices = [];
    unpacked.index = 0;
    var lines = objectData.split('\n');

    var VERTEX_RE = /^v\s/;
    var NORMAL_RE = /^vn\s/;
    var TEXTURE_RE = /^vt\s/;
    var FACE_RE = /^f\s/;
    var WHITESPACE_RE = /\s+/;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var elements = line.split(WHITESPACE_RE);
      elements.shift();

      if (VERTEX_RE.test(line)) {
          verts.push.apply(verts, elements);
      } else if (NORMAL_RE.test(line)) {
          vertNormals.push.apply(vertNormals, elements);
      } else if (TEXTURE_RE.test(line)) {
          textures.push.apply(textures, elements);
      } else if (FACE_RE.test(line)) {
          var quad = false;
        for (var j = 0, eleLen = elements.length; j < eleLen; j++){
            // Triangulating quads
            // quad: 'f v0/t0/vn0 v1/t1/vn1 v2/t2/vn2 v3/t3/vn3/'
            // corresponding triangles:
            //      'f v0/t0/vn0 v1/t1/vn1 v2/t2/vn2'
            //      'f v2/t2/vn2 v3/t3/vn3 v0/t0/vn0'
            if(j === 3 && !quad) {
                // add v2/t2/vn2 in again before continuing to 3
                j = 2;
                quad = true;
            }
            if(elements[j] in unpacked.hashindices){
                unpacked.indices.push(unpacked.hashindices[elements[j]]);
            }
            else{

                var vertex = elements[ j ].split( '/' );

                // vertex position
                unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);
                // vertex textures
                if (textures.length) {
                  unpacked.textures.push(+textures[(vertex[1] - 1) * 2 + 0]);
                  unpacked.textures.push(+textures[(vertex[1] - 1) * 2 + 1]);
                }
                // vertex normals
                unpacked.norms.push(+vertNormals[(vertex[2] - 1) * 3 + 0]);
                unpacked.norms.push(+vertNormals[(vertex[2] - 1) * 3 + 1]);
                unpacked.norms.push(+vertNormals[(vertex[2] - 1) * 3 + 2]);
                // add the newly created vertex to the list of indices
                unpacked.hashindices[elements[j]] = unpacked.index;
                unpacked.indices.push(unpacked.index);
                // increment the counter
                unpacked.index += 1;
            }
            if(j === 3 && quad) {
                // add v0/t0/vn0 onto the second triangle
                unpacked.indices.push( unpacked.hashindices[elements[0]]);
            }
        }
      }
    }
    
    meshData = {
        vertices: unpacked.verts,
        vertexNormals: unpacked.norms,
        textures: unpacked.textures,
        indices: unpacked.indices
    };

    
  }


var HTTPLoader = function () {
    var loader = this;
    this.req = new XMLHttpRequest();
    this.getMesh = function (meshUrl) {
        return new Promise(function (resolve, reject) {
            loader.req.onreadystatechange = function () {
                if (loader.req.readyState === 4) {
                    resolve({data:loader.req.responseText, status:loader.req.status});
                }
            }
            loader.req.open('GET', meshUrl, true);
            loader.req.send();
        });
    }
    this.getMesh2 = function (meshUrl, callback) {
        loader.req.onreadystatechange = function () {
            if (loader.req.readyState === 4) {
            callback(loader.req.responseText, loader.req.status);
            }
        }
        loader.req.open('GET', meshUrl, true);
        loader.req.send();
    }
}

var meshData = null;

onmessage = function (message) {
    var loader = new HTTPLoader();
    if (message.data.op == 'load_mesh') {
        loader.getMesh(message.data.src)
        .then(function (obj) {
            if (obj.status == 200) {
                parseMesh(obj.data);
                postMessage({status:'mesh_loaded'});
            }
            else {
                console.log('Problem loading mesh, status:', obj.status);
            }
        });
    }
    else if (message.data.op == 'get') {
        var stash = {status: 'here_you_go'};
        var xfer = function (dat, key, typ) {
            var buf = new ArrayBuffer(dat.length*4);
            var tmp = new typ(dat);
            var viu = new typ(buf);
            viu.set(tmp);
            stash[key] = buf;
        }
        xfer(meshData.vertices, 'vertices', Float32Array);
        xfer(meshData.vertexNormals, 'normals', Float32Array);
        xfer(meshData.textures, 'texCoords', Float32Array);
        xfer(meshData.indices, 'indices', Uint32Array);
        postMessage(stash, [stash.vertices, stash.normals, stash.texCoords, stash.indices]);
    }
}
