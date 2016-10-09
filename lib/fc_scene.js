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
        this.materials = {}; /* label:, texture:, textureLabel:, ambient:, diffuse:, specular:, shininess:, shader:, shaderLabel:,  */ 
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
    
    /* Relocate the player's feet to loc. Tween is currently unsupported. */
    Scene.prototype.moveRaftAndPlayerTo = function (loc, tween) {
        var pose = window.vrDisplay.getPose();
        var position = vec3.fromValues(pose.position[0], pose.position[1], pose.position[2]);
        var orientation = quat.create();
        var out = mat4.create()
        mat4.fromRotationTranslation(out, orientation, position);
        mat4.multiply(out, vrDisplay.stageParameters.sittingToStandingTransform, out);

        var translation = vec3.create();
        mat4.getTranslation(translation, out);
        
        var raftloc = {x:loc.x-translation[0], y:loc.y+0.01, z:loc.z-translation[2]};
        this.getObjectByLabel('raft').relocateTo(raftloc);
        this.setPlayerLocation(raftloc);
    }
    
    Scene.prototype.addObject = function (obj, params) {
        // sceneObjects = sceneObjects.concat([object]);
        // this.prepareObject(obj);
        this.prepareObjectRecursive(obj);
        this.sceneObjects.push(obj);
    };
    
    Scene.prototype.prepareObjectRecursive = function (obj) {
        var children = obj.getChildren && obj.getChildren() || [];
        for (var i=0; i<children.length; i++) {
            this.prepareObjectRecursive(children[i]);
        }
        if (obj.drawable) {
            this.prepareObjectRecursive(obj.drawable);
        }
        this.prepareObject(obj);
    }
    
    Scene.prototype.addObjects = function (objs) {
        for (var i=0; i<objs.length; i++) {
            this.addObject(objs[i]);
        }
    }
    
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
            if (!o.pos) o = o.drawable; /* For components */
            if (filter && !filter(o)) continue;
            var px = (o.pos.x - loc.x), py = (o.pos.y - loc.y), pz = (o.pos.z - loc.z);
            var u = px**2 + pz**2;
            var v = u + py**2;
            var dist = Math.sqrt(v);
            objDists.push({distanceToPos: dist, obj: scene.sceneObjects[i]});
            // leastDist = (leastDist == null ? dist : Math.min(leastDist, dist));
            // if (leastDist == dist) leastIdx = i;
            
        }
        return objDists;
    }
    
    Scene.prototype.getNearestObjectToPoint = function (loc, filter) {
        var nearest = null;
        var objs = this.getObjectDistancesFrom(loc, filter);
        for (var i = 0; i < objs.length; i++) {
            var o = objs[i];
            // console.log(o);
            if (!o.obj.drawable) { /* For now we filter in things that are components. Future we'll probably use physics.grabbable */
                continue;
            }
            if (nearest) nearest = (o.distanceToPos <= nearest.distanceToPos) && o || nearest;
            else nearest = o;
        }
        return nearest;
    }
    
    Scene.prototype.removeObject = function (objToRemove, expunge) { /* TODO make a recursive one */
        var idx = this.sceneObjects.indexOf(objToRemove);
        // console.log(idx);
        // console.debug(this.sceneObjects[idx]);
        if (idx >= 0) {
            var obj = this.sceneObjects[idx];
            this.sceneObjects.splice(idx, 1);
            if (obj.mesh && expunge) {
                this.gl.deleteBuffer(obj.mesh.vertexBuffer);
                this.gl.deleteBuffer(obj.mesh.indexBuffer);
                this.gl.deleteBuffer(obj.mesh.textureBuffer);
                this.gl.deleteBuffer(obj.mesh.normalBuffer);
                /* This is a little dangerous for now - not all meshes are immediately out of scope upon model removal! */
                /* Maybe do some reference counting? */
            }
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
                resolve({label: label, program: program});
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
        var ext = gl.getExtension('OES_element_index_uint');
    }
    
    Scene.prototype.setup = function () {
        var scene = this;
        scene.loadPrerequisites().then(function () {
            scene.setupPrereqs().then(function () {
                scene.setupScene();
            });
        });
    }
    
    /* Setup things which happen asynchronously, but that must happen before the scene is tenable. */
    /* EG loading shaders via XHR. */
    /* Nowadays, the important stuff can usually be done automatically by setting scene.prerequisites; */
    /* but setupPrereqs can still be useful for anything that doesn't fit neatly into that. */
    /* Default implementation just returns an empty promise which is the bare minimum that this */
    /* method needs to do. */
    /* For examples look at the boilerplate. */
    Scene.prototype.setupPrereqs = function () {
        return new Promise(function (resolve, reject) {
            resolve();
        })
    }
    
    Scene.prototype.bindLightsToShader = function (lights, shader, n) {
        shader.use();
        var nullLight = {position:null, ambient:null, diffuse:null, specular:null};
        var u = shader.uniform;
        lights = lights || [];
        for (var i=0; i<Math.max(lights.length, n||7); i++) { /* TODO need a more elegant approach than n||7 */
            var l = lights[i] || nullLight;
            var uBase = 'lights['+(i+1)+'].';
            this.gl.uniform4fv(u[uBase+'Position'], l.position || [0.0, 0.0, 0.0, 0.0]);
            this.gl.uniform3fv(u[uBase+'Ambient'], l.ambient || [0.0, 0.0, 0.0]);
            this.gl.uniform3fv(u[uBase+'Diffuse'], l.diffuse || [0.0, 0.0, 0.0]);
            this.gl.uniform3fv(u[uBase+'Specular'], l.specular || [0.0, 0.0, 0.0]);
        }
        
    }
    
    /* NB. for reasons I don't understand, the first light position in the shader doesn't work. */
    /* Therefore we use indexes 1-7 rather than 0-7 like you'd expect. */
    Scene.prototype.bindLightToShaderPosition = function (light, shader, lightIndex) {
        shader.use();
        var u = shader.uniform;
        var light = light || {position:null, ambient:null, diffuse:null, specular:null};
        var uBase = 'lights['+(lightIndex||1)+'].';
        this.gl.uniform4fv(u[uBase+'Position'], light.position || [0.0, 0.0, 0.0, 0.0]);
        this.gl.uniform3fv(u[uBase+'Ambient'], light.ambient || [0.0, 0.0, 0.0]);
        this.gl.uniform3fv(u[uBase+'Diffuse'], light.diffuse || [0.0, 0.0, 0.0]);
        this.gl.uniform3fv(u[uBase+'Specular'], light.specular || [0.0, 0.0, 0.0]);
    }
    
    Scene.prototype.updateLighting = function () {
        /* TODO iterate over shaders */
        this.bindLightsToShader(this.lights, this.shaders.ads);
    }
    
    /* Similar to setupPrereqs but contains automation for common tasks. It is called automatically and */
    /* should not be overridden without good reason. If you have special things you need to do then do that in */
    /* setupPrereqs. */
    /* Looks at scene.prerequisites and loads meshes, textures, materials and shaders */
    Scene.prototype.loadPrerequisites = function () {
        var scene = this;
        return new Promise(function (resolve, reject) {
            if (!scene.prerequisites) resolve();
            var prereqs = scene.prerequisites;
            var prereqPromises = [];
            
            if (prereqs.shaders) {
                for (var i=0; i<prereqs.shaders.length; i++) {
                    var myShader = prereqs.shaders[i];
                    prereqPromises.push(new Promise(function (resolve, reject) {
                        scene.addShaderFromUrlPair(myShader.srcVertexShader, myShader.srcFragmentShader, myShader.label, {
                            position: 0,
                            texCoord: 1,
                            vertexNormal: 2
                        })
                        .then(function (shaderInfo) {
                            // console.log('Compiled shader ' + shaderInfo.label);
                            shaderInfo.program.use();
                            // console.log(shaderInfo.program.uniform);
                            var u = shaderInfo.program.uniform;
                            /* Default material */
                            scene.gl.uniform3fv(u['material.Ambient'], [1.0, 1.0, 1.0]);
                            scene.gl.uniform3fv(u['material.Diffuse'], [0.8, 0.8, 0.8]);
                            scene.gl.uniform3fv(u['material.Specular'], [1.0, 1.0, 1.0]);
                            scene.gl.uniform1f(u['material.Shininess'], 0);
                        
                            /* Set up scene lights */
                            for (var i=0; i<scene.lights.length; i++) {
                                var l = scene.lights[i];
                                var uBase = 'lights['+(i+1)+'].';
                                scene.gl.uniform4fv(u[uBase+'Position'], l.position);
                                scene.gl.uniform3fv(u[uBase+'Ambient'], l.ambient || [0.0, 0.0, 0.0]);
                                scene.gl.uniform3fv(u[uBase+'Diffuse'], l.diffuse || [0.0, 0.0, 0.0]);
                                scene.gl.uniform3fv(u[uBase+'Specular'], l.specular || [0.0, 0.0, 0.0]);
                            }
                                                        
                            resolve();
                        })
                    }));
                }
                
            }
            if (prereqs.meshes) {
                var exec = function (src, label) {
                    return new Promise(function(resolve, reject) {
                        if (src.endsWith('.obj')) {
                            FCShapeUtils.loadObj(src) /* TODO change to loadMesh!! */
                            .then(function (mesh) {
                                scene.meshes[label] = mesh;
                                resolve();
                            })
                        };                        
                    }); /* TODO add a reject here */
                }
                for (var i=0; i<prereqs.meshes.length; i++) {
                    var myMesh = prereqs.meshes[i];
                    prereqPromises.push(exec(myMesh.src, myMesh.label));
                }
                
            }
            if (prereqs.colors) {
                for (var i=0; i<prereqs.colors.length; i++) {
                    var myTexColor = prereqs.colors[i];
                    scene.addTextureFromColor(myTexColor, myTexColor.label);
                }
            }
            if (prereqs.textures) {
                for (var i=0; i<prereqs.textures.length; i++) {
                    var myTex = prereqs.textures[i];
                    prereqPromises.push(scene.addTextureFromImage(myTex.src, myTex.label));
                }
            }
            if (prereqs.materials) {
                /* label:, textureSrc:, texture:, textureLabel:, ambient:, diffuse:,
                 specular:, shininess:, shader:, shaderLabel:,  */ 
                for (var i=0; i<prereqs.materials.length; i++) {
                    var matIn = prereqs.materials[i];
                    var matOut = {};
                    if (matIn.textureLabel) matOut.textureLabel = matIn.textureLabel;
                    if (matIn.shaderLabel) matOut.shaderLabel = matIn.shaderLabel;
                    matOut.ambient = matIn.ambient || [0.0, 0.0, 0.0];
                    matOut.diffuse = matIn.diffuse || [0.0, 0.0, 0.0];
                    matOut.specular = matIn.specular || [0.0, 0.0, 0.0];
                    scene.materials[matIn.label] = matOut;
                    /* TODO load tex if texSrc provided */
                    /* TODO determine correct behaviour if tex / shader not given */
                }
            }
            
            Promise.all(prereqPromises).then(function () {
                resolve();
            });
            
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
        
        var objDat = obj.divulge && obj.divulge() || {};
        /* Analyse verts to determine outer bounds of object */
        if (objDat.vertices) {
            var v = objDat.vertices;
            var maxX = null, minX = null, maxY = null, minY = null, maxZ = null, minZ = null;
            for (var i = 0; i < v.length/8; i++) {
                var idx = i*8;
                if (maxX === null || v[idx] > maxX) maxX = v[idx];
                if (minX === null || v[idx] < minX) minX = v[idx];
                if (maxY === null || v[idx+1] > maxY) maxY = v[idx+1];
                if (minY === null || v[idx+1] < minY) minY = v[idx+1];
                if (maxZ === null || v[idx+2] > maxZ) maxZ = v[idx+2];
                if (minZ === null || v[idx+2] < minZ) minZ = v[idx+2];
                obj.bounds = {maxX: maxX, minX: minX, maxY: maxY, minY: minY, maxZ: maxZ, minZ: minZ}; /* TODO you'll need to make this recursive */
            }
        }
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
                    material: thisFace.material || faceAnte.material || obj.material,
                    materialLabel: thisFace.materialLabel || faceAnte.materialLabel || obj.materialLabel,
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
        
        if (obj.mesh) {
            var initMeshBuffers = function (gl, mesh) {
                var mkBuf = function (dat, typ, sz) {
                    var newBuf = gl.createBuffer();
                    newBuf.itemSize = sz;
                    newBuf.numItems = dat.length / sz;
        
                    var bufTyp = (typ == gl.ELEMENT_ARRAY_BUFFER ? Uint32Array : Float32Array);
                    gl.bindBuffer(typ, newBuf);
                    gl.bufferData(typ, new bufTyp(dat), gl.STATIC_DRAW);
                    return newBuf;
                }
                mesh.normalBuffer = mkBuf(mesh.vertexNormals, gl.ARRAY_BUFFER, 3);
                mesh.textureBuffer = mkBuf(mesh.textures, gl.ARRAY_BUFFER, 2);
                mesh.vertexBuffer = mkBuf(mesh.vertices, gl.ARRAY_BUFFER, 3);
                mesh.indexBuffer = mkBuf(mesh.indices, gl.ELEMENT_ARRAY_BUFFER, 1);
            }
            initMeshBuffers(gl, obj.mesh);
            
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
    
    Scene.prototype.makeMeshBuffers = function () {
        
    }
    
    var _renderTemporaryGeometry_MVM = mat4.create();
    Scene.prototype._renderTemporaryGeometry = function (geomCluster, projectionMat, viewMat, pov, renderState) {
        // return;
        /*
        {shader:
        material:
        texture:
        drawMode:
        vertices:
        indices:
        modelMat: 
        }
        */
        var gl = this.gl;
        /* Build buffers out of verts and indices */
        var geom;
        var scene = this;
        var mVM = _renderTemporaryGeometry_MVM;
        // var txu = CARNIVAL.allocTextureUnit();
        // gl.activeTexture(txu);
        gl.activeTexture(gl.TEXTURE0);
        
        while (geomCluster.length) {
            geom = geomCluster.shift();
            window.GEOM = geom;
            var vBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geom.vertices), gl.STATIC_DRAW);
            var iBuf = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(geom.indices), gl.STATIC_DRAW); // TODO try STREAM_DRAW
            var iCount = geom.indices.length;
            var shader = scene.shaders.basic;
            var u = shader.uniform;
            var a = shader.attrib;
            var tex = scene.textures.cyan;
            gl.bindTexture(gl.TEXTURE_2D, tex);
            shader.use();
            gl.uniformMatrix4fv(u.projectionMat, false, projectionMat);
            mat4.mul(mVM, viewMat, geom.modelMat);
            gl.uniformMatrix4fv(u.modelViewMat, false, mVM);
            
            // gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
            // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);

            gl.enableVertexAttribArray(a.position);
            gl.enableVertexAttribArray(a.texCoord);
            gl.enableVertexAttribArray(a.vertexNormal);
        
            gl.vertexAttribPointer(a.position, 3, gl.FLOAT, false, 32, 0);
            gl.vertexAttribPointer(a.texCoord, 2, gl.FLOAT, false, 32, 12);
            gl.vertexAttribPointer(a.vertexNormal, 3, gl.FLOAT, false, 32, 20);
        
            // gl.uniform1i(shader.diffuse, txu-gl.TEXTURE0);
            gl.uniform1i(shader.diffuse, 0);
        
    
            // gl.drawElements(gl.TRIANGLES, sO.idxCount, gl.UNSIGNED_SHORT, 0);
            // console.log(iCount);
            gl.drawElements(geom.drawMode, iCount, gl.UNSIGNED_INT, 0);
            
        }
        // CARNIVAL.releaseTextureUnit(txu);
        
    }
    
    Scene.prototype._renderObjectFace = function (sO, projectionMat, modelViewMat, pov, renderState) {
        var scene = this;
        var gl = this.gl;
        var shader = null;
        var material = null;
        // if (sO.debug) {
        //     console.log(sO.debug);
        // }
        /* Check for a textureloader attached to object. This is a function which will create a texture */
        /* Space them out by 100ms */
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
        
        // console.log(sO.materialLabel);
        if (sO.material || sO.materialLabel) {
            // console.log('awef');
            material = sO.material || scene.materials[sO.materialLabel];
            // console.log(material);
            
        }
        
        var myTex = null;
        if (pov == 'left_eye' && sO.leftEyeTexture) myTex = sO.leftEyeTexture;
        else if (pov == 'right_eye' && sO.rightEyeTexture) myTex = sO.rightEyeTexture;
        else if (sO.texture) myTex = sO.texture;
        else if (sO.textureLabel) myTex = scene.textures[sO.textureLabel];
        else if (material && material.texture) myTex = material.texture;
        else if (material && material.textureLabel) myTex = scene.textures[material.textureLabel];
        // else if (sO.params.texture) myTex = scene.textures[sO.params.texture];
        // else myTex = scene.texture; // TODO do better
        else return; /* Skip untextured objects */
        gl.bindTexture(gl.TEXTURE_2D, myTex);
        
        /* TODO shaderLabel takes precedence. WHY? */
        if (sO.shaderLabel) shader = scene.shaders[sO.shaderLabel];
        else if (sO.shader) shader = sO.shader;
        else if (sO.params && sO.params.shader) shader = scene.shaders[sO.params.shader]; /* TODO what is this even for */
        else if (material && material.shader) shader = material.shader;
        else if (material && material.shaderLabel) shader = scene.shaders[material.shaderLabel];
        else if (scene.defaultShader) shader = scene.defaultShader;
        else if (scene.defaultShaderLabel) shader = scene.shaders[scene.defaultShaderLabel];
        // else shader = scene.defaultShader;
        else shader = scene.program; /* TODO change */
        // shader = this.program; /* TODO change */
        if (shader) shader.use();
        else return; /* Can't draw much without a shader! */
        
        if (material) {
            var u = shader.uniform;
            gl.uniform3fv(u['material.Ambient'], material.ambient);
            gl.uniform3fv(u['material.Diffuse'], material.diffuse);
            gl.uniform3fv(u['material.Specular'], material.specular);
            gl.uniform1f(u['material.Shininess'], material.shininess);
        }
        
        gl.uniformMatrix4fv(shader.uniform.projectionMat, false, projectionMat);
        // gl.uniformMatrix4fv(shader.uniform.modelViewMat, false, modelViewMat);
        
        var modelMat = sO.transformationMatrix && sO.transformationMatrix() || sO.parent.transformationMatrix();
        // console.debug(modelMat);
        var mVM = mat4.create();
        mat4.mul(mVM, modelViewMat, modelMat);
        // console.debug(modelMat);
        gl.uniformMatrix4fv(shader.uniform.modelMat, false, modelMat);
        gl.uniformMatrix4fv(shader.uniform.modelViewMat, false, mVM);
        
        /* If the normal matrix is scaled, it messes with the lighting calculations, so we need to  */
        /* apply the inverse of any scaling that has happened */
        var normalMat = mat4.clone(modelMat);
        var vecScale = 1/(sO.scaleFactor||1);
        mat4.scale(normalMat, normalMat, [vecScale, vecScale, vecScale]);
                
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
            
            
            ////
            if (mesh.textureBuffer.numItems) {
                gl.bindBuffer(gl.ARRAY_BUFFER, mesh.textureBuffer);
                gl.vertexAttribPointer(shader.attrib.texCoord, mesh.textureBuffer.itemSize, gl.FLOAT, false, 0, 0);
                gl.enableVertexAttribArray(shader.attrib.texCoord);
                
            }
            else {
                gl.disableVertexAttribArray(shader.attrib.texCoord);
            }
            ////
            

            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
            gl.vertexAttribPointer(shader.attrib.vertexNormal, mesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
            
            
            gl.enableVertexAttribArray(shader.attrib.position);
            gl.enableVertexAttribArray(shader.attrib.vertexNormal);
            
            // console.log(shader.attrib.texCoord);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
            // gl.drawElements(gl.TRIANGLES, mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
            var num = Math.min(mesh.indexBuffer.numItems, window.MESHLIMIT || Infinity);
            // num = Math.min(num, 65500);
            // gl.drawElements(gl.TRIANGLES, num, gl.UNSIGNED_SHORT, 0);
            gl.drawElements((sO.drawMode === null && gl.TRIANGLES) || sO.drawMode, num, gl.UNSIGNED_INT, 0); //<< huh
            
            
            
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
            gl.drawElements((sO.drawMode === null && gl.TRIANGLES) || sO.drawMode, sO.idxCount, gl.UNSIGNED_INT, 0);
        }
    }
    
    
    Scene.prototype.render = function (projectionMat, viewMat, pov) {
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
                if (window.vrDisplay.stageParameters && gPose.orientation && gPose.position) {
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
        
        var canRender = function (o) {
            return (!(o.hidden || o.invisible) && (o.idxBuffer && o.vertBuffer || o.mesh));
        }
        
        /* Consider moving this to the prototype? */
        var consumeGraphObject = function (parentObj, childObj) {
            /* generate child matrix from combination of parent matrix and translation/rotation of child, then call self on child's children */
            var childMatrix = null; // parent matrix % child translate+rotate
            
            childObj.inheritedMatrix = parentObj && (parentObj.matrix || parentObj.injectedMatrix) || childObj.injectedMatrix || mat4.create();
            childObj.matrix = childObj.transformationMatrix(true); /* This applies the child's rotation and translation on top of the inherited */
            var children = childObj.getChildren && childObj.getChildren() || [];
            for (var i=0; i<children.length; i++) {
                consumeGraphObject(childObj, children[i]);
            }
            // if (!(childObj.hidden || childObj.invisible) && (childObj.idxBuffer && childObj.vertBuffer || childObj.mesh)) scene._renderObjectFace(childObj, projectionMat, modelViewMat, pov, renderState);
            if (childObj._temporaryGeometry) scene._renderTemporaryGeometry(childObj._temporaryGeometry, projectionMat, viewMat, pov, renderState);
            if (canRender(childObj)) scene._renderObjectFace(childObj, projectionMat, viewMat, pov, renderState);
        }
        
        /* scene.sceneGraph is the root of the tree */
        if (scene.sceneGraph) {
            consumeGraphObject(null, scene.sceneGraph);
            
        }
        
        for (var i=0; i<scene.sceneObjects.length; i++) {
            var scene = this;
            var sO = scene.sceneObjects[i];
            if (!sO.isRenderable && sO.drawable) sO = sO.drawable; /* Something not directly renderable (eg a component) may contain something renderable */
            if (!sO.isRenderable) continue;
            // var sObj = sO;
            var shader = null;
            if (sO.advanceSimulation) sO.advanceSimulation(Date.now()); /* TODO we need to make advanceSimulation recursive but we also need to 
                make it happen outside the render loop so let's defer that */
            /* TODO do components need to be able to accept injected matrices? probably */
            
            if (sO.drawable) {
                if (sO.drawable.advanceSimulation) sO.drawable.advanceSimulation(Date.now());
                consumeGraphObject(sO, sO.drawable);
            }
            if (sO.getChildren) {
                consumeGraphObject(null, sO);
            }
            // else if (sO.hidden || sO.invisible) continue;
            else if (!canRender(sO)) continue;
            else if ((sO.idxBuffer && sO.vertBuffer) || sO.mesh) {
                scene._renderObjectFace(sO, projectionMat, viewMat, pov, renderState);
            }
            var faceKeys = Object.keys(sO.faces);
            if (faceKeys.length) {
                var c = faceKeys.length;
                for (var j=0; j<c; j++) {
                    var myKey = faceKeys[j];
                    scene._renderObjectFace(sO.faces[myKey], projectionMat, viewMat, pov, renderState);
                }
            }
            scene.timeSinceLastTextureLoad = renderState.timeSinceLastTextureLoad;
        }
        
    };
        
    return Scene;
        
})();
