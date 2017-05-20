/* This is in a transitional phase. Eventually this file will contain all the things needed to make Carnival work. */
/* However .. it doesn't, yet. However it does bind them together in a somewhat coherent unit. */

/* TODO implement changes from the standard */
/* TODO tune motion-to-photon loop */
/* TODO tutorial component */
/* TODO perf display component */
/* TODO imageboard component */
/* TODO debugger. detect too-small scale factor, missing shader / material / texture, ... */
/* TODO consider not having both scale and scaleFactor be reserved words? */


/* TODO there must be a more straightforward way to do image -> tex */

/* Components need -
    - multiple components per file
    - show() and hide()
    - equivalent for loadprereqs - basically like a scene's setup procedure
    - caching
    - component catalogs
    - more elegant way to address components - CARNIVAL.component('name')
    - load as
    - components as prereqs (should work anyway)
    - 

    C.component.load(...)
    
    
    
Carnival framework itself - 
- should move things like shader loading into here
- change locations of things eg. mesh loading
- clusterize and compile with grunt? minify?
*/

/* This code (or something like it) will become part of (or a wrapper for) the framework. */

/* 
Carnival Framework.
@author Alan Rowarth
@version 0.19
@license MIT

This contains code from
Three.js
Brandon Jones
.. obj loader guy
*/

/* pattern is for subclass to call this with (params, drawableClass)? */
/* TODO any drawables that don't support the "standard" pos,size,ori,params constructor can get fuc^H^H^Hsidegraded */
/* TODO review standardisation of size */
/* TODO centering? size.centerOn? */
/* TODO automatic bounds analysis... should be easy to do and massively useful */
/* component
    .serialize
    .info
    .prerequisites
    .dependencies
    .prepare
    .addChild / .removeChild
*/
window.FCComponent = (function () {
    var Component = function (params, drawableClass) {
        var p = params || {draw:{}};
        this.label = p.label || null;
        this.physicsParams = p.physics || {};
        this.configParams = p.config || {};
        this.inputParams = p.input || {};
        let myBehaviors = p.behaviors || [];
        
        /* This doesn't prevent serialization, rather is a hint to a mass serializer to skip this */
        this.shouldSerialize = this.configParams.shouldSerialize || false; 
        
        var d = p.draw || {};
        this.drawParams = {
            materialLabel: d.materialLabel || 'matteplastic',
            textureLabel: d.textureLabel || null,
            texture: d.texture || (d.color && CARNIVAL.color(d.color).asTexture()) || null,
            shaderLabel: d.shaderLabel || null,
            position: d.position || {x:0, y:1, z:0},
            orientation: d.orientation || {x:0, y:0, z:0},
            rotationQuaternion: d.rotationQuaternion || null,
            size: this._explicitSize || { /* In some situations the defaults may clash with each other, in which case give an _explicitSize in the subclass */
                width: d.size && d.size.width || 1,
                height: d.size && d.size.height || 1,
                depth: d.size && d.size.depth || 1,
                scale: d.size && d.size.scale || 1
            }
        }
        var dp = this.drawParams;
        // if (!(dp.texture || dp.textureLabel)) dp.texture = CARNIVAL.colors.white.asTexture();
        if (drawableClass) {
            this.drawable = new drawableClass(dp.position, dp.size, dp.orientation, {
                materialLabel:dp.materialLabel, textureLabel:dp.textureLabel, texture:dp.texture, shaderLabel:dp.shaderLabel, rotationQuaternion:dp.rotationQuaternion
            });
            myBehaviors.forEach(b => this.addBehavior(b));
        }
        
        
    }
    
    Component.prototype.addBehavior = function (...args) {
        this.drawable.addBehavior(...args);
    }
    
    Component.prototype.removeBehavior = function (label) {
        this.drawable.removeBehavior(label);
    }
    
    Component.prototype.prepare = function () {
        var component = this;
        return new Promise(function (resolve, reject) {
            resolve(component);
        })
    }
    
    Component.prototype.serialize = function () {
        var component = this;
        var mat = component.transformationMatrix && component.transformationMatrix() 
                || component.drawable.transformationMatrix && component.drawable.transformationMatrix();
    
        var getPos = function () {
            var trans = vec3.create();
            mat4.getTranslation(trans, mat);
            return {x:trans[0], y:trans[1], z:trans[2]};
            // return component.position; /* This should extract trans and rot from the transform matrix */
        }
        var getRot = function () {
            var rot = quat.create();
            mat4.getRotation(rot, mat);
            return rot;
            // return component.orientation;
        }
    
        return {
            component: component.meta.ident,
            label: component.label,
            draw: {
                position: getPos(),
                rotationQuaternion: getRot(),
                materialLabel: component.drawParams.materialLabel,
                textureLabel: component.drawParams.textureLabel,
                size: component.drawParams.size
            },
            config: component.configParams,
            input: component.inputParams,
            physics: component.physicsParams
        }
    }
    
    Component.prototype.showBounds = function (state) {
        var comp = this;
        if (state == false && comp.drawable.behaviors.showingBounds) {
            comp.drawable.removeBehavior('showingBounds');
            comp._tempgeom_bounds = null;
        }
        else if (state == true && comp.drawable.bounds) {
            
            var gl = CARNIVAL.engine.gl;
        
            var b = comp.drawable.bounds;
            //----
            var min = {x:b.minX, y:b.minY, z:b.minZ};
            var max = {x:b.maxX, y:b.maxY, z:b.maxZ};
            
            var vv = [], ii = [], ci = 0;
            var line = function (a,b) {
                vv = vv.concat([a[0],a[1],a[2], 0,0,0,0,0]); ii.push(ci++);
                vv = vv.concat([b[0],b[1],b[2], 0,0,0,0,0]); ii.push(ci++);
            }
            var A=[min.x, min.y, min.z], B=[min.x, min.y, max.z], C=[min.x, max.y, min.z], D=[min.x, max.y, max.z];
            var E=[max.x, min.y, min.z], F=[max.x, min.y, max.z], G=[max.x, max.y, min.z], H=[max.x, max.y, max.z];
            // line(tMin.x, tMin.y, tMin.z, tMax.x, tMax.y, tMax.z);
            // line(tMin.x, tMax.y, tMin.z, tMax.x, tMax.y, tMax.z);
            line(A,E); line(E,F); line(F,B); line(B,A);
            line(C,G); line(G,H); line(H,D); line(D,C); 
            line(A,C); line(B,D); line(E,G); line(F,H); 
            line(E,C); line(G,A);
            line(H,B); line(F,D);
            //----
    
            this._tempgeom_bounds = {
                vertices: vv,
                indices: ii
            };
            
            this.drawable.addBehavior(function (d,t){
                d._temporaryGeometry.push({
                    drawMode: gl.LINES,
                    indices: comp._tempgeom_bounds.indices,
                    vertices: comp._tempgeom_bounds.vertices,
                    modelMat: d.transformationMatrix()
                });
                
            }, 'showingBounds')
        }
        else if (state == true) {
            console.log('No bounds found for object', this.prototype);
        }
        
    }
    
    return Component;
})();


window.FCComponentLibrary = (function () {
    var ComponentLibrary = function (path) {
        this.path = path;
        this.components = {};
    }
    
    ComponentLibrary.prototype.load = function (componentFQName, loadAsName) {
        let library = this;
        let compPath = componentFQName.replace(/\./g, '/');
        let compSrc = `${library.path}/${compPath}/component.js`;
        return new Promise(function (resolve, reject) {
            CARNIVAL.loadComponent(componentFQName, compSrc, loadAsName)
            .then(function (compClass) {
                library.components[loadAsName] = compClass;
                resolve(compClass);
            });
        });
    }
    
    ComponentLibrary.prototype.componentClass = function (loadedAsName) {
        return this.components[loadedAsName];
    }
    
    ComponentLibrary.prototype.new = function (loadedAsName) {
        return (...params) => new this.components[loadedAsName](...params);
    }
    
    return ComponentLibrary;
    
})();

window.FCColor = (function () {
    
    var Color = function (hexCode) {
        this.hexCode = hexCode;
        this._texture = null;
    }
    
    Color.prototype.asDecimal = function () {
        
    }
    
    Color.prototype.asTexture = function () {
        if (!this._texture) {
            this._texture = CARNIVAL.texture.fromColor({hex:this.hexCode}, null, null);
        }
        return this._texture;
    }
    
    return Color;
})();



window.CARNIVAL = (function () {
    
    var TODOfn = function () {};
    
    var Framework = function () {
        var framework = this;
        this.components = {};
        // this.ComponentLibrary = FCComponentLibrary;
        this._componentPromises = {};
        this._componentResolvers = {};
        this._componentMeta = {};
        this._postRenderTasks = []; /* Things to be done after a frame is presented. An array of functions that is cleared after use */
        this._postRenderTasksVeto = false;
        this._cameraLocked = true;
        this._cameraLockPose = {
            position: vec3.create(),
            orientation: quat.create()
        };
        this._startTime = new Date().getTime();
        this._perfContext = null;
        this._perfReports = {};
        this._perfRecords = {};
        this._perfRecordsPtr = 0;
        this._perfRecordsCount = 100;
        
        this.core = {
            util: FCUtil,
            basicshapes: FCBasicShapes,
            meshtools: FCMeshTools,
            primitives: FCPrimitives,
            primitiveutils: FCPrimitiveUtils,
            feedtools: FCFeedTools,
            scene: FCScene,
            shapeutils: FCShapeUtils,
            shapes: FCShapes
        }
        
        this.scenes = [];
        
        this.isRendering = false;
        
        this.canvas = null;
        this.engine = null;
        
        
        /* These are libraries for specific primal elements of Carnival. */
        /* Several of these are used to cause things to exist - the plural forms of these names are used for storing these.
        eg, framework.shader.load() can load a shader into framework.shaders
        */
        this.shader = {
            
        };
        this.shaders = {};
        
        this.texture = {
            fromColor: function (values, label, params) {return framework.addTextureFromColor(values, label, params)},
            fromImage: function (src, label) {return framework.textureFromImage2(src, label)},
            fromCanvas: TODOfn
        };
        this.textures = {};
        
        this.mesh = {
            analyse: FCMeshTools.analyseMesh,
            shunt: FCMeshTools.shuntMesh,
            turn: FCMeshTools.turnMesh,
            synthesizeNormals: FCMeshTools.synthesizeNormals,
            load: FCShapeUtils.loadMesh,
            Mesh: FCShapes.MeshShape,
            Mesh2: FCShapes.MeshShape2,
        };
        this.meshes = {};
        
        this.material = {
        };
        this.materials = {};
        
        this.component = {
            load: TODOfn,
            register: TODOfn,
            Component: FCComponent,
            ComponentLibrary: FCComponentLibrary
            
        };
        this.components = {};
        
        this.scene = {
            load: TODOfn,
            Scene: FCScene
        };
        // this.scenes = {};
        
        this.app = {
            
        };
        this.apps = {};
        
        this.hardware = {
            controller: {
                getMotionControllers: FCUtil.getVRGamepads,
                makeTracker: FCUtil.makeGamepadTracker,
                makeRayProjector: FCUtil.makeControllerRayProjector
            }
        };

        this.primitive = {
            Mesh: FCShapes.MeshShape,
            Container: FCPrimitives.Container,
            Poly: FCPrimitives.Poly
        };

        this.shape = {
            LatheExtruder: FCShapes.LatheExtruderShape,
            Cuboid: FCShapes.SimpleCuboid,
            Rectangle: FCShapes.WallShape,
            SegmentedRectangle: FCShapes.WallShape2
        };

        // this.engine = {
        //
        // }
        this.util = {
            PlanarCollider: FCUtil.PlanarCollider
        };
        this.network = {
            
        };
        
        // this.color = FCColor;
        this.color = function (designator) {
            if (designator.startsWith('#')) {
                return new FCColor(designator);
            }
            else {
                return this.colors[designator];
            }
        }
        this.colors = {};
        [['indigo', '#4b0082'], ['gold', '#ffd700'], ['hotpink', '#ff69b4'], ['firebrick', '#b22222'], ['lightseagreen', '#20b2aa'], ['yellow', '#ffff00'], ['mistyrose', '#ffe4e1'], ['darkolivegreen', '#556b2f'], ['darkseagreen', '#8fbc8f'], ['pink', '#ffc0cb'], ['lightcoral', '#f08080'], ['orangered', '#ff4500'], ['navajowhite', '#ffdead'], ['lime', '#00ff00'], ['palegreen', '#98fb98'], ['greenyellow', '#adff2f'], ['burlywood', '#deb887'], ['seashell', '#fff5ee'], ['mediumspringgreen', '#00fa9a'], ['fuchsia', '#ff00ff'], ['papayawhip', '#ffefd5'], ['blanchedalmond', '#ffebcd'], ['chartreuse', '#7fff00'], ['dimgray', '#696969'], ['black', '#000000'], ['peachpuff', '#ffdab9'], ['springgreen', '#00ff7f'], ['aquamarine', '#7fffd4'], ['white', '#ffffff'], ['orange', '#ffa500'], ['lightsalmon', '#ffa07a'], ['darkslategray', '#2f4f4f'], ['brown', '#a52a2a'], ['ivory', '#fffff0'], ['dodgerblue', '#1e90ff'], ['peru', '#cd853f'], ['lawngreen', '#7cfc00'], ['chocolate', '#d2691e'], ['crimson', '#dc143c'], ['forestgreen', '#228b22'], ['slateblue', '#6a5acd'], ['olive', '#808000'], ['cyan', '#00ffff'], ['mintcream', '#f5fffa'], ['silver', '#c0c0c0'], ['antiquewhite', '#faebd7'], ['mediumorchid', '#ba55d3'], ['skyblue', '#87ceeb'], ['gray', '#808080'], ['darkturquoise', '#00ced1'], ['goldenrod', '#daa520'], ['darkgreen', '#006400'], ['floralwhite', '#fffaf0'], ['darkviolet', '#9400d3'], ['darkgray', '#a9a9a9'], ['moccasin', '#ffe4b5'], ['saddlebrown', '#8b4513'], ['darkslateblue', '#483d8b'], ['lightskyblue', '#87cefa'], ['lightpink', '#ffb6c1'], ['mediumvioletred', '#c71585'], ['red', '#ff0000'], ['deeppink', '#ff1493'], ['limegreen', '#32cd32'], ['darkmagenta', '#8b008b'], ['palegoldenrod', '#eee8aa'], ['plum', '#dda0dd'], ['turquoise', '#40e0d0'], ['lightgrey', '#d3d3d3'], ['lightgoldenrodyellow', '#fafad2'], ['darkgoldenrod', '#b8860b'], ['lavender', '#e6e6fa'], ['maroon', '#800000'], ['yellowgreen', '#9acd32'], ['sandybrown', '#f4a460'], ['thistle', '#d8bfd8'], ['violet', '#ee82ee'], ['navy', '#000080'], ['magenta', '#ff00ff'], ['tan', '#d2b48c'], ['rosybrown', '#bc8f8f'], ['olivedrab', '#6b8e23'], ['blue', '#0000ff'], ['lightblue', '#add8e6'], ['ghostwhite', '#f8f8ff'], ['honeydew', '#f0fff0'], ['cornflowerblue', '#6495ed'], ['linen', '#faf0e6'], ['darkblue', '#00008b'], ['powderblue', '#b0e0e6'], ['seagreen', '#2e8b57'], ['darkkhaki', '#bdb76b'], ['indianred ', '#cd5c5c'], ['snow', '#fffafa'], ['sienna', '#a0522d'], ['mediumblue', '#0000cd'], ['royalblue', '#4169e1'], ['lightcyan', '#e0ffff'], ['green', '#008000'], ['mediumpurple', '#9370d8'], ['midnightblue', '#191970'], ['cornsilk', '#fff8dc'], ['paleturquoise', '#afeeee'], ['bisque', '#ffe4c4'], ['slategray', '#708090'], ['darkcyan', '#008b8b'], ['khaki', '#f0e68c'], ['wheat', '#f5deb3'], ['teal', '#008080'], ['darkorchid', '#9932cc'], ['salmon', '#fa8072'], ['deepskyblue', '#00bfff'], ['rebeccapurple', '#663399'], ['darkred', '#8b0000'], ['steelblue', '#4682b4'], ['palevioletred', '#d87093'], ['lightslategray', '#778899'], ['aliceblue', '#f0f8ff'], ['lightgreen', '#90ee90'], ['orchid', '#da70d6'], ['gainsboro', '#dcdcdc'], ['mediumseagreen', '#3cb371'], ['tomato', '#ff6347'], ['mediumturquoise', '#48d1cc'], ['lemonchiffon', '#fffacd'], ['cadetblue', '#5f9ea0'], ['lightyellow', '#ffffe0'], ['lavenderblush', '#fff0f5'], ['coral', '#ff7f50'], ['purple', '#800080'], ['aqua', '#00ffff'], ['whitesmoke', '#f5f5f5'], ['mediumslateblue', '#7b68ee'], ['darkorange', '#ff8c00'], ['mediumaquamarine', '#66cdaa'], ['darksalmon', '#e9967a'], ['beige', '#f5f5dc'], ['blueviolet', '#8a2be2'], ['azure', '#f0ffff'], ['lightsteelblue', '#b0c4de'], ['oldlace', '#fdf5e6']]
        .forEach(s => this.colors[s[0]] = new FCColor(s[1]));
        
        
        // console.log('instanciating');
    }
    
    Framework.prototype.initVR = function () {
        
        this.engine.vrDisplay.requestPresent([{ source: this.engine.canvas, leftBounds:viewports.leftEye.headsetBounds, rightBounds:viewports.rightEye.headsetBounds }]);
        /* Check gamepads for pose */
        var gamepads = this.core.util.getVRGamepads(true);
        var poseMissing = false;
        for (var i = 0; i < gamepads.length; i++) {
        poseMissing = poseMissing || (gamepads[i].pose === undefined);
        }
        if (poseMissing) {
        error('Gamepads were detected but are not reporting a pose. You probably need to enable Gamepad Extensions in about:flags . <a style="color:green;" href="http://meta4vr.net/setup/" target="_top">Click here for the solution</a>');
        }
        
    }

    Framework.prototype.addScene = function (newScene, label) {
        this.scenes.push({scene:newScene, label:label});
    }
    
    Framework.prototype.attachTo = function (canvasElement) {
        this.canvas = canvasElement;
    };
    
    Framework.prototype.setPerfContext = function (key) {
        this._perfContext = key;
        if (!this._perfReports[key]) this._perfReports[key] = {};
    }
    /* State is STARTED or ENDED */
    Framework.prototype.reportTimeMeasurement = function (categoryKey, itemKey, state) {
        var ct = this._perfReports[this._perfContext];
        if (!ct[categoryKey]) {
            ct[categoryKey] = {};
        }
        var pr = ct[categoryKey];
        var t = new Date().getTime() - this._startTime;
        pr[itemKey+'__'+state] = t;
        if (state == 'ended' && pr[itemKey+'__started']) {
            var duration = Math.abs(t - pr[itemKey+'__started']);
            pr[itemKey+'__duration'] = duration;
            var kk = this._perfContext + '__' + categoryKey + '__' + itemKey;
            var prec = this._perfRecords;
            if (!prec[kk]) prec[kk] = new Array(this._perfRecordsCount);
            prec[kk][this._perfRecordsPtr] = duration;
        }
    }
    Framework.prototype.reportTimeMeasurement = function (){};
    
    Framework.prototype.setCameraLockPose = function (pose) {
        this._cameraLockPose = {
            position: [pose.position[0], pose.position[1], pose.position[2]],
            orientation: [pose.orientation[0], pose.orientation[1], pose.orientation[2], pose.orientation[3]]
        };
    };
    
    Framework.prototype.setCameraParams = function (params) {
        var setVal = function (key, val) {
            document.getElementById('camera'+key).value = val;
        }
        setVal('UpDegrees', params.fov.up);
        setVal('DownDegrees', params.fov.down);
        setVal('LeftDegrees', params.fov.left);
        setVal('RightDegrees', params.fov.right);
        
        setVal('TranslateX', params.translate.x);
        setVal('TranslateY', params.translate.y);
        setVal('TranslateZ', params.translate.z);
        
        setVal('TiltX', params.tilt.x);
        setVal('TiltY', params.tilt.y);
        setVal('TiltZ', params.tilt.z);
        
    }
    


    var dummy = function () {};
    
    Framework.prototype.showScene = dummy;
    Framework.prototype.startScene = dummy;
    // Framework.prototype.start = dummy;
    // Framework.prototype.initVR = dummy; /* engine.setActiveViewports(['leftEye', 'rightEye', 'cam1']) */
    
    
    Framework.prototype.loadComponent = function (ident, url, label) {
        /* component will need to call CARNIVAL.registerComponent($ident, class) or something when it loads */
        /* ident eg net.meta4vr.vrcomponent.selectgrid */
        var framework = this;
        var loader = document.createElement('script');
        loader.src = url;
        console.log('Loading component from', url);
        framework._componentMeta[ident] = {label:label};
        var p = new Promise(function (resolve, reject) {
            framework._componentResolvers[ident] = resolve;
        });
        framework._componentPromises[ident] = p;
        document.head.appendChild(loader);
        return p;
        
    };
    
    Framework.prototype.registerComponent = function (componentIdent, klass) {
        var framework = this;
        console.log('registering component', componentIdent);
		// try {
		//
		// }
        var myMeta = framework._componentMeta[componentIdent];
        var cLabel = myMeta.label || componentIdent;
        framework.components[cLabel] = klass;
        framework.components[componentIdent] = klass; /* TODO potential duplication, does it matter? */
        var reqPromises = [];
        if (klass.prototype._requisites) {
            console.log('Requisistes:', klass.prototype._requisites);
            var requi = klass.prototype._requisites;
            for (var i = 0; i < requi.meshes.length; i++) {
                var meshInf = requi.meshes[i];
                reqPromises.push(
                    (function (inf) {return new Promise(function (resolve, reject) {
                        CARNIVAL.mesh.load(inf.src).then(function (mesh) {resolve({label:inf.label, mesh:mesh});})
                    })})(meshInf)
                );
            }
        }
        Promise.all(reqPromises).then(function (things) {
            var res = {};
            for (var i = 0; i < things.length; i++) {
                var thisThing = things[i];
                res[thisThing.label] = thisThing;
            }
            klass.prototype.resources = res;
            var resolver = framework._componentResolvers[componentIdent];
            if (resolver && resolver.call) resolver(klass);
        });
    };
    
    Framework.prototype.allocTextureUnit = function () {
        return this.engine._textureUnits.shift();
    }
    
    Framework.prototype.releaseTextureUnit = function (u) {
        this.engine._textureUnits.push(u);
    }
    
    Framework.prototype.addTextureFromCanvas = function (canvas, label, params) {
        var idx = 1; /* TODO */
        var gl = this.engine.gl;
        var txU = this.allocTextureUnit();
        gl.activeTexture(txU);
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); /* TODO */
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // gl.activeTexture(gl.TEXTURE0);
        this.releaseTextureUnit(txU);
        // gl.uniform1i()
        if (label) this.textures[label] = texture;
        return texture;
        
    }
    
    Framework.prototype.addTextureFromColor = function (values, label, params) {
        /* values is passed in either as {hex: '#rrggbbaa'} or {r:1.0, g:1.0, b:1.0, a:1.0} */
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
    
    Framework.prototype.textureFromImage2 = function (src, label) {
        var framework = this;
        var loadImg = function (src, label) {
            return new Promise(function (resolve, reject) {
                var im = document.createElement('img');
                im.crossOrigin = 'anonymous';
                im.onload = function () {
                    var gl = framework.engine.gl;
                    var tex = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
                    if (label) framework.textures[label] = tex;
                    resolve({texture:tex, width:im.width, height:im.height});
                };
                im.src = src;
            });
        };
        return loadImg(src, label);
        
    }
    
    /* This converts NPOT textures to NPOT via canvas, which has a performance cost. */
    Framework.prototype.textureFromImage = function (src, label) {
        var framework = this;
        var loadImg = function (src, label) {
            return new Promise(function (resolve, reject) {
                var im = document.createElement('img');
                im.crossOrigin = 'anonymous';
                im.onload = function () {
                    console.log(im.width, im.height);
                    // var s = 2048;
                    var s = Math.pow(2, Math.floor(Math.log2(Math.min(im.width, im.height))));
                    console.log('s = ',s);
                    var w = im.width;
                    var h = im.height;
                    var cnv = document.createElement('canvas');
                    cnv.width = im.width;
                    cnv.height = im.height;
                    var c2x = cnv.getContext('2d');
                    // c2x.drawImage(im, 0, 0, s, s);
                    // c2x.beginPath();
                    // c2x.rect(10, 10, 100, 100);
                    // c2x.fillStyle = 'blue';
                    // c2x.fill();
                    // scene.addTextureFromCanvas(cnv, label);
                    // document.body.appendChild(cnv);
                    c2x.drawImage(im, 0, 0, s, s);
                    var encaps = {
                        pixels: c2x.getImageData(0, 0, s, s),
                        label: label
                    }
                    // var tex = scene.addEncapsulatedTexture(encaps);
                    
                    var gl = framework.engine.gl;
                    var txU = framework.allocTextureUnit()
                    gl.activeTexture(txU);
                    var texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, encaps.pixels);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); /* TODO */
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    // gl.activeTexture(gl.TEXTURE0);
                    // gl.uniform1i()
                    framework.releaseTextureUnit(txU);
                    if (encaps.label) framework.textures[encaps.label] = texture;
                    
                    
                    
                    resolve({texture:texture, width:im.width, height:im.height});
                }
                im.src = src;
            });
        }
        return loadImg(src, label);
        
    }
    
    
    /* ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- */

    var PLAYER_HEIGHT = 1.82; //?

    var vrDisplay = null;
    var vrComponents = {display:null};
    var projectionMat = mat4.create();
    var viewMat = mat4.create();
    var poseMat = mat4.create();
    var standingPosition = vec3.create();
    var orientation = [0, 0, 0];
    var position = [0, 0, 0];
    var vrPresentButton = null;

    var ROTY = 0;


    var webglCanvas = null;
    var gl = null;
    var _scene = null;
    
    // var _cameraLockPose = null;
    
    Framework.prototype.start = function () {
        "use strict";
        
        var framework = this;
        framework.engine = new Engine(framework.canvas, viewports);
        framework.engine._scene = framework.scenes[0].scene; // <<< getting warmer but still TODO 
        
        if (framework.engine.vrDisplay) {
            /* move the stuff below up to here & parts of it into Engine */
        }

        /* Haptics actuators seem to operate all the way down to 0.00026 but aren't very noticeable at that level. */
        
        // var presentingMessage = document.getElementById("presenting-message"); //

        var FC_SCENE_MISSING=null;

        if (navigator.getVRDisplays) {
          navigator.getVRDisplays().then(function (displays) {
            if (displays.length > 0) {
              vrDisplay = displays[0];
              window.vrDisplay = vrDisplay; /* TODO find a nicer way */
              vrComponents.display = vrDisplay;
      
              framework.engine.initWebGL(true, vrDisplay.stageParameters);
      
              // if (vrDisplay.stageParameters &&
              //     vrDisplay.stageParameters.sizeX > 0 &&
              //     vrDisplay.stageParameters.sizeZ > 0) {
              //         scene.
              //     }
      
              // VRSamplesUtil.addButton("Reset Pose", "R", null, function () { vrDisplay.resetPose(); });

              // Generally, you want to wait until VR support is confirmed and
              // you know the user has a VRDisplay capable of presenting connected
              // before adding UI that advertises VR features.
              if (vrDisplay.capabilities.canPresent) {}
                // vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "../cardboard64.png", onVRRequestPresent);

              // The UA may kick us out of VR present mode for any reason, so to
              // ensure we always know when we begin/end presenting we need to
              // listen for vrdisplaypresentchange events.
              // window.addEventListener('vrdisplaypresentchange', onVRPresentChange, false);
              window.addEventListener('vrdisplaypresentchange', function () {framework.engine.handleVRPresentChange();}, false);
      
              /* Bounds are [leftOffset, topOffset, width, height] */
              /* This could be useful for multiplexing, eg if we want to have cameras */
              // window.START_VR = function () {
              //     // vrDisplay.requestPresent([{ source: webglCanvas, leftBounds:viewports.leftEye.headsetBounds, rightBounds:viewports.rightEye.headsetBounds }]);
              //     vrDisplay.requestPresent([{ source: framework.engine.canvas, leftBounds:viewports.leftEye.headsetBounds, rightBounds:viewports.rightEye.headsetBounds }]);
              //     /* Check gamepads for pose */
              //     var gamepads = FCUtil.getVRGamepads(true);
              //     var poseMissing = false;
              //     for (var i = 0; i < gamepads.length; i++) {
              //         poseMissing = poseMissing || (gamepads[i].pose === undefined);
              //     }
              //     if (poseMissing) {
              //         error('Gamepads were detected but are not reporting a pose. You probably need to enable Gamepad Extensions in about:flags . <a style="color:green;" href="http://meta4vr.net/setup/" target="_top">Click here for the solution</a>');
              //     }
              //
              // }
              /* window.START_VR() needs to be called in response to a user gesture to activate */
      
      
              // });
              // console.debug(window.onload);
              // console.log(viewports.rightEye.bounds);
              /// [0.5,0.5,0.5,1.0]
              /// [0.5,0.5,0.5,0.5]
      
            } else {
              // VRSamplesUtil.addInfo("WebVR supported, but no VRDisplays found.", 3000);
            }
          });
        } else if (navigator.getVRDevices) {
          // VRSamplesUtil.addError("Your browser supports WebVR but not the latest version. See <a href='http://webvr.info'>webvr.info</a> for more info.");
        } else {
          // VRSamplesUtil.addError("Your browser does not support WebVR. See <a href='http://webvr.info'>webvr.info</a> for assistance.");
          var s2strans = vec3.fromValues(0, 1.82, 0);
          var s2smat = mat4.create();
          // mat4.fromRotationTranslation(s2smat, )
          var stageParams = {
              sizeX: 2.0, sizeY: 2.0, sittingToStandingTransform: s2smat
          };
          framework.engine.initWebGL(true, stageParams);
        }
        
        window.requestAnimationFrame(function (tt) {framework.engine.handleAnimationFrame(tt);});
        
        
    }
    
    var Engine = function (canvas, viewports) {
        var engine = this;
        this.canvas = canvas;
        this.viewports = viewports;
        this.vrDisplay = null;
        this.clearColor = {r:0.1, g:0.4, b:0.2, a:1.0};
        
        this.gl = null;
        this.viewMat = mat4.create();
        this.poseMat = mat4.create();
        this.projectionMat = mat4.create();
        
        this.orientation = [0, 0, 0];
        this.position = [0, 0, 0];
        
        this.activeViewports = ['leftEye', 'rightEye', 'cam4']; // <<< TODO 
        
        this.stageParameters = null;
        
        // this._currentTextureUnit
        this._textureUnits = [];
        
        console.log(navigator);
        if (navigator.getVRDisplays) {
            navigator.getVRDisplays()
            .then(function (displays) {
                if (displays.length > 0) {
                    engine.vrDisplay = displays[0];
                }
            })
        }
        
    }
    
    
    
    Engine.prototype.initWebGL = function (preserveDrawingBuffer, stageParameters) {
        var engine = this;
        var glAttribs = {
            alpha: false,
            antialias: true,
            preserveDrawingBuffer: preserveDrawingBuffer
        };
        gl = engine.canvas.getContext('webgl', glAttribs);
        gl.clearColor(engine.clearColor.g, engine.clearColor.r, engine.clearColor.b, engine.clearColor.a);
        // gl.clearColor(0.1, 0.4, 0.2, 1.0);
        gl.enable(gl.DEPTH_TEST);
        // gl.enable(gl.CULL_FACE);
        engine.gl = gl;
        
        var texMax = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
        for (var i = 0; i < texMax; i++) {
            this._textureUnits.push(gl['TEXTURE'+i]);
        }
        engine.stageParameters = stageParameters;
        if (engine._scene) {
            engine._scene.init(gl, stageParameters);
            engine._scene.setup();
            engine._scene.isRendering = true;
        }
        
        window.addEventListener('resize', function () {engine.handleResize();}, false);
        engine.handleResize();
        window.requestAnimationFrame(function (tt) {engine.handleAnimationFrame(tt);});
        
        
    }
    
    Engine.prototype.handleAnimationFrame = function (t) {
        CARNIVAL.setPerfContext('general');
        CARNIVAL._perfRecordsPtr = (CARNIVAL._perfRecordsPtr+1) % CARNIVAL._perfRecordsCount;
        CARNIVAL.reportTimeMeasurement('engine', 'intervalBetweenFrames', 'ended');
        CARNIVAL.reportTimeMeasurement('engine', 'handleAnimationFrame', 'started');
        CARNIVAL._postRenderTasksVeto = true; /* Not sure if handleAnimationTasks can run parallel with itself. Guard if so */
        var engine = this;
        var gl = engine.gl;
        if (!gl) return;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // TODO check for missing scene //
        
        if (engine.vrDisplay) {
            // console.log('displaying');
            engine.vrDisplay.requestAnimationFrame(function (tt) {engine.handleAnimationFrame(tt);});
            
            /* We want to ensure that the time between getting the pose and rendering the frame is as short as possible, so
               we give the scene the opportunity handle other tasks outside of that cycle */
            CARNIVAL.reportTimeMeasurement('engine', 'renderPrep', 'started');
            if (this._scene && this._scene.prepareToRender) {
                this._scene.prepareToRender();
            }
            CARNIVAL.reportTimeMeasurement('engine', 'renderPrep', 'started');
            var pose = engine.vrDisplay.getPose();
            engine.getPoseMatrix(engine.poseMat, pose);
            
            var ploc = engine._scene && engine._scene.playerLocation || {x:0, y:0, z:0};
            var trans = vec3.fromValues(ploc.x, ploc.y, ploc.z);
            var reloc = mat4.create();
            mat4.fromTranslation(reloc, trans);
            mat4.mul(engine.poseMat, reloc, engine.poseMat);
            if (engine.vrDisplay.isPresenting) {
                for (var i=0; i<engine.activeViewports.length; i++) {
                    var myPort = engine.viewports[engine.activeViewports[i]];
                    var cW = engine.canvas.width, cH = engine.canvas.height;
                    gl.viewport(myPort.canvasBounds[0]*cW, myPort.canvasBounds[1]*cH, myPort.canvasBounds[2]*cW, myPort.canvasBounds[3]*cH);
                    engine.renderSceneView(myPort.getPose && myPort.getPose() || engine.poseMat, myPort.getEyeParameters(), myPort.povLabel);
                    // if (myPort.pose) {console.log(myPort.pose);}
                }
                engine.vrDisplay.submitFrame(pose);
            }
            else {
                engine.gl.viewport(0, 0, engine.canvas.width, engine.canvas.height);
                engine.renderSceneView(engine.poseMat, null);
            }
        }
        /* Else if no VR display */
        /* TODO Test this on the Mac! */
        else {
            window.requestAnimationFrame(function (tt) {engine.handleAnimationFrame(tt);});
            engine.gl.viewport(0, 0, engine.canvas.width, engine.canvas.height);
            
            var myPort = engine.viewports['cam4'];
            // console.log(myPort);
            engine.gl.viewport(0, 0, engine.canvas.width, engine.canvas.height);
            //// engine.renderSceneView(engine.poseMat, null);

            //engine.renderSceneView(myPort.getPose && myPort.getPose() || engine.poseMat, myPort.getEyeParameters(), myPort.povLabel);
            engine.renderSceneView(myPort.getPose && myPort.getPose(), null);
            
            //
            //
            // mat4.perspective(engine.projectionMat, Math.PI*0.4, engine.canvas.width / engine.canvas.height, 0.1, 1024.0);
            // mat4.identity(engine.viewMat);
            // mat4.translate(engine.viewMat, engine.viewMat, [0, -PLAYER_HEIGHT, 0]);
            
            /* TODO tell the scene to render here! */
            
            // gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
            // mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
            // mat4.identity(viewMat);
            // mat4.translate(viewMat, viewMat, [0, -PLAYER_HEIGHT, 0]);
            // scene.render(projectionMat, viewMat);
            
            
        }
        CARNIVAL._postRenderTasksVeto = false;
        while (CARNIVAL._postRenderTasks.length > 0 && !CARNIVAL._postRenderTasksVeto) {
            CARNIVAL._postRenderTasks.shift()();
        }
        
        CARNIVAL.setPerfContext('general');
        CARNIVAL.reportTimeMeasurement('engine', 'handleAnimationFrame', 'ended');
        CARNIVAL.reportTimeMeasurement('engine', 'intervalBetweenFrames', 'started');
    }
    
    
    Engine.prototype.handleVRPresentChange = function () {
        this.handleResize();
    }
    
    Engine.prototype.handleResize = function () {
        var engine = this;
        var display = engine.vrDisplay;
        var canvas = engine.canvas;
        if (display && display.isPresenting) {
            var leftEye = display.getEyeParameters('left');
            var rightEye = display.getEyeParameters('right');
            canvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
            canvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
        }
        else {
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        }
    }
    
    Engine.prototype.getPoseMatrix = function (out, pose) {
        var engine = this;
        engine.orientation = pose.orientation || [0, 0, 0, 1];
        engine.position = pose.position || [0, 0, 0];
        if (engine.stageParameters) {
            mat4.fromRotationTranslation(out, engine.orientation, engine.position);
            mat4.multiply(out, engine.stageParameters.sittingToStandingTransform, out);
        }
        else {
            // TODO worry about this later //
        }
    }
    
    Engine.prototype.renderSceneView = function (poseInMat, eye, pov) {
        if (eye) {
            mat4.translate(this.viewMat, poseInMat, eye.offset);
            mat4.perspectiveFromFieldOfView(this.projectionMat, eye.fieldOfView, 0.1, 1024.0);
            mat4.invert(this.viewMat, this.viewMat);
        } else {
            mat4.perspective(this.projectionMat, Math.PI*0.4, this.canvas.width / this.canvas.height, 0.1, 1024.0);
            mat4.invert(this.viewMat, poseInMat);
        }
        
        CARNIVAL.setPerfContext(pov);
        CARNIVAL.reportTimeMeasurement('engine', 'frameRender', 'started');
        if (this._scene) this._scene.render(this.projectionMat, this.viewMat, pov);
        CARNIVAL.reportTimeMeasurement('engine', 'frameRender', 'ended');
    }
    
    
    


    //         if (typeof colours[colour.toLowerCase()] != 'undefined')
    //             return colours[colour.toLowerCase()];
    //
    //         return false;
    //     }
    // })();
    
    /* ---------------- */
    // function onAnimationFrame (t) {
    //   // stats.begin();
    //   if (!gl) return;
    //   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //   if (!window.vrScene && FC_SCENE_MISSING === null) {
    //       FC_SCENE_MISSING = true;
    //       var err = 'No scene was found in window.vrScene';
    //       error(err);
    //   }
    //
    //   if (vrDisplay) {
    //     // When presenting content to the VRDisplay we want to update at its
    //     // refresh rate if it differs from the refresh rate of the main
    //     // display. Calling VRDisplay.requestAnimationFrame ensures we render
    //     // at the right speed for VR.
    //     vrDisplay.requestAnimationFrame(onAnimationFrame);
    //
    //     // var vrGamepads = [];
    //     // var gamepads = navigator.getGamepads();
    //     // for (var i=0; i<gamepads.length; ++i) {
    //     //     var gamepad = gamepads[i];
    //     //     if (gamepad && gamepad.pose) {
    //     //         vrGamepads.push(gamepad);
    //     //         for (var j=0; j < gamepad.buttons.length; ++j) {
    //     //             if (gamepad.buttons[j].pressed) {
    //     //                 console.log('Button '+j+' pressed');
    //     //                 console.debug(gamepad);
    //     //             }
    //     //         }
    //     //     }
    //     // }
    //
    //     // As a general rule you want to get the pose as late as possible
    //     // and call VRDisplay.submitFrame as early as possible after
    //     // retrieving the pose. Do any work for the frame that doesn't need
    //     // to know the pose earlier to ensure the lowest latency possible.
    //     // ^^ observe this
    //     var pose = vrDisplay.getPose();
    //     getPoseMatrix(poseMat, pose);
    //
    //     /* let's try relocating the player */
    //     /* If scene.playerLocation is updated, here's how we notice it */
    //     var ploc = window.vrScene && window.vrScene.playerLocation || {x:0, y:0, z:0};
    //     var trans = vec3.fromValues(ploc.x, ploc.y, ploc.z);
    //     var reloc = mat4.create();
    //     mat4.fromTranslation(reloc, trans);
    //     // console.debug(reloc);
    //     mat4.mul(poseMat, reloc, poseMat);
    //     /* ... */
    //
    //     if (vrDisplay.isPresenting) {
    //
    //         for (var i=0; i<activeViewports.length; i++) {
    //             var myPort = activeViewports[i];
    //             var cW = webglCanvas.width, cH = webglCanvas.height;
    //             gl.viewport(myPort.canvasBounds[0]*cW, myPort.canvasBounds[1]*cH, myPort.canvasBounds[2]*cW, myPort.canvasBounds[3]*cH);
    //             renderSceneView(myPort.getPose && myPort.getPose() || poseMat, myPort.getEyeParameters(), myPort.povLabel);
    //             // if (myPort.pose) {console.log(myPort.pose);}
    //         }
    //
    //       // If we're currently presenting to the VRDisplay we need to
    //       // explicitly indicate we're done rendering and inform the
    //       // display which pose was used to render the current frame.
    //       vrDisplay.submitFrame(pose);
    //     } else {
    //       // When not presenting render a mono view that still takes pose into
    //       // account.
    //       gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
    //       renderSceneView(poseMat, null);
    //       // stats.renderOrtho();
    //     }
    //   } else {
    //     window.requestAnimationFrame(onAnimationFrame);
    //
    //     // No VRDisplay found.
    //     gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
    //     mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
    //     mat4.identity(viewMat);
    //     mat4.translate(viewMat, viewMat, [0, -PLAYER_HEIGHT, 0]);
    //     scene.render(projectionMat, viewMat);
    //
    //     // stats.renderOrtho();
    //   }
    //
    //   // stats.end();
    // }
    
    // ----------- end onAnimationFrame
    
    
    
    
    // function onVRRequestPresent () {
    //   // This can only be called in response to a user gesture.
    //   vrDisplay.requestPresent([{ source: webglCanvas }]).then(function () {
    //     // Nothing to do because we're handling things in onVRPresentChange.
    //   }, function () {
    //     VRSamplesUtil.addError("requestPresent failed.", 2000);
    //   });
    // }

    // function onVRExitPresent () {
    //   vrDisplay.exitPresent().then(function () {
    //     // Nothing to do because we're handling things in onVRPresentChange.
    //   }, function () {
    //     VRSamplesUtil.addError("exitPresent failed.", 2000);
    //   });
    // }
    
    // Engine.prototype.handleVRRequestPresent = function () {
    //     this.vrDisplay.requestPresent()
    // }
    
    // function onVRPresentChange () {
    //   // When we begin or end presenting, the canvas should be resized to the
    //   // recommended dimensions for the display.
    //   onResize();
    //
    //   if (vrDisplay.isPresenting) {
    //     if (vrDisplay.capabilities.hasExternalDisplay) {
    //       // Because we're not mirroring any images on an external screen will
    //       // freeze while presenting. It's better to replace it with a message
    //       // indicating that content is being shown on the VRDisplay.
    //       // presentingMessage.style.display = "block";
    //
    //       // On devices with an external display the UA may not provide a way
    //       // to exit VR presentation mode, so we should provide one ourselves.
    //       // VRSamplesUtil.removeButton(vrPresentButton);
    //       // vrPresentButton = VRSamplesUtil.addButton("Exit VR", "E", "../cardboard64.png", onVRExitPresent);
    //     }
    //   } else {
    //     // If we have an external display take down the presenting message and
    //     // change the button back to "Enter VR".
    //     if (vrDisplay.capabilities.hasExternalDisplay) {
    //       // presentingMessage.style.display = "";
    //
    //       // VRSamplesUtil.removeButton(vrPresentButton);
    //       // vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "../cardboard64.png", onVRRequestPresent);
    //     }
    //   }
    // }

    
    
    // function onResize () { //////
    //   if (vrDisplay && vrDisplay.isPresenting) {
    //     // If we're presenting we want to use the drawing buffer size
    //     // recommended by the VRDevice, since that will ensure the best
    //     // results post-distortion.
    //     var leftEye = vrDisplay.getEyeParameters("left");
    //     var rightEye = vrDisplay.getEyeParameters("right");
    //
    //     // For simplicity we're going to render both eyes at the same size,
    //     // even if one eye needs less resolution. You can render each eye at
    //     // the exact size it needs, but you'll need to adjust the viewports to
    //     // account for that.
    //     webglCanvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
    //     webglCanvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
    //   } else {
    //     // We only want to change the size of the canvas drawing buffer to
    //     // match the window dimensions when we're not presenting.
    //     webglCanvas.width = webglCanvas.offsetWidth * window.devicePixelRatio;
    //     webglCanvas.height = webglCanvas.offsetHeight * window.devicePixelRatio;
    //   }
    // }
    // // window.addEventListener("resize", onResize, false);
    // // onResize();
    
    
    
    
    // function getPoseMatrix (out, pose) { /////////
    //   orientation = pose.orientation;
    //   position = pose.position;
    //   if (!orientation) { orientation = [0, 0, 0, 1]; }
    //   if (!position) { position = [0, 0, 0]; }
    //
    //   if (vrDisplay.stageParameters) {
    //     // If the headset provides stageParameters use the
    //     // sittingToStandingTransform to transform the pose into a space where
    //     // the floor in the center of the users play space is the origin.
    //     mat4.fromRotationTranslation(out, orientation, position);
    //     mat4.multiply(out, vrDisplay.stageParameters.sittingToStandingTransform, out);
    //   } else {
    //     // Otherwise you'll want to translate the view to compensate for the
    //     // scene floor being at Y=0. Ideally this should match the user's
    //     // height (you may want to make it configurable). For this demo we'll
    //     // just assume all human beings are 1.65 meters (~5.4ft) tall.
    //     vec3.add(standingPosition, position, [0, PLAYER_HEIGHT, 0]);
    //     mat4.fromRotationTranslation(out, orientation, standingPosition);
    //   }
    // }
    
    

    // function renderSceneView (poseInMat, eye, pov) {/////////
    //   if (eye) {
    //     mat4.translate(viewMat, poseInMat, eye.offset);
    //     mat4.perspectiveFromFieldOfView(projectionMat, eye.fieldOfView, 0.1, 1024.0);
    //     mat4.invert(viewMat, viewMat);
    //   } else {
    //     mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
    //     mat4.invert(viewMat, poseInMat);
    //   }
    //
    //   if (window.vrScene) window.vrScene.render(projectionMat, viewMat, pov);
    // }
    
    //// ----//// ----//// ----//// ----//// ----//// ----//// ----
    
    var error = function (err) {
        if (window.showError) {
            window.showError(err);
        }
        else {
            console.log(err);
        }
    }

    var getCameraPos = function () {
        var poseOut = mat4.create();
        var standpos = vec3.create();
        var PLAYER_HEIGHT = 1.82;
        var pos = [0, 0, 0];
        var rot = quat.create();
        quat.rotateY(rot, rot, ROTY % (2*Math.PI));
        ROTY+=0.01;
        // var ori = [0, ((ROTY+=0.01)%Math.PI)-(Math.PI/2), 0, 1];
        vec3.add(standpos, pos, [0, PLAYER_HEIGHT, 0]);
        mat4.fromRotationTranslation(poseOut, rot, standpos);
        // console.log(ROTY);
        return poseOut;
    }

    var attachCameraToGamepad = function (gpIdx) {
        var poseGet = function () {
            var vrGamepads = FCUtil.getVRGamepads();
            if (vrGamepads[gpIdx] && vrGamepads[gpIdx].pose && vrGamepads[gpIdx].pose.position) {
                var myGp = vrGamepads[gpIdx];
                var gPose = myGp.pose;
                var cameraTranslate = vec3.create();
                cameraTranslate[0] = numericValueOfElement('cameraTranslateX');
                cameraTranslate[1] = numericValueOfElement('cameraTranslateY');
                cameraTranslate[2] = numericValueOfElement('cameraTranslateZ');
                var cameraPos = vec3.create();
                vec3.add(cameraPos, cameraTranslate, gPose.position);
                var gpMat = mat4.create();
                // var orientation = gPose.orientation;
                // var position = gPose.
                if (window.vrDisplay.stageParameters) {
                    // mat4.fromRotationTranslation(gpMat, gPose.orientation, gPose.position);
                    mat4.fromRotationTranslation(gpMat, gPose.orientation, cameraPos);
                    mat4.multiply(gpMat, vrDisplay.stageParameters.sittingToStandingTransform, gpMat);
                }
                return gpMat;
            }
            else {
                return getCameraPos();
            }
        }
        return poseGet;
    }
    
    /* TODO incorporate player/raft translation */
    /* TODO make a button lock and unlock */
    var lockableGamepadCam = function (gpIdx) {
        var poseGet = function () {
            if (!CARNIVAL._cameraLocked) {
                var vrGamepads = CARNIVAL.hardware.controller.getMotionControllers();
                if (vrGamepads[gpIdx] && vrGamepads[gpIdx].pose && vrGamepads[gpIdx].pose.position) {
                    var myGp = vrGamepads[gpIdx];
                    var p = myGp.pose;
                    CARNIVAL._cameraLockPose = {
                        position: [p.position[0], p.position[1], p.position[2]],
                        orientation: [p.orientation[0], p.orientation[1], p.orientation[2], p.orientation[3]]
                    };
                    window.CPOSE = CARNIVAL._cameraLockPose;
                }
            }
            
            var gpMat = mat4.create();
            var cameraTranslate = vec3.create();
            var cameraTilt = vec3.create();
            cameraTranslate[0] = numericValueOfElement('cameraTranslateX');
            cameraTranslate[1] = numericValueOfElement('cameraTranslateY');
            cameraTranslate[2] = numericValueOfElement('cameraTranslateZ');
            var cameraPos = vec3.create();

            cameraTilt[0] = numericValueOfElement('cameraTiltX') * (Math.PI/180);
            cameraTilt[1] = numericValueOfElement('cameraTiltY') * (Math.PI/180);
            cameraTilt[2] = numericValueOfElement('cameraTiltZ') * (Math.PI/180);
            var cameraRot = quat.create();
            quat.rotateX(cameraRot, cameraRot, cameraTilt[0]);
            quat.rotateY(cameraRot, cameraRot, cameraTilt[1]);
            quat.rotateZ(cameraRot, cameraRot, cameraTilt[2]);
            quat.mul(cameraRot, CARNIVAL._cameraLockPose.orientation, cameraRot);
            
            vec3.add(cameraPos, cameraTranslate, CARNIVAL._cameraLockPose.position);
            if (window.vrDisplay.stageParameters) {
                // mat4.fromRotationTranslation(gpMat, _cameraLockPose.orientation, cameraPos);
                mat4.fromRotationTranslation(gpMat, cameraRot, cameraPos);
                mat4.multiply(gpMat, vrDisplay.stageParameters.sittingToStandingTransform, gpMat);
            }
            
            // var transformedCameraPose = mat4.create();
            return gpMat;
        }
        return poseGet;
    }
    
    /* This one is attached to the raft, so the player can teleport around */
    var lockableGamepadCam2 = function (gpIdx) {
        var poseGet = function () {
            if (!CARNIVAL._cameraLocked) {
                var vrGamepads = CARNIVAL.hardware.controller.getMotionControllers();
                if (vrGamepads[gpIdx] && vrGamepads[gpIdx].pose && vrGamepads[gpIdx].pose.position) {
                    var myGp = vrGamepads[gpIdx];
                    var p = myGp.pose;
                    CARNIVAL._cameraLockPose = {
                        position: [p.position[0], p.position[1], p.position[2]],
                        orientation: [p.orientation[0], p.orientation[1], p.orientation[2], p.orientation[3]]
                    };
                    window.CPOSE = CARNIVAL._cameraLockPose;
                }
            }
            
            var gpMat = mat4.create();
            var cameraTranslate = vec3.create();
            var cameraTilt = vec3.create();
            cameraTranslate[0] = numericValueOfElement('cameraTranslateX');
            cameraTranslate[1] = numericValueOfElement('cameraTranslateY');
            cameraTranslate[2] = numericValueOfElement('cameraTranslateZ');
            var pl = CARNIVAL.scenes[0].scene.playerLocation;
            var raftTranslate = vec3.fromValues(pl.x, pl.y, pl.z);
            vec3.add(cameraTranslate, cameraTranslate, raftTranslate);
            // console.log(cameraTranslate);

            var cameraPos = vec3.create();

            cameraTilt[0] = numericValueOfElement('cameraTiltX') * (Math.PI/180);
            cameraTilt[1] = numericValueOfElement('cameraTiltY') * (Math.PI/180);
            cameraTilt[2] = numericValueOfElement('cameraTiltZ') * (Math.PI/180);
            var cameraRot = quat.create();
            quat.rotateX(cameraRot, cameraRot, cameraTilt[0]);
            quat.rotateY(cameraRot, cameraRot, cameraTilt[1]);
            quat.rotateZ(cameraRot, cameraRot, cameraTilt[2]);
            quat.mul(cameraRot, CARNIVAL._cameraLockPose.orientation, cameraRot);
            
            vec3.add(cameraPos, cameraTranslate, CARNIVAL._cameraLockPose.position);
            if (CARNIVAL.engine.stageParameters) {
                // mat4.fromRotationTranslation(gpMat, _cameraLockPose.orientation, cameraPos); //1
                // mat4.fromRotationTranslation(gpMat, cameraRot, cameraPos); //2
                mat4.fromRotationTranslation(gpMat, cameraRot, CARNIVAL._cameraLockPose.position);
                var cameraTransMat = mat4.create();
                mat4.fromTranslation(cameraTransMat, cameraTranslate);
                mat4.multiply(gpMat, CARNIVAL.engine.stageParameters.sittingToStandingTransform, gpMat);
                mat4.multiply(gpMat, cameraTransMat, gpMat);
            }
            
            // var transformedCameraPose = mat4.create();
            return gpMat;
        }
        return poseGet;
    }


    var attachSceneCamera = function (label) {
        var poseGet = function () {
            var scene = window.vrScene;
            var camMat = mat4.create();
            var myCam;
            if (scene && scene.cameras && scene.cameras[label]) {
                myCam = scene.cameras[label];
            }
            else {
                myCam = {
                    position: {x:0.4, y:1, z:-1.6},
                    orientation: {x:0.0, y:Math.PI}
                };
            }
            var pos = vec3.fromValues(myCam.position.x, myCam.position.y, myCam.position.z);
            var rot = quat.create();
            quat.rotateY(rot, rot, myCam.orientation.y || 0.0);
            quat.rotateX(rot, rot, myCam.orientation.x || 0.0);
            mat4.fromRotationTranslation(camMat, rot, pos);
    
            return camMat;
        }
        return poseGet;
    }

    var numericValueOfElement = function (elemId, defaultValue) {
        try {
            return Number(document.getElementById(elemId).value);
        }
        catch (exc) {
            return defaultValue || 0.0;
        }

    }

    /* headsetBounds is left/top/width/height-down */
    /* canvasBounds is left/bottom/width/height-up */
    var doubleGridPorts = function (j) {
        var port = {};
        switch (j) {
        /* Left eye */
        case 0:
            port.headsetBounds = [0.0, 0.0, 0.5, 1.0];
            port.canvasBounds = [0.0, 0.0, 0.5, 1.0];
            break;
        /* Right eye */
        case 1:
            port.headsetBounds = [0.5, 0.0, 0.5, 1.0];
            port.canvasBounds = [0.5, 0.0, 0.5, 1.0];
            break;
        }
        return port;
    }

    var tripleGridPorts = function (j) {
        var port = {};
        switch (j) {
        /* Left eye */
        case 0:
            port.headsetBounds = [0.0, 0.0, 0.5, 0.5];
            port.canvasBounds = [0.0, 0.5, 0.5, 0.5];
            break;
        /* Right eye */
        case 1:
            port.headsetBounds = [0.5, 0.0, 0.5, 0.5];
            port.canvasBounds = [0.5, 0.5, 0.5, 0.5];
            break;
        /* Camera */
        case 2:
            port.headsetBounds = null;
            port.canvasBounds = [0.0, 0.0, 0.42, 0.5];
            break;
        }
        return port;
    }
    var port = tripleGridPorts;

    var viewports = {
        /* headsetBounds are in a format that vrDisplay.requestPresent() understands ie. top-down */
        /* canvasBounds are the same section but converted to canvas coords ie. bottom-up */
        /* one could probably be inferred from the other but I CBF right now */
        leftEye: {
            povLabel: 'left_eye',
            headsetBounds: port(0).headsetBounds,
            canvasBounds: port(0).canvasBounds,
            getEyeParameters: function () {return vrComponents.display && vrComponents.display.getEyeParameters('left');}
        },
        rightEye: {
            povLabel: 'right_eye',
            headsetBounds: port(1).headsetBounds,
            canvasBounds: port(1).canvasBounds,
            getEyeParameters: function () {return vrComponents.display && vrComponents.display.getEyeParameters('right');}
        },
        cam1: {
            povLabel: 'cam_1',
            headsetBounds: port(2).headsetBounds,
            canvasBounds: port(2).canvasBounds,
            getEyeParameters: function () {
                return {
                    renderHeight: 1600,
                    renderWidth: 1512,
                    offset: [0,0,0],
                    fieldOfView: {
                        // upDegrees: 56.0,
                        // downDegrees: 56.0,
                        upDegrees: 40.0,
                        downDegrees: 40.0,
                        leftDegrees: 45.0,
                        rightDegrees: 45.0
                    }
                };
            },
            // getPose: function () {return getCameraPos();}
            getPose: attachSceneCamera('cam1')
        },
        cam2: {
            povLabel: 'cam_2',
            headsetBounds: port(2).headsetBounds,
            canvasBounds: port(2).canvasBounds,
            // canvasBounds: [0.0, 0.0, 1.0, 0.5],
            getEyeParameters: function () {
                return {
                    renderHeight: 1600,
                    renderWidth: 1512,
                    offset: [0,0,0],
                    fieldOfView: {
                        /// upDegrees: 56.0,
                        /// downDegrees: 56.0,
                        upDegrees: 32.0,
                        downDegrees: 32.0,
                        leftDegrees: 45.0,
                        rightDegrees: 45.0
                        // upDegrees: 32.0,
                        // downDegrees: 32.0,
                        // leftDegrees: 35.0,
                        // rightDegrees: 35.0
                
                    }
                };
            },
            getPose: attachCameraToGamepad(1)
        },
        cam3: {
            povLabel: 'cam_2',
            headsetBounds: port(2).headsetBounds,
            canvasBounds: port(2).canvasBounds,
            // canvasBounds: [0.0, 0.0, 1.0, 0.5],
            getEyeParameters: function () {
                return {
                    renderHeight: 1600,
                    renderWidth: 1512,
                    offset: [0,0,0],
                    fieldOfView: {
                        /// upDegrees: 56.0,
                        /// downDegrees: 56.0,
                        upDegrees: numericValueOfElement('cameraUpDegrees'),
                        downDegrees: numericValueOfElement('cameraDownDegrees'),
                        leftDegrees: numericValueOfElement('cameraLeftDegrees'),
                        rightDegrees: numericValueOfElement('cameraRightDegrees')
                        // upDegrees: 32.0,
                        // downDegrees: 32.0,
                        // leftDegrees: 35.0,
                        // rightDegrees: 35.0
                
                    }
                };
            },
            getPose: attachCameraToGamepad(1)
        },
        cam4: {
            povLabel: 'cam_2',
            headsetBounds: port(2).headsetBounds,
            canvasBounds: port(2).canvasBounds,
            // canvasBounds: [0.0, 0.0, 1.0, 0.5],
            getEyeParameters: function () {
                return {
                    renderHeight: 1600,
                    renderWidth: 1512,
                    offset: [0,0,0],
                    fieldOfView: {
                        /// upDegrees: 56.0,
                        /// downDegrees: 56.0,
                        upDegrees: numericValueOfElement('cameraUpDegrees'),
                        downDegrees: numericValueOfElement('cameraDownDegrees'),
                        leftDegrees: numericValueOfElement('cameraLeftDegrees'),
                        rightDegrees: numericValueOfElement('cameraRightDegrees')
                        // upDegrees: 32.0,
                        // downDegrees: 32.0,
                        // leftDegrees: 35.0,
                        // rightDegrees: 35.0
                
                    }
                };
            },
            getPose: lockableGamepadCam2(1)
        },
        
    };
    var activeViewports = [
        viewports.leftEye,
        viewports.rightEye,
        viewports.cam4
    ];
    
    

    
    return new Framework();
    
    
})();



