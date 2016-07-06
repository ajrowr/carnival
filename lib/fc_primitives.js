

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
        /* This may have already been done for us, eg. in the case of controller trackers */
        var pos;
        if (this.matrix) {
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
    
    /* *** MOVING THESE *** */
    //
    // var Drawable = function (pos, size, orientation, params) {
    //     var p = params || {};
    //     var sz = size || {};
    //     this.isRenderable = false;
    //     this.size = sz;
    //     this.scale = sz.scale || p.scale || 1; /* For objects that can be scaled */
    //
    //     /* Model-space transforms */
    //     this.rotation = {x:0, y:0, z:0};
    //     this.translation = {x:0, y:0, z:0}; /* Distinct from pos in that it's a model-space translation.  */
    //
    //     /* World-space transforms */
    //     this.orientation = orientation || {x:0, y:0, z:0};
    //     this.pos = pos || {x:0, y:0, z:0}; /* If no pos given then pos will probably be set in software */
    //
    //     this.matrix = null;
    //     this.currentOrientation = null;
    //     this.texture = p.texture || null;
    //     this.leftEyeTexture = p.leftEyeTexture || null;
    //     this.rightEyeTexture = p.rightEyeTexture || null;
    //     this.textureLabel = p.textureLabel || null;
    //     this.textureLoader = p.textureLoader || null; /* Mainly used for image->texture parallelizing. Set null after use */
    //     this.shaderProgram = p.shaderProgram || null;
    //     this.shaderLabel = p.shaderLabel || null;
    //     this.baseColor = p.baseColor || null;
    //     this.vertBuffer = null;
    //     this.indexBuffer = null;
    //     this.faces = {}; /* each contains vertBuffer, indexBuffer, texture/textureLabel, shader/shaderLabel */
    //     this.indexCount = null;
    //     this.latestMoment = null;
    //     this.groupLabel = p.groupLabel || null;
    //     this.label = p.label || null;
    //     this.needsRebuild = true;
    //     this.behaviours = []; /* (drawable, timepoint, params) */
    //     this.interactions = {};
    //     this.isActor = p.isActor || false;
    //     this.scratchPad = {};
    //     this.metadata = {};
    //     this.animation = null; /* {startTime: endTime: startPos: endPos: } */
    //     /* How to do collisions? */
    //     // console.log('Object label is ', this.label, ', group label is ', this.groupLabel);
    // }
    //
    // Drawable.prototype.advanceSimulation = function (timePoint, actorsInProximity) {
    //     for (var i=0; i<this.behaviours.length; i++) {
    //         this.behaviours[i](this, timePoint, {});
    //         this.latestMoment = timePoint;
    //     }
    // }
    //
    // Drawable.prototype.interact = function (interactionType, params) {
    //     /* select, activate, context, lookAt, focusOn, focusOff, grab, swipe, throw ... */
    //     if (this.interactions[interactionType]) {
    //         this.interactions[interactionType](this, params);
    //     }
    //
    // }
    //
    // Drawable.prototype.animateToPosition = function (pos, duration, timingFunction) {
    //     this.animation = {
    //         startPos: this.pos,
    //         startTime: Date.now(),
    //         endPos: pos,
    //         endTime: Date.now() + duration,
    //         timingFunction: timingFunction || FCPrimitiveUtils.makeEasingFunction(3)
    //     }
    //
    // }
    //
    // Drawable.prototype.transformationMatrix = function () {
    //     /* This may have already been done for us, eg. in the case of controller trackers */
    //     var pos;
    //     if (this.matrix) {
    //         return this.matrix;
    //     }
    //     else if (this.animation) {
    //         /* Interpolate between current position and final position for animation */
    //         var t = function (x) { /* << this shouldn't be here, it's somewhere else? */
    //             /* p is fractional progress between 0 and 1 */
    //             return x**2 / (x**2 + ((1-x)**2));
    //         }
    //         var timingFn = this.animation.timingFunction;
    //         var anim = this.animation;
    //         var t = Date.now();
    //         var progress = (t-anim.startTime) / (anim.endTime-anim.startTime);
    //         // console.log('processing tween, progress', progress);
    //         var travelX = (anim.endPos.x - anim.startPos.x);
    //         var travelY = (anim.endPos.y - anim.startPos.y);
    //         var travelZ = (anim.endPos.z - anim.startPos.z);
    //         pos = {
    //             x: anim.startPos.x + timingFn(progress)*travelX,
    //             y: anim.startPos.y + timingFn(progress)*travelY,
    //             z: anim.startPos.z + timingFn(progress)*travelZ};
    //         if (t > anim.endTime) {
    //             this.pos = anim.endPos;
    //             this.animation = null;
    //         }
    //     }
    //     else {
    //         pos = this.pos;
    //     }
    //
    //     /* Translation */
    //     var trns = this.translation;
    //     var worldTrans = vec3.fromValues(pos.x, pos.y, pos.z); /* World-space */
    //     var modelTrans = vec3.fromValues(trns.x, trns.y, trns.z); /* Model-space */
    //     var trans = vec3.create();
    //     vec3.add(trans, worldTrans, modelTrans);
    //
    //     var quM = quat.create();
    //     var rot = this.rotation;
    //     quat.rotateX(quM, quM, rot.x);
    //     quat.rotateY(quM, quM, rot.y);
    //     quat.rotateZ(quM, quM, rot.z);
    //
    //     var quW = quat.create();
    //     var orien = this.currentOrientation || this.orientation;
    //     quat.rotateX(quW, quW, orien.x);
    //     quat.rotateY(quW, quW, orien.y);
    //     quat.rotateZ(quW, quW, orien.z);
    //
    //     var qu = quat.create();
    //     quat.mul(qu, quM, quW);
    //
    //     var mat = mat4.create();
    //     mat4.fromRotationTranslation(mat, qu, trans);
    //     return mat;
    // }
    //
    // Drawable.prototype.relocateTo = function (pos) {
    //     this.pos = pos;
    // }
    //
    // /* Divulge the structure as either {indices: verts:} and/or {faces:{}} */
    // /* If both are given, both will be used. Faces are a means of addressing parts of an object that use */
    // /* (in particular) different textures and/or shaders from the rest. */
    // /* Intended for definition by developer and use by the rendering machinery. */
    // Drawable.prototype.divulge = function () {
    //
    // }
    //
    // /* SOME TOOLS */
    // var Poly = function () {
    //     this.verts = [];
    //     this.indices = [];
    //     this.faceNormal = {};
    //     this.trX = 0;
    //     this.trY = 0;
    //     this.trZ = 0;
    // }
    //
    // Poly.prototype.add = function (vert1, tex1, vert2, tex2, vert3, tex3) {
    //     var baseIdx = this.verts.length / 8;
    //     var nx = this.faceNormal.x, ny = this.faceNormal.y, nz = this.faceNormal.z;
    //     this.verts.push(vert1.x+this.trX, vert1.y+this.trY, vert1.z+this.trZ, tex1[0], tex1[1], nx, ny, nz);
    //     this.verts.push(vert2.x+this.trX, vert2.y+this.trY, vert2.z+this.trZ, tex2[0], tex2[1], nx, ny, nz);
    //     this.verts.push(vert3.x+this.trX, vert3.y+this.trY, vert3.z+this.trZ, tex3[0], tex3[1], nx, ny, nz);
    //     this.indices.push(baseIdx, baseIdx+1, baseIdx+2);
    // }
    //
    // Poly.prototype.normal = function (x, y, z) {
    //     this.faceNormal.x = x;
    //     this.faceNormal.y = y;
    //     this.faceNormal.z = z;
    // }
    //
    // Poly.prototype.divulge = function () {
    //     return {indices: this.indices, vertices: this.verts};
    // }

    // var mkVert = function (x, y, z) {
    //     return {x:x, y:y, z:z};
    // }
    
    /* Handy macros for common tex coords */
    var tex = {
        tl: [0,0], /* Top Left */
        bl: [0,1], /* Bottom Left */
        tr: [1,0], /* Top Right */
        br: [1,1], /* Bottom Right */
        no: [0,0]  /* null */
    }
    
    /* END TOOLS */
    /* *** END MOVE *** */
    
    /* Toji's cuboid, I don't think we're using this anymore */
    var Cuboid = function (pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
    }
    Cuboid.prototype = Object.create(P.Drawable.prototype);
    
    Cuboid.prototype.divulge = function () {
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
    shapeTypes['SimpleCuboid'] = Cuboid;
    
    
    /* Cuboid centered in X and Z and perched on Y; six addressable faces. */
    /* For performance reasons you should only use this if you actually *need* six addressable faces. */
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
    
    /* Just a cube for testing the STL loader, what can I say */
    var TestShape = function (pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
    }
    TestShape.prototype = Object.create(P.Drawable.prototype);
    
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
        return parseSTLSource(srcLines);
    }
    
    shapeTypes['TestShape'] = TestShape;
    
    /* Test loading STL source from a file. */
    var TestShape2 = function (pos, sz, rotate, params) {
        P.Drawable.call(this, pos, sz, rotate, params);
    }
    TestShape2.prototype = Object.create(P.Drawable.prototype);
    TestShape2.prototype.divulge = function () {
        var shape = this;
        loadSourceFromURL('http://vr.io.codex.cx/looksy/models/cubeish.stl')
        .then(function (source) {
            shape.sourceCode = source;
            return parseSTLSource(shape.sourceCode.split('\n'));
        })
    };
    
    shapeTypes['TestShape2'] = TestShape2;
    
    /* Load the source elsewhere (probably as a promise in scene.setupPrereqs) and then pass it into this object as src. */
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
    
    
    
    return shapeTypes;
    
})();