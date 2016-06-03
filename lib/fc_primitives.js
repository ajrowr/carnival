

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

window.FCShapes = (function () {
    "use strict";
    var shapeTypes = {};
    
    var parseSTLSource = function (srcLines, scale) {
        scale = scale || 1.0;
        console.log('scale is ',scale);
        var poly = new Poly();
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
                // console.log(myVert);
                verts[vertIdx] = mkVert(Number(myVert[1])*scale, Number(myVert[2])*scale, Number(myVert[3])*scale);
                // console.log(verts[vertIdx]);
                // console.log(vertIdx, verts);
                vertIdx++;
            }
            else if (rxEndFacet.exec(myLine)) {
                // console.log(verts);
                poly.add(verts[0], tex.no, verts[1], tex.no, verts[2], tex.no);
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
    
    
    
    var Drawable = function (pos, size, rotate, params) {
        var p = params || {};
        this.isRenderable = false;
        this.pos = pos || {x:0, y:0, z:0}; /* If no pos given then pos will probably be set in software */ /* World-space translation */
        this.size = size;
        this.scale = size.scale || p.scale || 1; /* For objects that can be scaled */
        this.orientation = rotate || {x:0, y:0, z:0};
        this.translation = {x:0, y:0, z:0}; /* Distinct from pos in that it's a model-space translation.  */
        this.matrix = null;
        this.currentOrientation = null;
        this.texture = p.texture || null;
        this.leftEyeTexture = p.leftEyeTexture || null;
        this.rightEyeTexture = p.rightEyeTexture || null;
        this.textureLabel = p.textureLabel || null;
        this.textureLoader = p.textureLoader || null; /* Used for image->texture parallelizing. Set null after use */
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
        this.animation = null; /* {startTime: endTime: startPos: endPos: } */
        /* How to do collisions? */
        // console.log('Object label is ', this.label, ', group label is ', this.groupLabel);
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
    
    Drawable.prototype.transformationMatrix = function () {
        /* This may have already been done for us */
        var pos;
        if (this.matrix) {
            return this.matrix;
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
        var mat = mat4.create();
        var qu = quat.create();
        var orien = this.currentOrientation || this.orientation;
        quat.rotateX(qu, qu, orien.x);
        quat.rotateY(qu, qu, orien.y);
        quat.rotateZ(qu, qu, orien.z);
        var trans = vec3.fromValues(pos.x, pos.y, pos.z);
        mat4.fromRotationTranslation(mat, qu, trans);
        // console.debug(mat);
        return mat;
    }
    
    Drawable.prototype.relocateTo = function (pos) {
        this.pos = pos;
    }
    
    /* Divulge the structure as either {indices: verts:} and/or {faces:{}} */
    /* If both are given, both will be used. Faces are a means of addressing parts of an object that use */
    /* (in particular) different textures and/or shaders from the rest. */
    /* Intended for definition by developer and use by the rendering machinery. */
    Drawable.prototype.divulge = function () {
        
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
        // var trX = -0.02, trY = 0.0, trZ = 0.17;
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
    
    var tex = {
        tl: [0,0],
        bl: [0,1],
        tr: [1,0],
        br: [1,1],
        no: [0,0]
    }
    
    /* END TOOLS */
    
    var Cuboid = function (pos, sz, rotate, params) {
        Drawable.call(this, pos, sz, rotate, params);
    }
    Cuboid.prototype = Object.create(Drawable.prototype);
    
    Cuboid.prototype.divulge = function () { /* DIS IS DE ONE WITH VERTEX NORMALS? FOR SOME SHADING */
        var indices = [], verts = [];
        var size = this.size;
        var pos = this.pos;
        
        var xplus = 0+(0.5*size.w), xminus = 0-(0.5*size.w);
        var zplus = 0+(0.5*size.d), zminus = 0-(0.5*size.d);
        var yplus = 0+size.h, yminus = 0;
        
        var idx = verts.length / 8.0;
        indices.push(idx, idx + 1, idx + 2); // these refer to the cubeVerts.push()es below - 1st triangle is 0,1,2
        indices.push(idx, idx + 2, idx + 3); // 2nd triangle is 0,2,3
        // GLfloat, GLfloat, GLfloat, GLfloat, GLfloat, 32 bits each

        // Bottom
        verts.push(xminus, yminus, zminus, 0.0, 1.0     , 0.0, -1.0, 0.0);
        verts.push(xplus, yminus, zminus, 1.0, 1.0     , 0.0, -1.0, 0.0);
        verts.push(xplus, yminus, zplus, 1.0, 0.0     , 0.0, -1.0, 0.0);
        verts.push(xminus, yminus, zplus, 0.0, 0.0     , 0.0, -1.0, 0.0);

        // Top
        idx = verts.length / 8.0;
        indices.push(idx, idx + 2, idx + 1);
        indices.push(idx, idx + 3, idx + 2);

        verts.push(xminus, yplus, zminus, 0.0, 0.0      , 0.0, 1.0, 0.0);
        verts.push(xplus, yplus, zminus, 1.0, 0.0      , 0.0, 1.0, 0.0);
        verts.push(xplus, yplus, zplus, 1.0, 1.0      , 0.0, 1.0, 0.0);
        verts.push(xminus, yplus, zplus, 0.0, 1.0      , 0.0, 1.0, 0.0);

        // Left
        idx = verts.length / 8.0;
        indices.push(idx, idx + 2, idx + 1);
        indices.push(idx, idx + 3, idx + 2);

        verts.push(xminus, yminus, zminus, 0.0, 1.0     , -1.0, 0.0, 0.0);
        verts.push(xminus, yplus, zminus, 0.0, 0.0     , -1.0, 0.0, 0.0);
        verts.push(xminus, yplus, zplus, 1.0, 0.0     , -1.0, 0.0, 0.0);
        verts.push(xminus, yminus, zplus, 1.0, 1.0     , -1.0, 0.0, 0.0);

        // Right
        idx = verts.length / 8.0;
        indices.push(idx, idx + 1, idx + 2);
        indices.push(idx, idx + 2, idx + 3);

        verts.push(xplus, yminus, zminus, 1.0, 1.0      , 1.0, 0.0, 0.0);
        verts.push(xplus, yplus, zminus, 1.0, 0.0      , 1.0, 0.0, 0.0);
        verts.push(xplus, yplus, zplus, 0.0, 0.0      , 1.0, 0.0, 0.0);
        verts.push(xplus, yminus, zplus, 0.0, 1.0      , 1.0, 0.0, 0.0);

        // Back
        idx = verts.length / 8.0;
        indices.push(idx, idx + 2, idx + 1);
        indices.push(idx, idx + 3, idx + 2);

        verts.push(xminus, yminus, zminus, 1.0, 1.0     , 0.0, 0.0, -1.0);
        verts.push(xplus, yminus, zminus, 0.0, 1.0     , 0.0, 0.0, -1.0);
        verts.push(xplus, yplus, zminus, 0.0, 0.0     , 0.0, 0.0, -1.0);
        verts.push(xminus, yplus, zminus, 1.0, 0.0     , 0.0, 0.0, -1.0);

        // Front
        idx = verts.length / 8.0;
        indices.push(idx, idx + 1, idx + 2);
        indices.push(idx, idx + 2, idx + 3);

        verts.push(xminus, yminus, zplus, 0.0, 1.0      , 0.0, 0.0, 1.0);
        verts.push(xplus, yminus, zplus, 1.0, 1.0      , 0.0, 0.0, 1.0);
        verts.push(xplus, yplus, zplus, 1.0, 0.0      , 0.0, 0.0, 1.0);
        verts.push(xminus, yplus, zplus, 0.0, 0.0      , 0.0, 0.0, 1.0);
        
        return {indices: indices, vertices: verts};
    }
    
    shapeTypes['Cuboid'] = Cuboid;
    
    
    var GroundedCuboid = function (pos, sz, rotate, params) {
        Drawable.call(this, pos, sz, rotate, params);
        this.faces = {
            'front': {}, 'top': {}, 'left': {}, 'right': {}, 'back': {}, 'bottom': {}
        };
        
    }
    GroundedCuboid.prototype = Object.create(Drawable.prototype);
    
    
    GroundedCuboid.prototype.divulge = function () {
        
        var size = this.size;
        var xplus = 0+(0.5*size.w), xminus = 0-(0.5*size.w);
        var zplus = 0+(0.5*size.d), zminus = 0-(0.5*size.d);
        var yplus = 0+size.h, yminus = 0;
        
        var A = mkVert(xminus, yplus, zplus);
        var B = mkVert(xplus, yplus, zplus);
        var C = mkVert(xplus, yminus, zplus);
        var D = mkVert(xminus, yminus, zplus);
        var E = mkVert(xplus, yminus, zminus);
        var F = mkVert(xplus, yplus, zminus);
        var G = mkVert(xminus, yminus, zminus);
        var H = mkVert(xminus, yplus, zminus);
        
        var polyFront = new Poly();
        polyFront.normal(0, 0, 1);
        polyFront.add(A, tex.tl, D, tex.bl, B, tex.tr);
        polyFront.add(D, tex.bl, C, tex.br, B, tex.tr);

        var polyBack = new Poly();
        polyBack.normal(0, 0, -1);
        polyBack.add(F, tex.tl, E, tex.bl, H, tex.tr);
        polyBack.add(E, tex.bl, G, tex.br, H, tex.tr);

        var polyLeft = new Poly();
        polyLeft.normal(-1, 0, 0);
        polyLeft.add(H, tex.tl, G, tex.bl, A, tex.tr);
        polyLeft.add(G, tex.bl, D, tex.br, A, tex.tr);

        var polyRight = new Poly();
        polyRight.normal(1, 0, 0);
        polyRight.add(B, tex.tl, C, tex.bl, F, tex.tr);
        polyRight.add(C, tex.bl, E, tex.br, F, tex.tr);

        var polyTop = new Poly();
        polyTop.normal(0, 1, 0);
        polyTop.add(H, tex.tl, A, tex.bl, F, tex.tr);
        polyTop.add(A, tex.bl, B, tex.br, F, tex.tr);

        var polyBottom = new Poly();
        polyBottom.normal(0, -1, 0);
        polyBottom.add(D, tex.tl, G, tex.bl, C, tex.tr);
        polyBottom.add(G, tex.bl, E, tex.br, C, tex.tr);
        
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
    
    /* BoardCuboid is a cuboid with 2 faces - front, and everything else. It's a performance hack. */
    var BoardCuboid = function (pos, sz, rotate, params) {
        Drawable.call(this, pos, sz, rotate, params);
        this.faces = {
            'front': {}, 'other': {}
        };
        
    }
    BoardCuboid.prototype = Object.create(Drawable.prototype);
    
    
    BoardCuboid.prototype.divulge = function () {
        
        var size = this.size;
        var xplus = 0+(0.5*size.w), xminus = 0-(0.5*size.w);
        var zplus = 0+(0.5*size.d), zminus = 0-(0.5*size.d);
        var yplus = 0+size.h, yminus = 0;
        
        var A = mkVert(xminus, yplus, zplus);
        var B = mkVert(xplus, yplus, zplus);
        var C = mkVert(xplus, yminus, zplus);
        var D = mkVert(xminus, yminus, zplus);
        var E = mkVert(xplus, yminus, zminus);
        var F = mkVert(xplus, yplus, zminus);
        var G = mkVert(xminus, yminus, zminus);
        var H = mkVert(xminus, yplus, zminus);
        
        var polyFront = new Poly();
        polyFront.normal(0, 0, 1);
        polyFront.add(A, tex.tl, D, tex.bl, B, tex.tr);
        polyFront.add(D, tex.bl, C, tex.br, B, tex.tr);

        var polyOther = new Poly();
        polyOther.normal(0, 0, -1);
        polyOther.add(F, tex.tl, E, tex.bl, H, tex.tr);
        polyOther.add(E, tex.bl, G, tex.br, H, tex.tr);

        polyOther.normal(-1, 0, 0);
        polyOther.add(H, tex.tl, G, tex.bl, A, tex.tr);
        polyOther.add(G, tex.bl, D, tex.br, A, tex.tr);

        polyOther.normal(1, 0, 0);
        polyOther.add(B, tex.tl, C, tex.bl, F, tex.tr);
        polyOther.add(C, tex.bl, E, tex.br, F, tex.tr);

        polyOther.normal(0, 1, 0);
        polyOther.add(H, tex.tl, A, tex.bl, F, tex.tr);
        polyOther.add(A, tex.bl, B, tex.br, F, tex.tr);

        polyOther.normal(0, -1, 0);
        polyOther.add(D, tex.tl, G, tex.bl, C, tex.tr);
        polyOther.add(G, tex.bl, E, tex.br, C, tex.tr);
        
        return {faces: {
            front: polyFront.divulge(),
            other: polyOther.divulge(),
        }};
        
    }

    shapeTypes['BoardCuboid'] = BoardCuboid;
    
    
    
    var ControllerShape = function (pos, sz, rotate, params) {
        Drawable.call(this, pos, sz, rotate, params);
    }
    
    ControllerShape.prototype = Object.create(Drawable.prototype);
    
    ControllerShape.prototype.divulge = function () {
        var poly = new Poly();
        poly.trX = -0.02;
        poly.trY = 0.0;
        poly.trZ = 0.17;
        // var faceNormal = {x:0,y:0,z:0};

        var A = mkVert(0.00, 0.00,0.00);
        var B = mkVert(0.04, 0.00,0.00);
        var C = mkVert(0.00,-0.03,-0.16);
        var D = mkVert(0.04,-0.03,-0.16);
        var E = mkVert(0.04, 0.00,-0.18);
        var F = mkVert(0.00, 0.00,-0.18);
        var G = mkVert(0.00,-0.06,-0.22);
        var H = mkVert(0.04,-0.06,-0.22);
        var I = mkVert(0.04,-0.03,-0.00);
        var K = mkVert(0.04,-0.08,-0.21);
        var L = mkVert(0.00,-0.08,-0.21);
        var M = mkVert(0.00,-0.03,-0.00);
                
        /* TOP */
        poly.normal(0, 1, 0);
        poly.add(A, tex.bl, B, tex.br, E, tex.tr);
        poly.add(A, tex.bl, E, tex.tr, F, tex.tl);

        poly.add(F, tex.no, E, tex.no, H, tex.no);
        poly.add(H, tex.no, G, tex.no, F, tex.no);

        /* BOTTOM */
        poly.normal(0, -1, 0);
        poly.add(I, tex.no, M, tex.no, C, tex.no);
        poly.add(I, tex.no, C, tex.no, D, tex.no);
        poly.add(D, tex.no, C, tex.no, L, tex.no);
        poly.add(L, tex.no, K, tex.no, D, tex.no);

        /* LEFT */
        poly.normal(-1, 0, 0);
        poly.add(M, tex.no, A, tex.no, F, tex.no);
        poly.add(F, tex.no, C, tex.no, M, tex.no);
        poly.add(F, tex.no, G, tex.no, C, tex.no);
        poly.add(C, tex.no, G, tex.no, L, tex.no);

        /* RIGHT */
        poly.normal(1, 0, 0);
        poly.add(B, tex.no, I, tex.no, D, tex.no);
        poly.add(B, tex.no, D, tex.no, E, tex.no);
        poly.add(D, tex.no, K, tex.no, E, tex.no);
        poly.add(E, tex.no, K, tex.no, H, tex.no);

        /* BACK TIP (toward user) */
        // faceNormal = {x:0,y:0,z:1.0};
        poly.normal(0, 0, 1);
        poly.add(M, tex.no, I, tex.no, B, tex.no);
        poly.add(B, tex.no, A, tex.no, M, tex.no);

        /* FRONT TIP */
        // faceNormal = {x:0,y:0,z:-1.0};
        poly.normal(0, 0, -1);
        poly.add(K, tex.no, L, tex.no, G, tex.no);
        poly.add(G, tex.no, H, tex.no, K, tex.no);
        
        return {indices: poly.indices, vertices: poly.verts};
        
    }
    
    shapeTypes['ControllerShape'] = ControllerShape;
    
    
    var TestShape = function (pos, sz, rotate, params) {
        Drawable.call(this, pos, sz, rotate, params);
    }
    TestShape.prototype = Object.create(Drawable.prototype);
    
    TestShape.prototype.divulge = function () {
        var srcLines = ["solid OpenSCAD_Model",
                        "  facet normal -0 0 1",
                        "    outer loop",
                        "      vertex -7.5 7.5 7.5",
                        "      vertex 7.5 -7.5 7.5",
                        "      vertex 7.5 7.5 7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 0 0 1",
                        "    outer loop",
                        "      vertex 7.5 -7.5 7.5",
                        "      vertex -7.5 7.5 7.5",
                        "      vertex -7.5 -7.5 7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 0 0 -1",
                        "    outer loop",
                        "      vertex -7.5 -7.5 -7.5",
                        "      vertex 7.5 7.5 -7.5",
                        "      vertex 7.5 -7.5 -7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal -0 0 -1",
                        "    outer loop",
                        "      vertex 7.5 7.5 -7.5",
                        "      vertex -7.5 -7.5 -7.5",
                        "      vertex -7.5 7.5 -7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 0 -1 0",
                        "    outer loop",
                        "      vertex -7.5 -7.5 -7.5",
                        "      vertex 7.5 -7.5 7.5",
                        "      vertex -7.5 -7.5 7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 0 -1 -0",
                        "    outer loop",
                        "      vertex 7.5 -7.5 7.5",
                        "      vertex -7.5 -7.5 -7.5",
                        "      vertex 7.5 -7.5 -7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 1 -0 0",
                        "    outer loop",
                        "      vertex 7.5 -7.5 7.5",
                        "      vertex 7.5 7.5 -7.5",
                        "      vertex 7.5 7.5 7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 1 0 0",
                        "    outer loop",
                        "      vertex 7.5 7.5 -7.5",
                        "      vertex 7.5 -7.5 7.5",
                        "      vertex 7.5 -7.5 -7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 0 1 -0",
                        "    outer loop",
                        "      vertex 7.5 7.5 -7.5",
                        "      vertex -7.5 7.5 7.5",
                        "      vertex 7.5 7.5 7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal 0 1 0",
                        "    outer loop",
                        "      vertex -7.5 7.5 7.5",
                        "      vertex 7.5 7.5 -7.5",
                        "      vertex -7.5 7.5 -7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal -1 0 0",
                        "    outer loop",
                        "      vertex -7.5 -7.5 -7.5",
                        "      vertex -7.5 7.5 7.5",
                        "      vertex -7.5 7.5 -7.5",
                        "    endloop",
                        "  endfacet",
                        "  facet normal -1 -0 0",
                        "    outer loop",
                        "      vertex -7.5 7.5 7.5",
                        "      vertex -7.5 -7.5 -7.5",
                        "      vertex -7.5 -7.5 7.5",
                        "    endloop",
                        "  endfacet",
                        "endsolid OpenSCAD_Model"];
        // var poly = new Poly();
        // var rxNormal = new RegExp('\\s*facet normal ([\\d\.-]+) ([\\d\.-]+) ([\\d\.-]+)');
        // var rxVertex = new RegExp('\\s*vertex ([\\d\.-]+) ([\\d\.-]+) ([\\d\.-]+)');
        // var rxEndFacet = new RegExp('\\s*endfacet\\s*');
        // var norm, myVert, verts=[], inFacet=false, vertIdx=0;
        // for (var i=0; i<srcLines.length; i++) {
        //     var myLine = srcLines[i];
        //     console.log(myLine);
        //     if (norm = rxNormal.exec(myLine)) {
        //         poly.normal(Number(norm[1]), Number(norm[2]), Number(norm[3]));
        //         vertIdx=0;
        //         inFacet = true;
        //     }
        //     else if (myVert = rxVertex.exec(myLine)) {
        //         // console.log(myVert);
        //         verts[vertIdx] = mkVert(Number(myVert[1]), Number(myVert[2]), Number(myVert[3]));
        //         // console.log(verts[vertIdx]);
        //         console.log(vertIdx, verts);
        //         vertIdx++;
        //     }
        //     else if (rxEndFacet.exec(myLine)) {
        //         console.log(verts);
        //         poly.add(verts[0], tex.no, verts[1], tex.no, verts[2], tex.no);
        //         vertIdx = 0;
        //         inFacet = false;
        //         verts = [];
        //     }
        // }
        // return {indices: poly.indices, vertices: poly.verts};
        return parseSTLSource(srcLines);
    }
    
    shapeTypes['TestShape'] = TestShape;
    
    var TestShape2 = function (pos, sz, rotate, params) {
        Drawable.call(this, pos, sz, rotate, params);
    }
    TestShape2.prototype = Object.create(Drawable.prototype);
    TestShape2.prototype.divulge = function () {
        var shape = this;
        loadSourceFromURL('http://vr.io.codex.cx/looksy/models/cubeish.stl')
        .then(function (source) {
            shape.sourceCode = source;
            return parseSTLSource(shape.sourceCode.split('\n'));
        })
        
        
    };
    
    shapeTypes['TestShape2'] = TestShape2;
    
    
    // shapeTypes['LoadedShape'] = LoadedShape;
    
    var LoaderShape = function (src, pos, sz, rotate, params) {
        Drawable.call(this, pos, sz, rotate, params);
        this.sourceCode = src;
    }
    LoaderShape.prototype = Object.create(Drawable.prototype);
    LoaderShape.prototype.divulge = function () {
        var shape = this;
        // loadSourceFromURL('http://vr.io.codex.cx/looksy/models/cubeish.stl')
        // .then(function (source) {
            // shape.sourceCode = source;
            // return parseSTLSource(shape.sourceCode.split('\n'));
        // })
        return parseSTLSource(shape.sourceCode.split('\n'), shape.scale);
    };
    shapeTypes['LoaderShape'] = LoaderShape;
    
    
    // var fromSourceURL = function (sourceURL) {
    //     return new Promise(function (resolve, reject) {
    //         loadSourceFromURL(sourceURL)
    //         .then(function (src) {
    //             // var mySource = source;
    //             resolve(LoadedShape);
    //         })
    //     });
    //
    // }
    
    // shapeTypes['fromSourceURL'] = fromSourceURL;
    shapeTypes['loadSourceFromURL'] = loadSourceFromURL;
    
    return shapeTypes;
    
})();