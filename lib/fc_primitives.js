

/*
Notes:
re: object positioning
Shape should be centered around its position in the XZ axis but its Y position should correspond to the bottom of the object.

Objects track their position and their size. They calculate their own transformation matrices based on these things.

Objects can have behaviour programs attached...

Sizing:
Things are sized in different ways.
Some things have an inherent set of proportions in which case they should be scaled in proportion, if at all.
Some things are free-form like a cuboid.
Some things allow certain size data to be set but then have their own ideas about some other aspects of their size.

*/

window.FCPrimitiveUtils = (function () {
    var makeEasingFunction = function (power) {
        power = power || 2;
        var t = function (x) {
            /* p is fractional progress between 0 and 1 */
            return x**power / (x**power + ((1-x)**power));
        }
        return t;
    }
    
    return {
        makeEasingFunction: makeEasingFunction
    };
})();

window.FCMeshTools = (function () {
    
    var synthesizeNormals = function (mesh) {
        /* Take 9 coords across 3 points, calculate direction vectors and dot products, overwrite the normals already there */
        var vv = mesh.vertices;
        var vi = mesh.indices;
        var nn = mesh.vertexNormals;
        for (var i=0; i<vi.length/3; i++) {
            var baseIdx = 3*i;
            var idx1 = vi[baseIdx], idx2 = vi[baseIdx+1], idx3 = vi[baseIdx+2];
            
            var v1 = vec3.fromValues(vv[3*idx1], vv[(3*idx1)+1], vv[(3*idx1)+2]);
            var v2 = vec3.fromValues(vv[3*idx2], vv[(3*idx2)+1], vv[(3*idx2)+2]);
            var v3 = vec3.fromValues(vv[3*idx3], vv[(3*idx3)+1], vv[(3*idx3)+2]);

            var X=0,Y=1,Z=2;
            
            var u = vec3.create();
            vec3.sub(u, v2, v1);
            var v = vec3.create();
            vec3.sub(v, v3, v1);
            var norm = vec3.create();
            norm[X] = u[Y]*v[Z] - u[Z]*v[Y];
            norm[Y] = u[Z]*v[X] - u[X]*v[Z];
            norm[Z] = u[X]*v[Y] - u[Y]*v[X];
            
            vec3.normalize(norm, norm);
            var f = 1;
            nn[3*idx1] = f*norm[0]; nn[(3*idx1)+1] = f*norm[1]; nn[(3*idx1)+2] = f*norm[2];
            nn[3*idx2] = f*norm[0]; nn[(3*idx2)+1] = f*norm[1]; nn[(3*idx2)+2] = f*norm[2];
            nn[3*idx3] = f*norm[0]; nn[(3*idx3)+1] = f*norm[1]; nn[(3*idx3)+2] = f*norm[2];
        }
    }
    
    var analyseMesh = function (mesh) {
        var minX=Infinity, minY=Infinity, minZ=Infinity;
        var maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
        var vv = mesh.vertices;
        for (var i=0; i<vv.length/3; i++) {
            var baseIdx = i*3;
            var myX = vv[baseIdx], myY = vv[baseIdx+1], myZ = vv[baseIdx+2];
            minX = Math.min(minX, myX); maxX = Math.max(maxX, myX);
            minY = Math.min(minY, myY); maxY = Math.max(maxY, myY);
            minZ = Math.min(minZ, myZ); maxZ = Math.max(maxZ, myZ);
        }
        var xRange = maxX - minX, yRange = maxY - minY, zRange = maxZ - minZ;
        var fitInDimension = 2.0;
        var suggestedScale = Math.min(fitInDimension/xRange, fitInDimension/yRange, fitInDimension/zRange);
        
        var suggX = maxX - (xRange/2);
        var suggZ = maxZ - (zRange/2);
        
        var nn = mesh.vertexNormals;
        var normLengths = [];
        for (var i=0; i<nn.length/3; i++) {
            var baseIdx = i*3;
            // var myX = nn[baseIdx], myY = nn[baseIdx+1], myZ = nn[baseIdx+2];
            var norm = vec3.fromValues(nn[baseIdx], nn[baseIdx+1], nn[baseIdx+2]);
            normLengths.push(vec3.length(norm));
        }
        
        
        return {minX:minX, maxX:maxX, minY:minY, maxY:maxY, minZ:minZ, maxZ:maxZ, 
            suggestedScale:suggestedScale,
            normLengths: normLengths,
            suggestedScaledTranslate: {
                y: -1*(minY*suggestedScale),
                x: -1*suggX*suggestedScale,
                z: -1*suggZ*suggestedScale
            },
            suggestedTranslate: {
                y: -1*(minY),
                x: -1*suggX,
                z: -1*suggZ
            }
        };
    }
    
    /* Perform a "hard translate" on a mesh by applying a fixed shunt factor to its coords */
    var shuntMesh = function (mesh, shunt) {
        var vv = mesh.vertices;
        for (var i=0; i<vv.length/3; i++) {
            var baseIdx = i*3;
            vv[baseIdx] += shunt.x || 0.0;
            vv[baseIdx+1] += shunt.y || 0.0;
            vv[baseIdx+2] += shunt.z || 0.0;
        }
    }
    
    /* Perform a "hard turn" on a mesh by rotating its vertices and normals. */
    /* rotation is {x:, y:, z:} provided as radians of rotation. */
    var turnMesh = function (mesh, rotation) {
        var rQuat = quat.create();
        quat.rotateX(rQuat, rQuat, rotation.x);
        quat.rotateY(rQuat, rQuat, rotation.y);
        quat.rotateZ(rQuat, rQuat, rotation.z);
        // var rMat = mat4.create();
        // mat4.fromRotationTranslation(rMat, rQuat, [0,0,0]);
        var vv = mesh.vertices;
        for (var i=0; i<vv.length/3; i++) {
            var baseIdx = i*3;
            var vert = vec3.fromValues(vv[baseIdx], vv[baseIdx+1], vv[baseIdx+2]);
            vec3.transformQuat(vert, vert, rQuat);
            vv[baseIdx] = vert[0]; vv[baseIdx+1] = vert[1]; vv[baseIdx+2] = vert[2];
        }
        
        var nn = mesh.vertexNormals;
        if (nn && nn.length) {
            for (var i=0; i<nn.length; i++) {
                var baseIdx = i*3;
                var vert = vec3.fromValues(nn[baseIdx], nn[baseIdx+1], nn[baseIdx+2])
                vec3.transformQuat(vert, vert, rQuat);
                nn[baseIdx] = vert[0]; nn[baseIdx+1] = vert[1]; nn[baseIdx+2] = vert[2];
                
            }
        }
    }
    
    
    return {
        analyseMesh: analyseMesh,
        shuntMesh: shuntMesh,
        turnMesh: turnMesh,
        synthesizeNormals: synthesizeNormals
    };
    
})();

window.FCShapeUtils = (function () {
    
    /* Take Carnival divulge()-style output and convert it to a mesh */
    /* Also used for various model parsers eg. STL */
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
    
    var loadMesh = function (url, binaryMode, infoCallback) {
        
        var loadMeshWithWorker = function (meshUrl) {
            return new Promise(function (resolve, reject) {
                var worker = new window.Worker('/carnival/lib/worker/load_obj.js');
                worker.onmessage = function (msg) {
                    if (msg.data.status == 'mesh_loaded') {
                        worker.postMessage({op:'get'});
                    }
                    else if (msg.data.status == 'here_you_go') {
                        // console.log('Loaded mesh from '+meshUrl);
                        resolve(msg.data);
                    }
                    else if (msg.data.status == 'debug' && window.FC_DEBUG) {
                        console.log(msg.data.message);
                    }
                    else if (msg.data.status == 'progress') {
                        if (infoCallback) infoCallback(msg.data);
                    }
                    else if (msg.data.status == 'error') {
                        console.log('ERROR:', msg.data.message);
                        reject(msg.data.message);
                    }
                };
                var cfg = {reportProgress: infoCallback && true || false};
                worker.postMessage({op:'load_mesh', src:meshUrl, config:cfg, mode:binaryMode && 'binary' || 'ascii'});
            
            })
        }
        
        return new Promise(function (resolve, reject) {
            loadMeshWithWorker(url)
            .then(function (objdat) {
                var mesh = {
                    vertices: new Float32Array(objdat.vertices),
                    textures: new Float32Array(objdat.texCoords),
                    vertexNormals: new Float32Array(objdat.normals),
                    indices: new Uint32Array(objdat.indices)
                };
                resolve(mesh);                
            })
            .catch(function (rejected) {
                reject(rejected);
            });
        });
        
    };
    return {
        loadObj: loadMesh,
        loadMesh: loadMesh,
        convertDivulgeToMesh: convertDivulgeToMesh
    }
    
})();

window.FCPrimitives = (function () {
    
    var Drawable = function (pos, size, orientation, params) {
        var p = params || {};
        var sz = size || {};
        this.isRenderable = false;
        this.size = sz;
        this.scale = sz.scale || p.scale || 1; /* For objects that can be scaled */
        
        /* Model-space transforms */
        this.rotation = {x:0, y:0, z:0};
        this.translation = {x:0, y:0, z:0}; /* Distinct from pos in that it's a model-space translation.  */
        
        /* World-space transforms */
        this.orientation = orientation || {x:0, y:0, z:0};
        this.pos = pos || {x:0, y:0, z:0}; /* If no pos given then pos will probably be set in software */
        
        this.matrix = null;
        this.inheritedMatrix = null; /* For object grouping */
        this.injectedMatrix = null;
        this.currentOrientation = null;
        this.texture = p.texture || null;
        this.leftEyeTexture = p.leftEyeTexture || null;
        this.rightEyeTexture = p.rightEyeTexture || null;
        this.textureLabel = p.textureLabel || null;
        this.textureLoader = p.textureLoader || null; /* Mainly used for image->texture parallelizing. Set null after use */
        this.shaderProgram = p.shaderProgram || null;
        this.shaderLabel = p.shaderLabel || null;
        this.baseColor = p.baseColor || null;
        this.vertBuffer = null;
        this.indexBuffer = null;
        this.faces = {}; /* each contains vertBuffer, indexBuffer, texture/textureLabel, shader/shaderLabel */
        this.indexCount = null;
        this.latestMoment = null;
        this.groupLabel = p.groupLabel || null;
        this.label = p.label || null;
        this.needsRebuild = true;
        this.behaviours = []; /* (drawable, timepoint, params) */
        this.interactions = {};
        this.isActor = p.isActor || false;
        this.scratchPad = {};
        this.metadata = {};
        this.mesh = null;
        this.material = p.material || null;
        this.materialLabel = p.materialLabel || null;
        this.drawMode = null;
        this.animation = null; /* {startTime: endTime: startPos: endPos: } */
        /* How to do collisions? */
        // console.log('Object label is ', this.label, ', group label is ', this.groupLabel);
        
        this.hidden = false; /* Object is made to be seen but can be toggled in and out of visibility */
        this.invisible = false; /* Object is inherently invisible */
    }
    
    Drawable.prototype.advanceSimulation = function (timePoint, actorsInProximity) {
        for (var i=0; i<this.behaviours.length; i++) {
            this.behaviours[i](this, timePoint, {});
            this.latestMoment = timePoint;
        }
    }
    
    Drawable.prototype.interact = function (interactionType, params) {
        /* select, activate, context, lookAt, focusOn, focusOff, grab, swipe, throw ... */
        if (this.interactions[interactionType]) {
            this.interactions[interactionType](this, params);
        }
        
    }
    
    Drawable.prototype.animateToPosition = function (pos, duration, timingFunction) {
        this.animation = {
            startPos: this.pos,
            startTime: Date.now(),
            endPos: pos,
            endTime: Date.now() + duration,
            timingFunction: timingFunction || FCPrimitiveUtils.makeEasingFunction(3)
        }
        
    }
    
    Drawable.prototype.transformationMatrix = function (force) {
        /* This may have already been done for us, eg. in the case of controller trackers */
        var pos;
        if (this.matrix && !force) {
            if (this.scaleFactor) {
                // console.
                var scaleVec = vec3.fromValues(this.scaleFactor, this.scaleFactor, this.scaleFactor);
                var newMat = mat4.create();
                mat4.scale(newMat, this.matrix, scaleVec);
                return newMat;
            }
            else {
                return this.matrix;
            }
            // return this.matrix;
        }
        else if (this.animation) {
            /* Interpolate between current position and final position for animation */
            var t = function (x) {
                /* p is fractional progress between 0 and 1 */
                return x**2 / (x**2 + ((1-x)**2));
            }
            var timingFn = this.animation.timingFunction;
            var anim = this.animation;
            var t = Date.now();
            var progress = (t-anim.startTime) / (anim.endTime-anim.startTime);
            // console.log('processing tween, progress', progress);
            var travelX = (anim.endPos.x - anim.startPos.x);
            var travelY = (anim.endPos.y - anim.startPos.y);
            var travelZ = (anim.endPos.z - anim.startPos.z);
            pos = {
                x: anim.startPos.x + timingFn(progress)*travelX, 
                y: anim.startPos.y + timingFn(progress)*travelY, 
                z: anim.startPos.z + timingFn(progress)*travelZ};
            if (t > anim.endTime) {
                this.pos = anim.endPos;
                this.animation = null;
            }
        }
        else {
            pos = this.pos;
        }
        
        /* Translation */
        var trns = this.translation;
        var worldTrans = vec3.fromValues(pos.x, pos.y, pos.z); /* World-space */
        var modelTrans = vec3.fromValues(trns.x, trns.y, trns.z); /* Model-space */
        var trans = vec3.create();
        vec3.add(trans, worldTrans, modelTrans);
        
        var quM = quat.create();
        var rot = this.rotation;
        quat.rotateX(quM, quM, rot.x);
        quat.rotateY(quM, quM, rot.y);
        quat.rotateZ(quM, quM, rot.z);
        
        var quW = quat.create();
        var orien = this.currentOrientation || this.orientation;
        quat.rotateX(quW, quW, orien.x);
        quat.rotateY(quW, quW, orien.y);
        quat.rotateZ(quW, quW, orien.z);
        
        var qu = quat.create();
        quat.mul(qu, quM, quW);
        
        var scaleVec;
        if (this.scaleFactor) {
            // console.log('using scalefactor', this.scaleFactor)
            scaleVec = vec3.fromValues(this.scaleFactor, this.scaleFactor, this.scaleFactor);
        }
        else if (this.scaleFactors) {
            scaleVec = vec3.fromValues(this.scaleFactors.x, this.scaleFactors.y, this.scaleFactors.z);
        }
        else {
            scaleVec = vec3.fromValues(1,1,1);
        }
        
        var mat = mat4.create();
        mat4.fromRotationTranslationScale(mat, qu, trans, scaleVec);
        if (this.inheritedMatrix) {
            mat4.multiply(mat, this.inheritedMatrix, mat);
        }
        return mat;
    }
    
    Drawable.prototype.relocateTo = function (pos) {
        this.pos = pos;
    }
    
    /* Divulge the structure as either {indices: verts:} and/or {faces:{}} */
    /* If both are given, both will be used. Faces are a means of addressing parts of an object that use */
    /* (in particular) different textures and/or shaders from the rest. */
    /* Intended for definition by developer and use by the rendering machinery. */
    /* Note that if a Drawable has a mesh attribute then divulge() will be bypassed. */
    Drawable.prototype.divulge = function () {
        
    }
    
    var Container = function (pos, size, rotate, params) {
        Drawable.call(this, pos, size, rotate, params);
        this.invisible = true; /* Prevent engine from trying to draw this. If your container is actually intended to be visible, subclass this */
        this.parent = [];
        this.children = [];
    }

    Container.prototype = Object.create(Drawable.prototype);

    Container.prototype.getChildren = function () {
        return this.children;
    }

    Container.prototype.addChild = function (newChild) {
        this.children.push(newChild);
    }
    
    Container.prototype.divulge = function () {
        return {};
    }
    
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
        Drawable: Drawable,
        Container: Container,
        Poly: Poly,
        tex: tex,
        mkVert: mkVert
    };
    
})();

window.FCShapes = (function () {
    "use strict";
    var P = FCPrimitives;
    var shapeTypes = {};
    
    var parseSTLSource = function (srcLines, scale) {
        scale = scale || 1.0;
        var poly = new P.Poly();
        var rxNormal = new RegExp('\\s*facet normal ([\\d\.-]+) ([\\d\.-]+) ([\\d\.-]+)');
        var rxVertex = new RegExp('\\s*vertex ([\\d\.-]+) ([\\d\.-]+) ([\\d\.-]+)');
        var rxEndFacet = new RegExp('\\s*endfacet\\s*');
        var norm, myVert, verts=[], inFacet=false, vertIdx=0;
        for (var i=0; i<srcLines.length; i++) {
            var myLine = srcLines[i];
            // console.log(myLine);
            if (norm = rxNormal.exec(myLine)) {
                poly.normal(Number(norm[1]), Number(norm[2]), Number(norm[3]));
                vertIdx=0;
                inFacet = true;
            }
            else if (myVert = rxVertex.exec(myLine)) {
                verts[vertIdx] = P.mkVert(Number(myVert[1])*scale, Number(myVert[2])*scale, Number(myVert[3])*scale);
                vertIdx++;
            }
            else if (rxEndFacet.exec(myLine)) {
                poly.add(verts[0], P.tex.no, verts[1], P.tex.no, verts[2], P.tex.no);
                vertIdx = 0;
                inFacet = false;
                verts = [];
            }
        }
        return {indices: poly.indices, vertices: poly.verts};
    }
    
    var loadSourceFromURL = function (url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.addEventListener('load', function (evt) {
                if (xhr.status == 200) {
                    resolve(xhr.response);
                }
                else {
                    reject(xhr.statusText);
                }
            }, false);
            xhr.open('GET', url, true);
            xhr.send(null);
        })
        
    }

    var SimpleCuboid = function (pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
    }
    SimpleCuboid.prototype = Object.create(P.Drawable.prototype);
    SimpleCuboid.prototype.divulge = function () {
        
        var size = this.size;
        var xplus = 0+(0.5*size.w), xminus = 0-(0.5*size.w);
        var zplus = 0+(0.5*size.d), zminus = 0-(0.5*size.d);
        var yplus = 0+size.h, yminus = 0;
        
        var A = P.mkVert(xminus, yplus, zplus);
        var B = P.mkVert(xplus, yplus, zplus);
        var C = P.mkVert(xplus, yminus, zplus);
        var D = P.mkVert(xminus, yminus, zplus);
        var E = P.mkVert(xplus, yminus, zminus);
        var F = P.mkVert(xplus, yplus, zminus);
        var G = P.mkVert(xminus, yminus, zminus);
        var H = P.mkVert(xminus, yplus, zminus);
        
        var shape = new P.Poly();
        
        /* Front */
        shape.normal(0, 0, 1);
        shape.add(A, P.tex.tl, D, P.tex.bl, B, P.tex.tr);
        shape.add(D, P.tex.bl, C, P.tex.br, B, P.tex.tr);

        /* Back */
        shape.normal(0, 0, -1);
        shape.add(F, P.tex.tl, E, P.tex.bl, H, P.tex.tr);
        shape.add(E, P.tex.bl, G, P.tex.br, H, P.tex.tr);

        /* Left */
        shape.normal(-1, 0, 0);
        shape.add(H, P.tex.tl, G, P.tex.bl, A, P.tex.tr);
        shape.add(G, P.tex.bl, D, P.tex.br, A, P.tex.tr);

        /* Right */
        shape.normal(1, 0, 0);
        shape.add(B, P.tex.tl, C, P.tex.bl, F, P.tex.tr);
        shape.add(C, P.tex.bl, E, P.tex.br, F, P.tex.tr);

        /* Top */
        shape.normal(0, 1, 0);
        shape.add(H, P.tex.tl, A, P.tex.bl, F, P.tex.tr);
        shape.add(A, P.tex.bl, B, P.tex.br, F, P.tex.tr);

        /* Bottom */
        shape.normal(0, -1, 0);
        shape.add(D, P.tex.tl, G, P.tex.bl, C, P.tex.tr);
        shape.add(G, P.tex.bl, E, P.tex.br, C, P.tex.tr);
        
        return {indices: shape.indices, vertices: shape.verts};
    }
    
    shapeTypes['Cuboid'] = SimpleCuboid;
    shapeTypes['SimpleCuboid'] = SimpleCuboid;
    
    
    /* Cuboid centered in X and Z and perched on Y; six addressable faces. */
    /* For performance reasons you should only use this if you actually *need* six addressable faces. */
    /* Otherwise please consider SimpleCuboid. */
    var GroundedCuboid = function (pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
        this.faces = {
            'front': {}, 'top': {}, 'left': {}, 'right': {}, 'back': {}, 'bottom': {}
        };
        
    }
    GroundedCuboid.prototype = Object.create(P.Drawable.prototype);
    
    
    GroundedCuboid.prototype.divulge = function () {
        
        var size = this.size;
        var xplus = 0+(0.5*size.w), xminus = 0-(0.5*size.w);
        var zplus = 0+(0.5*size.d), zminus = 0-(0.5*size.d);
        var yplus = 0+size.h, yminus = 0;
        
        var A = P.mkVert(xminus, yplus, zplus);
        var B = P.mkVert(xplus, yplus, zplus);
        var C = P.mkVert(xplus, yminus, zplus);
        var D = P.mkVert(xminus, yminus, zplus);
        var E = P.mkVert(xplus, yminus, zminus);
        var F = P.mkVert(xplus, yplus, zminus);
        var G = P.mkVert(xminus, yminus, zminus);
        var H = P.mkVert(xminus, yplus, zminus);
        
        var polyFront = new P.Poly();
        polyFront.normal(0, 0, 1);
        polyFront.add(A, P.tex.tl, D, P.tex.bl, B, P.tex.tr);
        polyFront.add(D, P.tex.bl, C, P.tex.br, B, P.tex.tr);

        var polyBack = new P.Poly();
        polyBack.normal(0, 0, -1);
        polyBack.add(F, P.tex.tl, E, P.tex.bl, H, P.tex.tr);
        polyBack.add(E, P.tex.bl, G, P.tex.br, H, P.tex.tr);

        var polyLeft = new P.Poly();
        polyLeft.normal(-1, 0, 0);
        polyLeft.add(H, P.tex.tl, G, P.tex.bl, A, P.tex.tr);
        polyLeft.add(G, P.tex.bl, D, P.tex.br, A, P.tex.tr);

        var polyRight = new P.Poly();
        polyRight.normal(1, 0, 0);
        polyRight.add(B, P.tex.tl, C, P.tex.bl, F, P.tex.tr);
        polyRight.add(C, P.tex.bl, E, P.tex.br, F, P.tex.tr);

        var polyTop = new P.Poly();
        polyTop.normal(0, 1, 0);
        polyTop.add(H, P.tex.tl, A, P.tex.bl, F, P.tex.tr);
        polyTop.add(A, P.tex.bl, B, P.tex.br, F, P.tex.tr);

        var polyBottom = new P.Poly();
        polyBottom.normal(0, -1, 0);
        polyBottom.add(D, P.tex.tl, G, P.tex.bl, C, P.tex.tr);
        polyBottom.add(G, P.tex.bl, E, P.tex.br, C, P.tex.tr);
        
        return {faces: {
            front: polyFront.divulge(),
            back: polyBack.divulge(),
            left: polyLeft.divulge(),
            right: polyRight.divulge(),
            top: polyTop.divulge(),
            bottom: polyBottom.divulge()
        }};
        
    }

    shapeTypes['GroundedCuboid'] = GroundedCuboid;
    
    /* BoardCuboid is basically a GroundedCuboid with 3 addressable faces - front, caption, and everything else. */
    /* Set shape.faces.caption.noTexture=true if you're not using the caption. */
    var BoardCuboid = function (pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
        this.faces = {
            'front': {}, 'other': {}, 'caption': {}
        };
        
    }
    BoardCuboid.prototype = Object.create(P.Drawable.prototype);
    
    BoardCuboid.prototype.divulge = function () {
        
        var size = this.size;
        var xplus = 0+(0.5*size.w), xminus = 0-(0.5*size.w);
        var zplus = 0+(0.5*size.d), zminus = 0-(0.5*size.d);
        var yplus = 0+size.h, yminus = 0;
        
        var A = P.mkVert(xminus, yplus, zplus);
        var B = P.mkVert(xplus, yplus, zplus);
        var C = P.mkVert(xplus, yminus, zplus);
        var D = P.mkVert(xminus, yminus, zplus);
        var E = P.mkVert(xplus, yminus, zminus);
        var F = P.mkVert(xplus, yplus, zminus);
        var G = P.mkVert(xminus, yminus, zminus);
        var H = P.mkVert(xminus, yplus, zminus);
        
        var cfront = zplus + 0.05;
        var ctop = yminus + 0.50;
        var cA = P.mkVert(xminus, yminus, cfront);
        var cB = P.mkVert(xplus, yminus, cfront);
        var cC = P.mkVert(xplus, ctop, cfront);
        var cD = P.mkVert(xminus, ctop, cfront);
        
        var polyFront = new P.Poly();
        polyFront.normal(0, 0, 1);
        polyFront.add(A, P.tex.tl, D, P.tex.bl, B, P.tex.tr);
        polyFront.add(D, P.tex.bl, C, P.tex.br, B, P.tex.tr);
        
        var polyCaption = new P.Poly();
        polyCaption.normal(0, 0, 1);
        polyCaption.add(cA, P.tex.bl, cB, P.tex.br, cC, P.tex.tr);
        polyCaption.add(cA, P.tex.bl, cC, P.tex.tr, cD, P.tex.tl);

        var polyOther = new P.Poly();
        polyOther.normal(0, 0, -1);
        polyOther.add(F, P.tex.tl, E, P.tex.bl, H, P.tex.tr);
        polyOther.add(E, P.tex.bl, G, P.tex.br, H, P.tex.tr);

        polyOther.normal(-1, 0, 0);
        polyOther.add(H, P.tex.tl, G, P.tex.bl, A, P.tex.tr);
        polyOther.add(G, P.tex.bl, D, P.tex.br, A, P.tex.tr);

        polyOther.normal(1, 0, 0);
        polyOther.add(B, P.tex.tl, C, P.tex.bl, F, P.tex.tr);
        polyOther.add(C, P.tex.bl, E, P.tex.br, F, P.tex.tr);

        polyOther.normal(0, 1, 0);
        polyOther.add(H, P.tex.tl, A, P.tex.bl, F, P.tex.tr);
        polyOther.add(A, P.tex.bl, B, P.tex.br, F, P.tex.tr);

        polyOther.normal(0, -1, 0);
        polyOther.add(D, P.tex.tl, G, P.tex.bl, C, P.tex.tr);
        polyOther.add(G, P.tex.bl, E, P.tex.br, C, P.tex.tr);
        
        return {faces: {
            front: polyFront.divulge(),
            other: polyOther.divulge(),
            caption: polyCaption.divulge()
        }};
        
    }

    shapeTypes['BoardCuboid'] = BoardCuboid;
    
    
    /* Very basic controllerish shape. For most things you probably want to load a model for the controller. */
    var ControllerShape = function (pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
    }
    ControllerShape.prototype = Object.create(P.Drawable.prototype);
    
    ControllerShape.prototype.divulge = function () {
        var poly = new P.Poly();
        poly.trX = -0.02;
        poly.trY = 0.0;
        poly.trZ = 0.17;
        // var faceNormal = {x:0,y:0,z:0};

        var A = P.mkVert(0.00, 0.00,0.00);
        var B = P.mkVert(0.04, 0.00,0.00);
        var C = P.mkVert(0.00,-0.03,-0.16);
        var D = P.mkVert(0.04,-0.03,-0.16);
        var E = P.mkVert(0.04, 0.00,-0.18);
        var F = P.mkVert(0.00, 0.00,-0.18);
        var G = P.mkVert(0.00,-0.06,-0.22);
        var H = P.mkVert(0.04,-0.06,-0.22);
        var I = P.mkVert(0.04,-0.03,-0.00);
        var K = P.mkVert(0.04,-0.08,-0.21);
        var L = P.mkVert(0.00,-0.08,-0.21);
        var M = P.mkVert(0.00,-0.03,-0.00);
                
        /* TOP */
        poly.normal(0, 1, 0);
        poly.add(A, P.tex.bl, B, P.tex.br, E, P.tex.tr);
        poly.add(A, P.tex.bl, E, P.tex.tr, F, P.tex.tl);

        poly.add(F, P.tex.no, E, P.tex.no, H, P.tex.no);
        poly.add(H, P.tex.no, G, P.tex.no, F, P.tex.no);

        /* BOTTOM */
        poly.normal(0, -1, 0);
        poly.add(I, P.tex.no, M, P.tex.no, C, P.tex.no);
        poly.add(I, P.tex.no, C, P.tex.no, D, P.tex.no);
        poly.add(D, P.tex.no, C, P.tex.no, L, P.tex.no);
        poly.add(L, P.tex.no, K, P.tex.no, D, P.tex.no);

        /* LEFT */
        poly.normal(-1, 0, 0);
        poly.add(M, P.tex.no, A, P.tex.no, F, P.tex.no);
        poly.add(F, P.tex.no, C, P.tex.no, M, P.tex.no);
        poly.add(F, P.tex.no, G, P.tex.no, C, P.tex.no);
        poly.add(C, P.tex.no, G, P.tex.no, L, P.tex.no);

        /* RIGHT */
        poly.normal(1, 0, 0);
        poly.add(B, P.tex.no, I, P.tex.no, D, P.tex.no);
        poly.add(B, P.tex.no, D, P.tex.no, E, P.tex.no);
        poly.add(D, P.tex.no, K, P.tex.no, E, P.tex.no);
        poly.add(E, P.tex.no, K, P.tex.no, H, P.tex.no);

        /* BACK TIP (toward user) */
        // faceNormal = {x:0,y:0,z:1.0};
        poly.normal(0, 0, 1);
        poly.add(M, P.tex.no, I, P.tex.no, B, P.tex.no);
        poly.add(B, P.tex.no, A, P.tex.no, M, P.tex.no);

        /* FRONT TIP */
        // faceNormal = {x:0,y:0,z:-1.0};
        poly.normal(0, 0, -1);
        poly.add(K, P.tex.no, L, P.tex.no, G, P.tex.no);
        poly.add(G, P.tex.no, H, P.tex.no, K, P.tex.no);
        
        return {indices: poly.indices, vertices: poly.verts};
        
    }
    
    shapeTypes['ControllerShape'] = ControllerShape;
        
    /* Take a mesh and make it drawable. */
    var MeshShape = function (mesh, pos, size, rotate, params) {
        this.mesh = mesh;
        var sz = size || {};
        this.scaleFactor = sz.scale || 1.0;        
        
        P.Drawable.call(this, pos, sz, rotate, params);
        this.mesh = mesh;
        
    }
    MeshShape.prototype = Object.create(P.Drawable.prototype);
    MeshShape.prototype.divulge = function () {
        return {};
    }
    shapeTypes['MeshShape'] = MeshShape;
    
    /* Load the source elsewhere (probably as a promise in scene.setupPrereqs) and then pass it into this object as src. */
    /* Specific to STLs so it's now got limited usefulness. */
    /* DEPRECATED - use MeshShape instead */
    var LoaderShape = function (src, pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
        this.sourceCode = src;
    }
    LoaderShape.prototype = Object.create(P.Drawable.prototype);
    LoaderShape.prototype.divulge = function () {
        var shape = this;
        return parseSTLSource(shape.sourceCode.split('\n'), shape.scale);
    };
    shapeTypes['LoaderShape'] = LoaderShape;
    
    shapeTypes['loadSourceFromURL'] = loadSourceFromURL;
    
    
    /* A planar shape made of a definable number of segments to support tiling textures */
    /* Define its dimensions with size={minX, maxX, minY, maxY} notation */
    var WallShape = function (pos, size, rotate, params) {
        P.Drawable.call(this, pos, size, rotate, params);
        var p = params || {};
        var sz = size || {};
        this.segmentsX = p.segmentsX || 10;
        this.segmentsY = p.segmentsY || 10;
        this.minX = sz.minX || 0;
        this.minY = sz.minY || 0;
        this.maxX = sz.maxX || 10;
        this.maxY = sz.maxY || 10;
        
    }
    WallShape.prototype = Object.create(P.Drawable.prototype);
    
    WallShape.prototype.divulge = function () {
        var poly = new P.Poly();
        poly.normal(0,0,1);
        
        var segSizeX = (this.maxX - this.minX)/this.segmentsX;
        var segSizeY = (this.maxY - this.minY)/this.segmentsY;
        for (var ix=0; ix<this.segmentsX; ix++) {
            for (var jy=0; jy<this.segmentsY; jy++) {
                var xlo = this.minX + (ix*segSizeX);
                var xhi = xlo + segSizeX;
                var ylo = this.minY + (jy*segSizeY);
                var yhi = ylo + segSizeY;
                var z = 0;
                var A = P.mkVert(xlo, ylo, z);
                var B = P.mkVert(xhi, ylo, z);
                var C = P.mkVert(xhi, yhi, z);
                var D = P.mkVert(xlo, yhi, z);
                poly.add(A, P.tex.bl, B, P.tex.br, C, P.tex.tr);
                poly.add(A, P.tex.bl, C, P.tex.tr, D, P.tex.tl);
            }
        }
        return {indices: poly.indices, vertices: poly.verts};
    }
    
    shapeTypes['WallShape'] = WallShape;
    
    
    /* Procedural cylinder, faces invertable, endcap optional (TODO), centered on given pos, texcoords distributed evenly */
    /* size = {radius:R, height:H} */
    /* params = {segmentCount:N, segmentsFaceInwards:[true|false]} */
    var CylinderShape = function (pos, size, rotate, params) {
        P.Drawable.call(this, pos, size, rotate, params);
        var p = params || {};
        var sz = size || {};
        this.segmentCount = p.segmentCount || 100;
        this.segmentsFaceInwards = p.segmentsFaceInwards || false;
        this.radius = sz.radius || 1;
        this.height = sz.height || 1;
    }
    CylinderShape.prototype = Object.create(P.Drawable.prototype);
    
    CylinderShape.prototype.divulge = function () {
        var poly = new P.Poly();
        
        var ylo = 0, yhi = this.height;
        var anglePer = (2*Math.PI)/this.segmentCount;
        var r = this.radius;
        var texincr = 1/this.segmentCount;
        for (var i=0; i<this.segmentCount; i++) {
            var xlo = Math.cos(anglePer*i)*r, xhi = Math.cos(anglePer*(i+1))*r;
            var zlo = Math.sin(anglePer*i)*r, zhi = Math.sin(anglePer*(i+1))*r;
            var A = P.mkVert(xlo, ylo, zlo);
            var B = P.mkVert(xhi, ylo, zhi);
            var C = P.mkVert(xhi, yhi, zhi);
            var D = P.mkVert(xlo, yhi, zlo);
            var texL = texincr * i, texR = texincr * (i+1);
            var bl = [texL,1], br = [texR, 1], tl = [texL, 0], tr = [texR,0];
            poly.normal(Math.cos(anglePer*(i+0.5)), 0, Math.sin(anglePer*(i+0.5)));
            if (this.segmentsFaceInwards) {
                poly.add(A, bl, B, br, C, tr);
                poly.add(A, bl, C, tr, D, tl);
            }
            else {
                poly.add(C, tr, B, br, A, bl);
                poly.add(D, tl, C, tr, A, bl);
                
            }
        }
        return {indices: poly.indices, vertices: poly.verts};
    }
    
    shapeTypes['CylinderShape'] = CylinderShape;
    
    /* Building on the procedural cylinder, here's a procedural lathe. */
    /* Define a profile as a list of equally-spaced radius values (bottom to top) and magic will happen. */
    /* size = {height:H, profile:[list of radiuses]} */
    /* params = {segmentCount:N, segmentsFaceInwards:[true|false]} */
    /* In time we will add ways of defining the lathe, including potentially providing a function that the */
    /* shape can query, but that's currently experimental. */
    
    var LatheShape = function (pos, size, rotate, params) {
        P.Drawable.call(this, pos, size, rotate, params);
        var p = params || {};
        var sz = size || {};
        this.segmentCount = p.segmentCount || 100;
        this.segmentsFaceInwards = p.segmentsFaceInwards || false;
        this.profile = p.profile || sz.profile || [1,0];
        this.height = sz.height || 1;
        this.profileSampler = p.profileSampler || null;
        this.verticalSegmentCount = p.verticalSegmentCount || this.profileSampler && 100 || this.profile.length-1;
    }

    LatheShape.prototype = Object.create(P.Drawable.prototype);

    LatheShape.prototype.divulge = function () {
        var lathe = this;
        var polylist = [];
        var indices = [], vertices = [];
        var segmentHeight = lathe.height / lathe.verticalSegmentCount;
    
        var segPoly = new P.Poly();
    
        var mkSampler = function (profile) {
            var samp = function (segIdx, segCount) {
                return profile[segIdx];
            }
            return samp;
        }
    
        var sampler = lathe.profileSampler || mkSampler(lathe.profile);
    
        for (var i=0; i<lathe.verticalSegmentCount; i++) {
        
            var ylo = segmentHeight * i, yhi = segmentHeight * (i+1);
            var anglePer = (2*Math.PI)/this.segmentCount;
            var r1 = sampler(i, lathe.verticalSegmentCount);
            var r2 = sampler(i+1, lathe.verticalSegmentCount);
        
            var texincr = 1/this.segmentCount;
            for (var j=0; j<this.segmentCount; j++) {
                var x1a = Math.cos(anglePer*j)*r1, x1b = Math.cos(anglePer*(j+1))*r1;
                var z1a = Math.sin(anglePer*j)*r1, z1b = Math.sin(anglePer*(j+1))*r1;
                var x2a = Math.cos(anglePer*j)*r2, x2b = Math.cos(anglePer*(j+1))*r2;
                var z2a = Math.sin(anglePer*j)*r2, z2b = Math.sin(anglePer*(j+1))*r2;
                var A = P.mkVert(x1a, ylo, z1a);
                var B = P.mkVert(x1b, ylo, z1b);
                var C = P.mkVert(x2b, yhi, z2b);
                var D = P.mkVert(x2a, yhi, z2a);
                var texL = texincr * j, texR = texincr * (j+1);
                var bl = [texL,1], br = [texR, 1], tl = [texL, 0], tr = [texR,0];
                segPoly.normal(Math.cos(anglePer*(j+0.5)), 0, Math.sin(anglePer*(j+0.5)));
                if (this.segmentsFaceInwards) {
                    segPoly.add(A, bl, B, br, C, tr);
                    segPoly.add(A, bl, C, tr, D, tl);
                }
                else {
                    segPoly.add(C, tr, B, br, A, bl);
                    segPoly.add(D, tl, C, tr, A, bl);
            
                }
            }
                
        }
    
        return {indices: segPoly.indices, vertices: segPoly.verts};
    }


    /* Extruders have a Shape and a Profile */
    /* Each can be defined by an array of points or a sampler */
    var LatheExtruderShape = function (pos, size, rotate, params) {
        FCPrimitives.Drawable.call(this, pos, size, rotate, params);
        var p = params || {};
        var sz = size || {};
        this.segmentsFaceInwards = p.segmentsFaceInwards || false;
        this.height = sz.height || 1;
        this.scale = sz.scale || 1;

        this.endcap = true; /* Fake it by doing a very short segment with normals perpendicular to the shape */

        // this.shapePoints = p.shapePoints || [[-1,0.4], [0,0.4], [0,1], [1,0], [0,-1], [0,-0.4], [-1,-0.4]].reverse();
    
        this.shape = {};
        this.profile = {
            segmentCount: p.profile && p.profile.segmentCount || p.segmentCount || 100,
            points: p.profile && p.profile.points || p.profile || null,
            sampler: p.profile && p.profile.sampler || p.profileSampler || null,
            samplerType: p.profile && p.profile.samplerType || null
        };
    
        this.shape = {
            pointCount: p.shape && p.shape.pointCount || null,
            points: p.shape && p.shape.points || p.shapePoints,
                        // || [[-1,0.4], [0,0.4], [0,1], [1,0], [0,-1], [0,-0.4], [-1,-0.4]].reverse(),
            sampler: p.shape && p.shape.sampler || null,
            parameters: p.shape && p.shape.parameters || {} 
        }
    }

    LatheExtruderShape.prototype = Object.create(FCPrimitives.Drawable.prototype);

    LatheExtruderShape.prototype._makeFaceNormal = function (v1,v2,v3) {
        var X=0,Y=1,Z=2;
    
        var u = vec3.create();
        vec3.sub(u, v2, v1);
        var v = vec3.create();
        vec3.sub(v, v3, v1);
        var norm = vec3.create();
        norm[X] = u[Y]*v[Z] - u[Z]*v[Y];
        norm[Y] = u[Z]*v[X] - u[X]*v[Z];
        norm[Z] = u[X]*v[Y] - u[Y]*v[X];
    
        vec3.normalize(norm, norm);
        return norm;
    }

    LatheExtruderShape.prototype.divulge = function () {
        var lathe = this;
        var polylist = [];
        var indices = [], vertices = [];
        var segmentHeight = lathe.height / lathe.profile.segmentCount;

        var segPoly = new FCPrimitives.Poly();

        var samplerFactories = {
            BasicSampler: function (profile) {
                var samp = function (segIdx, segCount) {
                    return profile[segIdx];
                }
                return samp;
            },
            ExtrudeSampler: function (profile) {
                var samp = function (segIdx, segCount) {
                    if (segIdx==0) return 0.00001;
                    else if (segIdx>=segCount) return 0.00001;
                    else if (profile) return profile[segIdx];
                    else return 1;
                }
                return samp;
            },
            BeveledExtrudeSampler: function (profile) {
                var samp = function (segIdx, segCount) {
                    var frac = segIdx / segCount;
                    if (segIdx==0) return 0.00001;
                    else if (segIdx>=segCount) return 0.00001;
                    else if (frac > 0.95) return 1.0-(0.04-(1.0-frac));
                    else if (frac < 0.05) return 1.0-(0.04-frac);
                    else if (profile) return profile[segIdx];
                    else return 1;
                }
                return samp;
            }
        };
    
        var samplerType = samplerFactories[lathe.samplerType || 'ExtrudeSampler'];

        var sampler = lathe.profileSampler || samplerType(lathe.profile.points);
        var nShapePoints = lathe.shape.points && lathe.shape.points.length || lathe.shape.pointCount;
        var shapeSampler = lathe.shape.sampler || function (j, n) {return lathe.shape.points[j];}
    
        var sPoints = [];
        for (var i=0; i<nShapePoints; i++) {
            sPoints.push(shapeSampler(i, nShapePoints, lathe.shape.parameters));
        }
    
        for (var i=0; i<lathe.profile.segmentCount; i++) {
    
            var ylo = segmentHeight * i, yhi = segmentHeight * (i+1);
            var anglePer = (2*Math.PI)/this.segmentCount; //
            var r1 = sampler(i, lathe.profile.segmentCount);
            var r2 = sampler(i+1, lathe.profile.segmentCount);
            var s = this.scale;
    
            var texincr = 1/this.segmentCount; //
            for (var j=0; j<nShapePoints; j++) {
                var sp0 = sPoints[j==0 && nShapePoints-1 || j-1];
                var sp1 = sPoints[j];
                var x1a = sp0[0]*r1*s, x1b = sp1[0]*r1*s;
                var z1a = sp0[1]*r1*s, z1b = sp1[1]*r1*s;
                var x2a = sp0[0]*r2*s, x2b = sp1[0]*r2*s;
                var z2a = sp0[1]*r2*s, z2b = sp1[1]*r2*s;
                var A = FCPrimitives.mkVert(x1a, ylo, z1a);
                var B = FCPrimitives.mkVert(x1b, ylo, z1b);
                var C = FCPrimitives.mkVert(x2b, yhi, z2b);
                var D = FCPrimitives.mkVert(x2a, yhi, z2a);
                var texL = texincr * j, texR = texincr * (j+1);
                var bl = [texL,1], br = [texR, 1], tl = [texL, 0], tr = [texR,0];
                if (this.endcap && i+1==lathe.profile.segmentCount) {
                    segPoly.normal(0, 1, 0); /* If using an endcap then the final segment "faces" directly up */
                }
                else if (this.endcap && i==0) {
                    segPoly.normal(0, -1, 0)
                }
                else {
                    // segPoly.normal(Math.cos(anglePer*(j+0.5)), 0, Math.sin(anglePer*(j+0.5))); //
                    var v_1 = vec3.fromValues(C.x, C.y, C.z);
                    var v_2 = vec3.fromValues(B.x, B.y, B.z);
                    var v_3 = vec3.fromValues(A.x, A.y, A.z);
                    var n = this._makeFaceNormal(v_1, v_2, v_3);
                    segPoly.normal(n[0], n[1], n[2]);
                }
                if (this.segmentsFaceInwards) {
                    segPoly.add(A, bl, B, br, C, tr);
                    segPoly.add(A, bl, C, tr, D, tl);
                }
                else {
                    segPoly.add(C, tr, B, br, A, bl);
                    segPoly.add(D, tl, C, tr, A, bl);
        
                }
            }
            
        }

        return {indices: segPoly.indices, vertices: segPoly.verts};
    }


    
    shapeTypes['LatheShape'] = LatheShape;
    shapeTypes['LatheExtruderShape'] = LatheExtruderShape;
    
    return shapeTypes;
    
})();