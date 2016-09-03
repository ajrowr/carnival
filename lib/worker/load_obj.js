
/* This is lifted directly from fc_primitives since workers don't have access to libraries */
var P = function () {
    /* SOME TOOLS */
    var Poly = function () {
        this.verts = [];
        this.indices = [];
        this.faceNormal = {};
        this.trX = 0;
        this.trY = 0;
        this.trZ = 0;
    }
    
    Poly.prototype.add = function (vert1, tex1, vert2, tex2, vert3, tex3) {
        var baseIdx = this.verts.length / 8;
        var nx = this.faceNormal.x, ny = this.faceNormal.y, nz = this.faceNormal.z;
        this.verts.push(vert1.x+this.trX, vert1.y+this.trY, vert1.z+this.trZ, tex1[0], tex1[1], nx, ny, nz);
        this.verts.push(vert2.x+this.trX, vert2.y+this.trY, vert2.z+this.trZ, tex2[0], tex2[1], nx, ny, nz);
        this.verts.push(vert3.x+this.trX, vert3.y+this.trY, vert3.z+this.trZ, tex3[0], tex3[1], nx, ny, nz);
        this.indices.push(baseIdx, baseIdx+1, baseIdx+2);
    }
    
    Poly.prototype.normal = function (x, y, z) {
        this.faceNormal.x = x;
        this.faceNormal.y = y;
        this.faceNormal.z = z;
    }
    
    Poly.prototype.divulge = function () {
        return {indices: this.indices, vertices: this.verts};
    }

    var mkVert = function (x, y, z) {
        return {x:x, y:y, z:z};
    }
    
    /* Handy macros for common tex coords */
    var tex = {
        tl: [0,0], /* Top Left */
        bl: [0,1], /* Bottom Left */
        tr: [1,0], /* Top Right */
        br: [1,1], /* Bottom Right */
        no: [0,0]  /* null */
    }
    
    /* END TOOLS */
    
    return {
        Poly: Poly,
        tex: tex,
        mkVert: mkVert
    };
    
}();






var parseOBJ = function (objectData) {

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



var ensureString = function ( buf ) {

	if ( typeof buf !== "string" ) {

		var array_buffer = new Uint8Array( buf );
		var strArray = [];
		for ( var i = 0; i < buf.byteLength; i ++ ) {

			strArray.push(String.fromCharCode( array_buffer[ i ] )); // implicitly assumes little-endian

		}
		return strArray.join('');

	} else {

		return buf;

	}

}

var ensureBinary = function ( buf ) {

	if ( typeof buf === "string" ) {

		var array_buffer = new Uint8Array( buf.length );
		for ( var i = 0; i < buf.length; i ++ ) {

			array_buffer[ i ] = buf.charCodeAt( i ) & 0xff; // implicitly assumes little-endian

		}
		return array_buffer.buffer || array_buffer;

	} else {

		return buf;

	}

}


var parseSTL = function ( data ) {
	var isBinary = function () {

		var expect, face_size, n_faces, reader;
		reader = new DataView( binData );
		face_size = ( 32 / 8 * 3 ) + ( ( 32 / 8 * 3 ) * 3 ) + ( 16 / 8 );
		n_faces = reader.getUint32( 80, true );
		expect = 80 + ( 32 / 8 ) + ( n_faces * face_size );

		if ( expect === reader.byteLength ) {

			return true;

		}

		// some binary files will have different size from expected,
		// checking characters higher than ASCII to confirm is binary
		var fileLength = reader.byteLength;
		for ( var index = 0; index < fileLength; index ++ ) {

			if ( reader.getUint8( index, false ) > 127 ) {

				return true;

			}

		}

		return false;

	};

	var binData = ensureBinary( data );

	meshData = isBinary()
		? convertDivulgeToMesh(parseSTLBinary( binData ))
		: convertDivulgeToMesh(parseSTLASCII( ensureString( data ) ));

}

var parseSTLBinary = function ( data ) {
    
    var reader = new DataView( data );
    var faces = reader.getUint32( 80, true );

    var r, g, b, hasColors = false, colors;
    var defaultR, defaultG, defaultB, alpha;

    // process STL header
    // check for default color in header ("COLOR=rgba" sequence).

    for ( var index = 0; index < 80 - 10; index ++ ) {

    	if ( ( reader.getUint32( index, false ) == 0x434F4C4F /*COLO*/ ) &&
    		( reader.getUint8( index + 4 ) == 0x52 /*'R'*/ ) &&
    		( reader.getUint8( index + 5 ) == 0x3D /*'='*/ ) ) {

    		hasColors = true;
    		colors = new Float32Array( faces * 3 * 3 );

    		defaultR = reader.getUint8( index + 6 ) / 255;
    		defaultG = reader.getUint8( index + 7 ) / 255;
    		defaultB = reader.getUint8( index + 8 ) / 255;
    		alpha = reader.getUint8( index + 9 ) / 255;

    	}

    }

    var dataOffset = 84;
    var faceLength = 12 * 4 + 2;

    var offset = 0;

    // var geometry = new THREE.BufferGeometry();
    var geometry = {};

    var vertices = new Float32Array( faces * 3 * 3 );
    var normals = new Float32Array( faces * 3 * 3 );

    var polys = new P.Poly();

    for ( var face = 0; face < faces; face ++ ) {

    	var start = dataOffset + face * faceLength;
    	var normalX = reader.getFloat32( start, true );
    	var normalY = reader.getFloat32( start + 4, true );
    	var normalZ = reader.getFloat32( start + 8, true );
    
        polys.normal(normalX, normalY, normalZ);

    	if ( hasColors ) {

    		var packedColor = reader.getUint16( start + 48, true );

    		if ( ( packedColor & 0x8000 ) === 0 ) {

    			// facet has its own unique color

    			r = ( packedColor & 0x1F ) / 31;
    			g = ( ( packedColor >> 5 ) & 0x1F ) / 31;
    			b = ( ( packedColor >> 10 ) & 0x1F ) / 31;

    		} else {

    			r = defaultR;
    			g = defaultG;
    			b = defaultB;

    		}

    	}
    
        var polyverts = [];
    	for ( var i = 1; i <= 3; i ++ ) {

    		var vertexstart = start + i * 12;

    		vertices[ offset ] = reader.getFloat32( vertexstart, true );
    		vertices[ offset + 1 ] = reader.getFloat32( vertexstart + 4, true );
    		vertices[ offset + 2 ] = reader.getFloat32( vertexstart + 8, true );
        
            polyverts.push(P.mkVert(vertices[offset], vertices[offset+1], vertices[offset+2]));

    		normals[ offset ] = normalX;
    		normals[ offset + 1 ] = normalY;
    		normals[ offset + 2 ] = normalZ;

    		if ( hasColors ) {

    			colors[ offset ] = r;
    			colors[ offset + 1 ] = g;
    			colors[ offset + 2 ] = b;

    		}

    		offset += 3;

    	}
        polys.add(polyverts[0], P.tex.no, polyverts[1], P.tex.no, polyverts[2], P.tex.no);

    }

    // geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
    // geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );

    geometry.vertices = vertices;
    geometry.normals = normals;

    // if ( hasColors ) {
    //
    //     geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
    //     geometry.hasColors = true;
    //     geometry.alpha = alpha;
    //
    // }

    // return geometry;
    return {indices: polys.indices, vertices: polys.verts};

}


var parseSTLASCII = function ( data ) {

    var geometry, length, normal, patternFace, patternNormal, patternVertex, result, text;
    // geometry = new THREE.Geometry();
    geometry = {vertices: [], faces: []};
    patternFace = /facet([\s\S]*?)endfacet/g;

    var polys = new P.Poly();

    while ( ( result = patternFace.exec( data ) ) !== null ) {
        var faceVerts = [];

    	text = result[ 0 ];
    	patternNormal = /normal[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

    	while ( ( result = patternNormal.exec( text ) ) !== null ) {

            // normal = [ parseFloat( result[ 1 ] ), parseFloat( result[ 3 ] ), parseFloat( result[ 5 ] ) ];
        
            polys.normal(parseFloat( result[ 1 ] ), parseFloat( result[ 3 ] ), parseFloat( result[ 5 ] ));

    	}

    	patternVertex = /vertex[\s]+([\-+]?[0-9]+\.?[0-9]*([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+[\s]+([\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?)+/g;

    	while ( ( result = patternVertex.exec( text ) ) !== null ) {

            // geometry.vertices.push( [ parseFloat( result[ 1 ] ), parseFloat( result[ 3 ] ), parseFloat( result[ 5 ] ) ] );
        
            faceVerts.push(P.mkVert(parseFloat( result[ 1 ] ), parseFloat( result[ 3 ] ), parseFloat( result[ 5 ] )));
        
    	}

        // length = geometry.vertices.length;

        // geometry.faces.push( new THREE.Face3( length - 3, length - 2, length - 1, normal ) );
        // geometry.faces.push( [ length - 3, length - 2, length - 1, normal ] );
    
        polys.add(faceVerts[0], P.tex.no, faceVerts[1], P.tex.no, faceVerts[2], P.tex.no);

    }

    // geometry.computeBoundingBox();
    // geometry.computeBoundingSphere();

    return {indices: polys.indices, vertices: polys.verts};

    // return geometry;

}


var convertDivulgeToMesh = function (parsed) {
    var vert = [], norm = [], tex = [];
    for (var i=0; i<parsed.vertices.length/8; i++) {
        var base = 8*i;
        vert.push(parsed.vertices[base]);
        vert.push(parsed.vertices[base+1]);
        vert.push(parsed.vertices[base+2]);
        tex.push(parsed.vertices[base+3]);
        tex.push(parsed.vertices[base+4]);
        norm.push(parsed.vertices[base+5]);
        norm.push(parsed.vertices[base+6]);
        norm.push(parsed.vertices[base+7]);
    }

    return {
        indices: parsed.indices,
        textures: tex,
        vertexNormals: norm,
        vertices: vert
    };
};


var HTTPLoader = function () {
    var loader = this;
    this.req = new XMLHttpRequest();
    this.binary = false;
    this.getMesh = function (meshUrl) {
        // var ldr = this;
        if (loader.binary) this.req.responseType = 'arraybuffer';
        return new Promise(function (resolve, reject) {
            loader.req.onreadystatechange = function () {
                if (loader.req.readyState === 4) {
                    // console.log(loader.req.response.byteLength);
                    resolve({data:loader.binary && loader.req.response || loader.req.responseText,  
                            status:loader.req.status, 
                            type:loader.req.getResponseHeader('Content-Type')
                    });
                }
            }
            loader.req.open('GET', meshUrl, true);
            loader.req.send();
        });
    }
}

var meshData = null;

onmessage = function (message) {
    var loader = new HTTPLoader();
    if (message.data.op == 'load_mesh') {
        postMessage({status:'debug', message:'loading mesh from '+message.data.src});
        /* Assume STLs will be binary, this assumption is faulty but helpful (for now) */
        var isBinary = message.data.mode == 'binary';
        // console.log('using binary loader:', isBinary);
        loader.binary = isBinary;
        loader.getMesh(message.data.src)
        .then(function (obj) {
            if (obj.status == 200) {
                // console.log(obj.type);
                postMessage({status:'debug', message:'content type is '+obj.type});
                if (obj.type == 'model/x-wavefront-obj' || message.data.src.endsWith('.obj')) {
                    parseOBJ(obj.data);
                }
                else if (obj.type == 'model/x-stl' || obj.type == 'application/sla' || message.data.src.endsWith('.stl')) {
                    // console.log(obj.data.byteLength);
                    parseSTL(obj.data);
                }
                else {
                    postMessage({status:'error', message:'mesh type not recognized for '+message.data.src});
                }
                
                postMessage({status:'mesh_loaded'});
            }
            else {
                console.log('Problem loading mesh, status:', obj.status);
                postMessage({status:'error', message:'mesh loading failed, status '+obj.status});
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
