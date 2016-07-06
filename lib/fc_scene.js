window.FCScene = (function () {
    "use strict";
    
    var Scene = function () {
        console.log("Initialising scene...");
        this.gl = null;
        
        this.sceneObjects = [];
        this.textures = {}; /* label: {obj: , ptr: } */
        this.shaders = {}; /* {obj:, label: } */
        this.modelSources = {};
        this.meshes = {};
        this.texturesPtr = 0;
        
        this.sceneVerts = [];
        this.sceneIndices = [];
        
        this.stageParams = null;
        this.playerLocation = {x: 0, z: 0, y: 0}; /* For room-scale, this is the location of the floor origin */
        
        this.isRendering = false;
        
        this.playerSpatialState = {
            head: {
                pos: null,
                ori: null
            },
            hands: [],
            needsUpdate: true
        };
        
        /* obj params: shader: <label> , texture: <label> */
                
    };
    
    Scene.prototype.setPlayerLocation = function (loc) {
        this.playerLocation.x = loc.x;
        this.playerLocation.y = loc.y;
        this.playerLocation.z = loc.z;
    }
    
    Scene.prototype.moveRaftAndPlayerTo = function (loc, tween) {
        if (tween) {
            /* TODO Tweening the floor is one thing but tweening the player is quite another */
            /* Maybe add a virtual object representing the player, and then use animate()? */
        }
        this.getObjectByLabel('raft').relocateTo({x:loc.x, y:loc.y+0.01, z:loc.z});
        this.setPlayerLocation(loc);
    }
    
    Scene.prototype.addObject = function (obj, params) {
        // sceneObjects = sceneObjects.concat([object]);
        this.prepareObject(obj);
        this.sceneObjects.push(obj);
    };
    
    /* NOTE: returns the object wrappers, not the drawables themselves */
    Scene.prototype.getObjectByLabel = function (label) {
        for (var i=0; i<this.sceneObjects.length; i++) {
            var sO = this.sceneObjects[i];
            if (sO.label == label) {
                return this.sceneObjects[i];
            }
        }
    }
    
    /* NOTE: returns the object wrappers, not the drawables themselves */
    Scene.prototype.getObjectsInGroup = function (groupLabel) {
        var objs = [];
        for (var i=0; i<this.sceneObjects.length; i++) {
            var sO = this.sceneObjects[i];
            if (sO.groupLabel == groupLabel) objs.push(this.sceneObjects[i]);
        }
        return objs;
    }
    
    Scene.prototype.getObjectDistancesFrom = function (loc, filter) {
        var scene = this;
        var objDists = [];
        for (var i=0; i<scene.sceneObjects.length; i++) {
            var o = scene.sceneObjects[i];
            if (filter && !filter(o)) continue;
            var px = (o.pos.x - loc.x), py = (o.pos.y - loc.y), pz = (o.pos.z - loc.z);
            var u = px**2 + pz**2;
            var v = u + py**2;
            var dist = Math.sqrt(v);
            objDists.push({distanceToPos: dist, obj: o});
            // leastDist = (leastDist == null ? dist : Math.min(leastDist, dist));
            // if (leastDist == dist) leastIdx = i;
            
        }
        return objDists;
    }
    
    Scene.prototype.removeObject = function (objToRemove) {
        var idx = this.sceneObjects.indexOf(objToRemove);
        // console.log(idx);
        // console.debug(this.sceneObjects[idx]);
        if (idx >= 0) {
            this.sceneObjects.splice(idx, 1);
        }
        else {
            console.log('Scene cannot remove object:', objToRemove);
        }
        
    }
    
    Scene.prototype.removeObjects = function (objsList) {
        for (var i=0; i<objsList.length; i++) {
            this.removeObject(objsList[i]);
        }
    }
    
    Scene.prototype.removeObjectsInGroup = function (groupLabel) {
        var objs = this.getObjectsInGroup(groupLabel);
        this.removeObjects(objs);
    }
    
    Scene.prototype.addTexture = function(tex, label) {
        this.textures[label] = texture;
    }
    
    // Scene.prototype.addTextureFromImage = function (filename, label, params) {
    //     var textureLoader = new WGLUTextureLoader(this.gl);
    //     var texture = textureLoader.loadTexture(filename);
    //     if (label) this.textures[label] = texture;
    //     // console.debug(texture);
    //     return texture;
    // }
    
    Scene.prototype.addTextureFromImage = function (src, label, params) {
        return FCUtil.loadImageAsTextureAnd(src, label, this);
    }
    
    Scene.prototype.addTextureFromCanvas = function (canvas, label, params) {
        var idx = 1; /* TODO */
        var gl = this.gl;
        gl.activeTexture(gl.TEXTURE0+idx);
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); /* TODO */
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.activeTexture(gl.TEXTURE0);
        // gl.uniform1i()
        if (label) this.textures[label] = texture;
        return texture;
    }

    Scene.prototype.addEncapsulatedTexture = function (texdat) {
        var idx = 1; /* TODO */
        var gl = this.gl;
        gl.activeTexture(gl.TEXTURE0+idx);
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texdat.pixels);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); /* TODO */
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.activeTexture(gl.TEXTURE0);
        // gl.uniform1i()
        if (texdat.label) this.textures[texdat.label] = texture;
        return texture;
    }

    
    /* NO IDEA WHY THIS DOESN'T WORK - using canvases instead */
    // Scene.prototype.addTextureFromColor = function (values, label, params) {
    //     var textureLoader = new WGLUTextureLoader(this.gl);
    //     // var texture = textureLoader.makeSolidColor(0.1, 0.2, 0.6, 0.9);
    //     console.debug(params);
    //     var texture = textureLoader.makeSolidColor(values.r, values.g, values.b, values.a);
    //     this.textures[label] = texture;
    //     console.debug(texture);
    // }
    
    Scene.prototype.addTextureFromColor = function (values, label, params) {
        /* There's probably a better way to do this */
        var cnv = document.createElement('canvas');
        var r, g, b, a;
        if (values.hex) {
            r = parseInt(values.hex.slice(1,3), 16);
            g = parseInt(values.hex.slice(3,5), 16);
            b = parseInt(values.hex.slice(5,7), 16);
            a = parseInt(values.hex.slice(7,9), 16) || 1;
        }
        else {
            r = values.r * 255;
            g = values.g * 255;
            b = values.b * 255;
            a = (values.a || 1) * 255;
        }
        cnv.width = 1;
        cnv.height = 1;
        var c2x = cnv.getContext('2d');
        c2x.beginPath();
        c2x.rect(0, 0, 1, 1);
        c2x.fillStyle = 'rgba('+Math.floor(r)+','+ 
                            Math.floor(g)+','+ 
                            Math.floor(b)+','+ 
                            Math.floor(a)+')';
        c2x.fill()
        return this.addTextureFromCanvas(cnv, label, params);
    }
    
    Scene.prototype.addShaderFromSources = function (srcv, srcf, attribLocations, label) {
        var program = new WGLUProgram(this.gl);
        program.attachShaderSource(srcv, this.gl.VERTEX_SHADER);
        program.attachShaderSource(srcf, this.gl.FRAGMENT_SHADER);
        program.bindAttribLocation(attribLocations);
        program.link();
        console.log(program);
        this.shaders[label] = program;        
    }
    
    Scene.prototype.addShaderFromTags = function (tagv, tagf, attribLocations, label) {
        var program = new WGLUProgram(this.gl);
        program.attachShaderSourceFromTag(tagv);
        program.attachShaderSourceFromTag(tagf);
        program.bindAttribLocation(attribLocations);
        program.link();
        this.shaders[label] = program;
    }
    
    Scene.prototype.addShaderFromUrlPair = function (urlVs, urlFs, label, attribLocations) {
        var scene = this;
        return new Promise(function (resolve, reject) {
            var promises = [];
            var program = new WGLUProgram(scene.gl);
            promises.push(program.attachShaderSourceFromXHR(urlVs, scene.gl.VERTEX_SHADER));
            promises.push(program.attachShaderSourceFromXHR(urlFs, scene.gl.FRAGMENT_SHADER));
            if (!attribLocations) {
                console.log('WARNING: No attribute locations were given for shader \'%s\'.', label);
            }
            Promise.all(promises).then(function () {
                program.bindAttribLocation(attribLocations);
                program.link();
                scene.shaders[label] = program;
                resolve();
            })
        });
    }
    
    Scene.prototype.addModelSource = function (srcUrl, label) {
        var scene = this;
        return new Promise(function (resolve, reject) {
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
            
            loadSourceFromURL(srcUrl)
            .then(function (src) {
                scene.modelSources[label] = src;
                resolve();
            });
        });
    }
    
    Scene.prototype.init = function (gl, stageParams) {
        this.gl = gl;
        this.stageParams = stageParams;
    }
    
    Scene.prototype.setup = function () {
        var scene = this;
        scene.setupPrereqs().then(function () {
            scene.setupScene();
        });
    }
    
    /* Setup things which happen asynchronously, but that must happen before the scene is tenable. */
    /* EG loading shaders via XHR. */
    /* This here is a default scene with no external dependencies; in most cases it should be overridden. */
    Scene.prototype.setupPrereqs = function () {
        var scene = this;
        return new Promise(function (resolve, reject) {
            scene.addShaderFromSources(
                /* Vertex shader */
                'uniform mat4 projectionMat;' +
                'uniform mat4 modelViewMat;' +
                'attribute vec3 position;' +
                'attribute vec2 texCoord;' +
                'attribute vec3 vertexNormal;' +
                'varying vec2 vTexCoord;' +
                'void main() {' +
                '  vTexCoord = texCoord;' +
                '  gl_Position = projectionMat * modelViewMat * vec4( position, 1.0 );' +
                '}',
                /* Fragment shader */
                'precision mediump float;' +
                'uniform sampler2D diffuse;' +
                'varying vec2 vTexCoord;' +
                'void main() {' +
                '  gl_FragColor = texture2D(diffuse, vTexCoord);' +
                '}',
                /* Shader attrib locations */
                {
                    position: 0,
                    texCoord: 1,
                    vertexNormal: 2
                },
                /* Shader label */
                'basic'
            );
            resolve();
        });
    }
    
    Scene.prototype.setupScene = function () {
        var scene = this;
        console.log('Using default scene setup');
        
        scene.addTextureFromColor({hex:'#4169e1'}, 'royalblue');
        scene.addTextureFromColor({hex:'#228b22'}, 'forestgreen');
        scene.addTextureFromColor({hex:'#ffe4b5'}, 'moccasin');
        
        /* Floor */
        scene.addObject(new FCShapes.GroundedCuboid(
            {x: 0, z: 0, y: 0},
            {w: this.stageParams.sizeX, d: this.stageParams.sizeZ, h: 0.01},
            null,
            {shaderLabel: 'basic', textureLabel: 'moccasin', label: 'floor'}
        ));
        
        /* Controller trackers */
        var buttonHandler = function () {
            
        }
        var tracker1 = new FCShapes.ControllerShape(
            {x: 0, z:0, y: -0.5},
            {w: 0.1, h: 0.03, d: 0.3},
            null,
            {label: 'gpTracker1', textureLabel: 'royalblue', shaderLabel: 'basic', groupLabel: 'gpTrackers'}
        );
        // tracker1.behaviours.push(mkTracker(0));
        tracker1.behaviours.push(FCUtil.makeGamepadTracker(scene, 0, buttonHandler));

        var tracker2 = new FCShapes.ControllerShape(
            {x: 0, z:0, y: -0.5},
            {w: 0.1, h: 0.03, d: 0.3},
            null,
            {label: 'gpTracker2', textureLabel: 'forestgreen', shaderLabel: 'basic', groupLabel: 'gpTrackers'}
        );
        tracker2.behaviours.push(FCUtil.makeGamepadTracker(scene, 1, buttonHandler));
        scene.addObject(tracker1);
        scene.addObject(tracker2);
        
    }
    
    Scene.prototype.prepareObject = function (obj) {
        var scene = this;
        var gl = this.gl;
        
        obj.isRenderable = false;
        
        var delBuffer = function (buf) {
            gl.deleteBuffer(buf);
        }
        
        var makeVertBuffer = function (verts) {
            var buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
            return buf;
        }
        
        var makeIdxBuffer = function (idxs) {
            var buf = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idxs), gl.STATIC_DRAW);
            return buf;
        }
        
        var objDat = obj.divulge();
        if (objDat.faces) {
            var faceKeys = Object.keys(objDat.faces);
            var faces = obj.faces;
            for (var i=0; i<faceKeys.length; i++) {
                var myFaceKey = faceKeys[i];
                var myFace = objDat.faces[myFaceKey];
                if (myFace.vertBuffer) delBuffer(myFace.vertBuffer);
                if (myFace.idxBuffer) delBuffer(myFace.idxBuffer);
                
                var indBuf = makeIdxBuffer(myFace.indices);
                var vertBuf = makeVertBuffer(myFace.vertices);
                
                var thisFace = objDat.faces[myFaceKey];
                var faceAnte = faces[myFaceKey];
                faces[myFaceKey] = {
                    vertBuffer: vertBuf,
                    idxBuffer: indBuf,
                    idxCount: myFace.indices.length,
                    textureLabel: thisFace.textureLabel || faceAnte.textureLabel || obj.textureLabel,
                    texture: thisFace.texture || faceAnte.texture || obj.texture,
                    leftEyeTexture: thisFace.leftEyeTexture || faceAnte.leftEyeTexture || obj.leftEyeTexture,
                    rightEyeTexture: thisFace.rightEyeTexture || faceAnte.rightEyeTexture || obj.rightEyeTexture,
                    shaderLabel: thisFace.shaderLabel || faceAnte.shaderLabel || obj.shaderLabel,
                    shader: thisFace.shader || faceAnte.shader || obj.shader,
                    textureLoader: thisFace.textureLoader || faceAnte.textureLoader || obj.textureLoader,
                    noTexture: faceAnte.noTexture || false,
                    parent: obj
                };
                /* This is a mechanism to explicitly block texture inheritance for faces we want to suppress rendering of */
                if (faces[myFaceKey].noTexture) {
                    faces[myFaceKey].texture = null;
                    faces[myFaceKey].textureLabel = null;
                }
                
            }
            obj.faces = faces;
        }
        
        if (objDat.vertices && objDat.indices) {
            if (obj.vertBuffer) {
                gl.deleteBuffer(obj.vertBuffer);
            }
            obj.vertBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(objDat.vertices), gl.STATIC_DRAW);
            if (obj.idxBuffer) {
                gl.deleteBuffer(obj.idxBuffer);
            }
            obj.idxBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.idxBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(objDat.indices), gl.STATIC_DRAW);
        
            obj.idxCount = objDat.indices.length;
            
        }
        obj.isRenderable = true;
    }
    
    Scene.prototype.prepareScene = function () {
        var gl = this.gl;
        for (var i=0; i<this.sceneObjects.length; i++) {
            this.prepareObject(this.sceneObjects[i]);
        }
    }
    
    Scene.prototype._renderObjectFace = function (sO, projectionMat, modelViewMat, pov, renderState) {
        var scene = this;
        var gl = this.gl;
        var shader = null;
        if (sO.debug) {
            console.log(sO.debug);
        }
        /* Check for a textureloader attached to object. This is a function which will create a texture */
        if (!renderState.hasLoadedATexture && sO.textureLoader) {
            var now = Date.now();
            if (now - renderState.timeSinceLastTextureLoad > 100) {
                sO.texture = scene.addEncapsulatedTexture({pixels:sO.textureLoader()});
                sO.textureLoader = null;
                renderState.hasLoadedATexture = true;
                renderState.timeSinceLastTextureLoad = now;
                return; /* Render on next pass, move to next obj for now */                    
            }
        }
        var myTex = null;
        if (pov == 'left_eye' && sO.leftEyeTexture) myTex = sO.leftEyeTexture;
        else if (pov == 'right_eye' && sO.rightEyeTexture) myTex = sO.rightEyeTexture;
        else if (sO.texture) myTex = sO.texture;
        else if (sO.textureLabel) myTex = scene.textures[sO.textureLabel];
        // else if (sO.params.texture) myTex = scene.textures[sO.params.texture];
        // else myTex = scene.texture; // TODO do better
        else return; /* Skip untextured objects */
        gl.bindTexture(gl.TEXTURE_2D, myTex);
        
        if (sO.shaderLabel) shader = scene.shaders[sO.shaderLabel];
        else if (sO.shader) shader = sO.shader;
        else if (sO.params.shader) shader = scene.shaders[sO.params.shader];
        else shader = scene.program; /* TODO change */
        // shader = this.program; /* TODO change */
        if (shader) shader.use();
        else return; /* Can't draw much without a shader! */
        
        gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
        // gl.uniformMatrix4fv(shader.uniform.modelViewMat, false, modelViewMat);
        
        var modelMat = sO.transformationMatrix && sO.transformationMatrix() || sO.parent.transformationMatrix();
        // console.debug(modelMat);
        var mVM = mat4.create();
        mat4.mul(mVM, modelViewMat, modelMat);
        // console.debug(modelMat);
        gl.uniformMatrix4fv(shader.uniform.modelViewMat, false, mVM);
        
        var normalMat = mat4.create();
        mat4.clone(normalMat, mVM);
        //
        mat4.invert(normalMat, normalMat);
        mat4.transpose(normalMat, normalMat);
        gl.uniformMatrix4fv(shader.uniform.normalMat, false, normalMat);
        
        /* Deprecated */
        // var baseColor;
        // if (sO.baseColor || (sO.parent && sO.parent.baseColor)) {
        //     var c = sO.baseColor || sO.parent.baseColor;
        //     baseColor = vec3.fromValues(c.r, c.g, c.b);
        // }
        // else {
        //     baseColor = vec3.fromValues(0.8, 0.8, 0.8);
        // }
        // gl.uniform3fv(shader.uniform.baseColor, baseColor);
        
        
        if (sO.mesh) {
            var mesh = sO.mesh;
            // console.log('using mesh');
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
            gl.vertexAttribPointer(shader.attrib.position, mesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
            
            gl.enableVertexAttribArray(shader.attrib.position);
            gl.enableVertexAttribArray(shader.attrib.vertexNormal);
            gl.disableVertexAttribArray(shader.attrib.texCoord);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
            gl.vertexAttribPointer(shader.attrib.vertexNormal, mesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
            // gl.drawElements(gl.TRIANGLES, mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
            var num = Math.min(mesh.indexBuffer.numItems, window.MESHLIMIT || Infinity);
            // num = Math.min(num, 65500);
            // gl.drawElements(gl.TRIANGLES, num, gl.UNSIGNED_SHORT, 0);
            gl.drawElements(gl.TRIANGLES, num, gl.UNSIGNED_INT, 0);
            
            
            
        }
        else {
            
            gl.bindBuffer(gl.ARRAY_BUFFER, sO.vertBuffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sO.idxBuffer);

            gl.enableVertexAttribArray(shader.attrib.position);
            gl.enableVertexAttribArray(shader.attrib.texCoord);
            gl.enableVertexAttribArray(shader.attrib.vertexNormal);
        
            gl.vertexAttribPointer(shader.attrib.position, 3, gl.FLOAT, false, 32, 0);
            gl.vertexAttribPointer(shader.attrib.texCoord, 2, gl.FLOAT, false, 32, 12);
            gl.vertexAttribPointer(shader.attrib.vertexNormal, 3, gl.FLOAT, false, 32, 20);
        
            gl.activeTexture(gl.TEXTURE0);
            gl.uniform1i(shader.diffuse, 0);
        
    
            // gl.drawElements(gl.TRIANGLES, sO.idxCount, gl.UNSIGNED_SHORT, 0);
            gl.drawElements(gl.TRIANGLES, sO.idxCount, gl.UNSIGNED_INT, 0);
        }
    }
    
    
    Scene.prototype.render = function (projectionMat, modelViewMat, pov) {
        var gl = this.gl;
        var scene = this;
        var hasLoadedATexture = false;
        
        var renderState = {
            hasLoadedATexture: false,
            timeSinceLastTextureLoad: scene.timeSinceLastTextureLoad || 0
        };
        
        
        var spatial = scene.playerSpatialState;
        
        /* Figure out player spatial info since we'll be needing that - but only once every other cycle */
        /* (for players with 2 eyes that is) */
        if (spatial.needsUpdate) {
            var vrGamepads = FCUtil.getVRGamepads();
            var ploc = scene.playerLocation;
            for (var i=0; i<vrGamepads.length; i++) {
                var myGp = vrGamepads[i];
                var gPose = myGp.pose;
                var gpMat = mat4.create();
                // var orientation = gPose.orientation;
                // var position = gPose.
                if (window.vrDisplay.stageParameters) {
                    mat4.fromRotationTranslation(gpMat, gPose.orientation, gPose.position);
                    mat4.multiply(gpMat, vrDisplay.stageParameters.sittingToStandingTransform, gpMat);
                    var trans = vec3.fromValues(ploc.x, ploc.y, ploc.z);
                    var reloc = mat4.create();
                    var gpLoc = vec3.create();
                    mat4.fromTranslation(reloc, trans);
                    mat4.mul(gpMat, reloc, gpMat);
                    // vec3.transformMat4(gpLoc, gpMat)
                    mat4.getTranslation(gpLoc, gpMat);
                    
                    var newOri = vec3.create();
                    quat.getAxisAngle(newOri, gPose.orientation);
                    spatial.hands[i] = {
                        pos: {x:gpLoc[0], y:gpLoc[1], z:gpLoc[2]},
                        ori: {x:newOri[0], y:newOri[1], z:newOri[2]}
                    };
                }
                else {
                    
                    /* TODO hmm */
                }
                
            }
            
            /* TODO head */
            // console.debug(gPose.position);
            // console.debug(vrDisplay.stageParameters.sittingToStandingTransform);
            //
            // var ploc = scene.playerLocation;
            
            spatial.needsUpdate = false;
        }
        else {
            spatial.needsUpdate = true;
        }
        
        
        for (var i=0; i<scene.sceneObjects.length; i++) {
            var scene = this;
            var sO = scene.sceneObjects[i];
            if (!sO.isRenderable) continue;
            // var sObj = sO;
            var shader = null;
            sO.advanceSimulation(Date.now());
            
            if ((sO.idxBuffer && sO.vertBuffer) || sO.mesh) {
                scene._renderObjectFace(sO, projectionMat, modelViewMat, pov, renderState);
            }
            var faceKeys = Object.keys(sO.faces);
            if (faceKeys.length) {
                var c = faceKeys.length;
                for (var j=0; j<c; j++) {
                    var myKey = faceKeys[j];
                    scene._renderObjectFace(sO.faces[myKey], projectionMat, modelViewMat, pov, renderState);
                }
            }
            scene.timeSinceLastTextureLoad = renderState.timeSinceLastTextureLoad;
        }
        
    };
        
    return Scene;
        
})();
