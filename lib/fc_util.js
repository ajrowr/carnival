
window.FCUtil = (function () {
    "use strict";
    
    function makeTranslation(tx, ty, tz) {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            tx, ty, tz, 1
        ];
    }
    
    function makeXRotation(angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
        
        return [
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ];
    }

    function makeYRotation(angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
        
        return [
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ];
    }
    
    function makeZRotation(angleInRadians) {
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
        
        return [
            c, s, 0, 0,
            -s, c, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];
    }
    
    function loadImageAsTextureAnd(src, label, scene) {
        var loadImg = function (src, label, scene) {
            return new Promise(function (resolve, reject) {
                var im = document.createElement('img');
                im.crossOrigin = 'anonymous';
                im.onload = function () {
                    var s = 2048;
                    var cnv = document.createElement('canvas');
                    cnv.width = s;
                    cnv.height = s;
                    var c2x = cnv.getContext('2d');
                    // c2x.drawImage(im, 0, 0, s, s);
                    // c2x.beginPath();
                    // c2x.rect(10, 10, 100, 100);
                    // c2x.fillStyle = 'blue';
                    // c2x.fill();
                    // scene.addTextureFromCanvas(cnv, label);
                    
                    c2x.drawImage(im, 0, 0, s, s);
                    var encaps = {
                        pixels: c2x.getImageData(0, 0, s, s),
                        label: label
                    }
                    var tex = scene.addEncapsulatedTexture(encaps);
                    
                    resolve({img:im, label:label, texture: tex});
                }
                im.src = src;
            });
        }
        return loadImg(src, label, scene);
    }
    
    function loadImagesAsTextures(srcList, scene) {
        return new Promise(function (resolve, reject) {
            var imagePromises = [];
            for (var i=0; i<srcList.length; i++) {
                imagePromises.push(loadImageAsTextureAnd(srcList[i], null, scene));
            }
            Promise.all(imagePromises).then(function (imagesList) {
                resolve(imagesList);
            });
            
        });
    }
    
    var loadImage = function (src) {
        return new Promise(function (resolve, reject) {
            var im = document.createElement('img');
            im.crossOrigin = 'anonymous';
            im.onload = function () {
                resolve(im);
            };
            im.src = src;
        });
    }
    
    var makeImageBoard = function (scene, src, texLabel, pos, orientation, size, groupLabel, meta) {
        size = size || {};
        var boardH = size.h || 3.0;
        return new Promise(function (resolve, reject) {
            loadImage(src)
            .then(function (im) {
                var imgW = im.width;
                var imgH = im.height;
                var scaleFactor = boardH/imgH;
                
                var mkTexLoader = function (img) {
                    var texLoader = function () {
                        var s = 2048; /* TODO make this configurable */
                        var cnv = document.createElement('canvas');
                        cnv.width = s;
                        cnv.height = s;
                        var c2x = cnv.getContext('2d');
                        c2x.drawImage(im, 0, 0, s, s);
                        return c2x.getImageData(0, 0, s, s);
                    }
                    return texLoader;
                }
                
                var board = new FCShapes.BoardCuboid(
                    pos, 
                    {
                        w: imgW*scaleFactor, h: imgH*scaleFactor, d:0.2
                    },
                    orientation,
                    {
                        textureLabel: 'silver',
                        shaderLabel: 'basic',
                        groupLabel: groupLabel || 'contentboards',
                        label: texLabel
                    }
                );
                board.faces.front.textureLoader = mkTexLoader(im);
                
                board.metadata = meta;
                if (board.metadata.caption) {
                    var cpar = {
                        canvasColor: 'black',
                        canvasWidth: 100*Math.round(imgW * scaleFactor),
                        canvasHeight: 100*Math.round((imgH*scaleFactor)/10),
                        leftMargin: 40
                    };
                    board.faces.caption.texture = renderTextToTexture(scene.gl, [
                        {t:meta.caption, size:'67', color:'white'}
                    ], cpar);
                }
                else {
                    board.faces.caption.noTexture = true;
                }
                
                resolve(board);
                
            });
            
        });

    };
    
    var makeTextureFromCanvas = function (gl, canvas) {
        var idx = 1; /* TODO */
        // var gl = this.gl;
        try {
            gl.activeTexture(gl.TEXTURE0+idx);            
            var texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); /* TODO */
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // gl.uniform1i()
            // if (label) this.textures[label] = texture;
            // console.debug(texture);
            return texture;
        }
        catch (err) {
            if (!gl && window.showError) {
                window.showError('Lost connection to GL');
            }
            throw err;
        }
    }
    
    
    /* Friendlier interface for textblock rendering */
    /* Textblocks are structured like so:
    {
        t: <text>
        font: <html font, default arial>
        size: <size in px, default 30>
        lineHeight: <line height, default size+4>
        color: <html color, default white>
        mode: [stroke|fill] //TODO
    }
    Params: {
        leftMargin (default=4)
        topMargin (default=4)
        canvasWidth:
        canvasHeight:
        canvasColor: <html color, implicit default is black>
    }
    Everything but t is optional.
    */
    var renderTextToTexture = function (gl, textBlocks, params) {
        var leftMargin = Number(params.leftMargin || 4);
        var topMargin = Number(params.topMargin || 4);
        
        var blocksOut = [];
        var currentY = null;
        for (var i=0; i<textBlocks.length; i++) {
            var b = textBlocks[i];
            var sz = Number(b.size || 30);
            var lineHeight = Number(b.lineHeight || sz + 4);
            if (currentY == null) currentY = topMargin;
            var bparams = {
                text: b.t,
                font: sz + 'px ' + (b.font || 'Arial'),
                fillStyle: b.color || 'white',
                pos: {x: leftMargin, y: currentY+sz}
            }
            currentY += lineHeight;
            blocksOut.push(bparams);
        }
        return makeTextTexture(gl, blocksOut, {w:params.canvasWidth, h:params.canvasHeight, bg:params.canvasColor});
    }
    
    /* For best results, the canvasSize should be in the same proportions as where it's to be drawn 
    */
    var makeTextTexture = function (gl, textBlocks, canvasParams) {
        var textCanvas = document.createElement('canvas');
        var txSize = 512;
        textCanvas.width = canvasParams.w;
        textCanvas.height = canvasParams.h;
        var c1x = textCanvas.getContext('2d');
        if (canvasParams.bg) {
            c1x.fillStyle = canvasParams.bg;
            c1x.fillRect(0, 0, textCanvas.width, textCanvas.height);
        }
        
        for (var i=0; i<textBlocks.length; i++) {
            var tb = textBlocks[i];
            c1x.fillStyle = tb.fillStyle;
            c1x.font = tb.font;
            c1x.fillText(tb.text, tb.pos.x, tb.pos.y);
        }

        var textureCanvas = document.createElement('canvas');
        textureCanvas.height = txSize;
        textureCanvas.width = txSize;
        var c2x = textureCanvas.getContext('2d');
        var imgDat = c1x.getImageData(0, 0, textCanvas.width, textCanvas.height);
        // var imgDat = c1x.getImageData(0, 0, txSize, txSize);
        
        /* c2x.putImageData(imgDat, 0, 0, 0, 0, txSize, txSize); */

        // c2x.beginPath();
        // c2x.rect(100, 100, 100, 100);
        // c2x.fillStyle = 'blue';
        // c2x.fill();
        
        c2x.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, 0, 0, txSize, txSize);
        
        return makeTextureFromCanvas(gl, textureCanvas);
        
    }
    
    var makeTextBoard = function (scene, textBlocks, pos, orientation, size, groupLabel, meta) {
        size = size | {};
        var boardW = size.w || 1.5;
        var boardH = size.h || 1.0;
        
        return new Promise(function (resolve, reject) {
            var cnv = document.createElement('canvas');
            cnv.width = 1024;
            cnv.height = 1024;
            var c2x = cnv.getContext('2d');
            // c2x.beginPath();
            // c2x.rect(100, 100, 100, 100);
            // c2x.fillStyle = 'blue';
            // c2x.fill();
            
            
            var textScale = 500;
            var textTex = renderTextToTexture(scene.gl, textBlocks, {
                canvasWidth: boardW*textScale, 
                canvasHeight: boardH*textScale, 
                canvasColor: 'white',
                topMargin: 40,
                leftMargin: 40
                
            });
            
            var board = new FCShapes.BoardCuboid(
                pos, 
                {
                    w: boardW, h: boardH, d:0.2
                },
                orientation,
                {
                    textureLabel: 'silver',
                    shaderLabel: 'basic',
                    groupLabel: groupLabel || 'contentboards',
                    label: 'bla'
                }
            );
            board.faces.front.texture = textTex;
            board.faces.caption.noTexture = true;
            board.metadata = meta;
            resolve(board);
        })
    }
    

    var httpGet = function (url) {
        return new Promise(function(resolve, reject) {
            var req = new XMLHttpRequest();
            req.open('GET', url);
            req.onload = function () {
                if (req.status == 200) {
                    resolve(req.response);
                }
                else {
                    reject(Error(req.statusText));
                }
            };
            req.onerror = function () {
                reject(Error('Network error'));
            }
            req.send();
        })
    }
    
    var httpGetJSON = function (url) {
        return httpGet(url).then(JSON.parse).catch(function(err) {
            console.log('JSON load failed for ', url, err);
            throw err;
        });
    }
    
    var loadBoardsFromContentData = function (scene, contentData, params, params2, arranger) {
        params = params || {};
        params2 = params2 || {};
        var rangeStart = params2.rangeStart || 0;
        var rangeEnd = params2.rangeEnd || Infinity; /* So the length bounds check will work */
        var arranger = params.arranger || new FCFeedTools.CylinderArranger();
        
        return new Promise(function (resolve, reject) {
            var myRangeEnd = Math.min(contentData.length, rangeEnd);
            var boardPromises = [];
            var boardSpatials = arranger.arrange(rangeStart, myRangeEnd);
            console.debug('Range start:', rangeStart, 'end:', myRangeEnd);
            for (var i=rangeStart; i<myRangeEnd; i++) {
                var b = contentData[i];
                
                if (b.type == 'text') {
                    var tb2 = {
                        t: b.text,
                        font: 'Arial',
                        size: 100,
                        color: 'black'
                    }
                    boardPromises.push(makeTextBoard(
                        scene, [tb2], 
                        boardSpatials[i].pos,
                        boardSpatials[i].ori,
                        null, null, b
                    ));
                }
                else if (b.type == 'image') {
                    boardPromises.push(makeImageBoard(
                        scene,
                        b.src,
                        null, // dat.title + i,
                        boardSpatials[i].pos,
                        boardSpatials[i].ori,
                        {h:arranger.boardHeight}, null, b
                    ));
                }
                
            }
            Promise.all(boardPromises).then(function(boardsList) {
                resolve(boardsList);
            });
            
            
        });
    }
    
    /* Generates a behaviour-compatible thingy which listens for gamepad events and updates its 
    drawable accordingly.
    Accepts a function with signature (gamepadIndex, buttonIndex, buttonStatus, sector, buttonRaw, extra) for handling button events
    where extra is a dict with extra data and object refs in it.
    */
    
    var getVRGamepads = function (poseOptional) {
        var vrGamepads = [];
        var gamepads = navigator.getGamepads();
        for (var i=0; i<gamepads.length; i++) {
            var gamepad = gamepads[i];
            if (gamepad && gamepad.id == 'OpenVR Gamepad' && (gamepad.pose || poseOptional)) {
                vrGamepads.push(gamepad);
            }
        }
        return vrGamepads;
    }
    
    var makeGamepadTracker = function (scene, gamepadIndex, buttonHandler) {
        
        var trk = function (drawable, timePoint) {
            // console.log('hi!');
            var vrGamepads = getVRGamepads();
            // console.log('Got ', vrGamepads.length, 'VR gamepads from ', gamepads.length, 'total gamepads');
            if (vrGamepads.length && vrGamepads[gamepadIndex]) {
                var myGp = vrGamepads[gamepadIndex];
                var gPose = myGp.pose;
                if (!(gPose && gPose.orientation && gPose.position)) return; /* Pose is missing or incomplete, not much we can do! */
                var gpMat = mat4.create();
                // var orientation = gPose.orientation;
                // var position = gPose.
                if (window.vrDisplay.stageParameters) {
                    mat4.fromRotationTranslation(gpMat, gPose.orientation, gPose.position);
                    mat4.multiply(gpMat, vrDisplay.stageParameters.sittingToStandingTransform, gpMat);
                    
                    var ploc = scene.playerLocation;
                    var trans = vec3.fromValues(ploc.x, ploc.y, ploc.z);
                    var reloc = mat4.create();
                    mat4.fromTranslation(reloc, trans);
                    mat4.mul(gpMat, reloc, gpMat);
                    
                }
                for (var btnIdx=0; btnIdx<myGp.buttons.length; btnIdx++) {
                    var scratchPadKey = 'Button' + btnIdx + 'Down';
                    var prevState = drawable.scratchPad[scratchPadKey] || false;
                    var myButton = myGp.buttons[btnIdx];
                    var buttonStatus = (myButton.pressed ? 'down' : 'up');
                    if (myButton.pressed != prevState) {
                        // console.debug(myGp);
                        buttonStatus = (myButton.pressed ? 'pressed' : 'released')
                        drawable.scratchPad[scratchPadKey] = myButton.pressed;
                        // console.log('Button ', btnIdx, buttonStatus, 'on gamepad', gamepadIndex);
                    }
                    else if (myButton.pressed) {
                        buttonStatus = 'held';
                        // console.log('Button ', btnIdx, buttonStatus, 'on gamepad', gamepadIndex);
                    }
                    
                    drawable.scratchPad['trackpadAxes'] = myGp.axes;
                    if (btnIdx == 0 && myButton.touched) {
                        var sector;
                        // var a = myGp.axes[0]<0,
                        //     b = myGp.axes[0]>0,
                        //     c = myGp.axes[1]<0,
                        //     d = myGp.axes[1]>0;
                        var a = -0.5 < myGp.axes[0] < 0.5, 
                            b = myGp.axes[0] < -0.5 || myGp.axes[0] > 0.5, 
                            c = -0.5 < myGp.axes[1] < 0.5, 
                            d = myGp.axes[1] < -0.5 || myGp.axes[1] > 0.5;
                        if (!a && !b && !c && !d) {
                            sector = 'center';
                        }
                        else if (!a && !b && c && d) {
                            sector = 's';
                        }
                        else if (a && b && c && d) {
                            sector = 'sw';
                        }
                        else if (a && b && !c && !d) {
                            sector = 'w';
                        }
                        else if (a && b && !c && d) {
                            sector = 'nw';
                        }
                        else if (!a && !b && !c && d) {
                            sector = 'n';
                        }
                        else if (!a && b && !c && d) {
                            sector = 'ne';
                        }
                        else if (!a && b && !c && !d) {
                            sector = 'e';
                        }
                        else if (!a && b && c && d) {
                            sector = 'se';
                        }
                        drawable.scratchPad['trackpadSector'] = sector;
                        // console.log(sector);
                    }
                    
                    if (buttonHandler) {
                        var extra = {drawable: drawable, gamepad: myGp, sector: sector, buttonRaw: myButton};
                        buttonHandler(gamepadIndex, btnIdx, buttonStatus, sector, myButton, extra);
                    }
                    
                }
                // drawable.pos = {x:gPose.position[0], y:gPose.position[1], z:gPose.position[2]};
                // drawable.orientation = {x:gPose.orientation[0], y:gPose.orientation[1], z:gPose.orientation[2]};
                if (drawable.rotation || drawable.translation) {
                    // console.log(drawable.orientation);
                    // var finalMatrix = mat4.create(finalMatrix);
                    var ori = drawable.rotation || {x:0, y:0, z:0};
                    var tra = drawable.translation || {x:0, y:0, z:0};
                    // var finalMatrix = mat4.create();
                    // mat4.copy(finalMatrix, gpMat);
                    // mat4.rotateX(finalMatrix, finalMatrix, ori.x);
                    // mat4.rotateY(finalMatrix, finalMatrix, ori.y);
                    // mat4.rotateZ(finalMatrix, finalMatrix, ori.z);
                    // drawable.matrix = finalMatrix;
                    
                    var transmat = mat4.create();
                    var finalmat = mat4.create();
                    var rot = quat.create();
                    quat.rotateX(rot, rot, ori.x);
                    quat.rotateY(rot, rot, ori.y);
                    quat.rotateZ(rot, rot, ori.z);
                    var trl = vec3.fromValues(tra.x, tra.y, tra.z);
                    mat4.fromRotationTranslation(transmat, rot, trl);
                    mat4.mul(finalmat, gpMat, transmat);
                    drawable.matrix = finalmat;
                }
                    
                //     mat4.mul(finalMatrix, gpMat, drawable.orientation);
                //     drawable.matrix = finalMatrix;
                //
                // }
                else {
                    drawable.matrix = gpMat;
                    
                }
            }
        }
        return trk;
        
    }
    
    var Color = {
        
    }
    

    /* We need a custom collider behaviour to add to (something) the drumhead, with these characteristics:
    /* - detect when hand ray solution for plane is at a specific distance, not too close, not too far
    /* - test point against all rects in the collider plane, this is how we implement "keys"
    */

    /* AssociatedObject is optional but very useful. If defined, the collider will use AssociatedObject's
    /* transformations on itself.
    */
    var PlanarCollider = function (planeDescription, associatedObject, params) {
        var p = params || {};
        var desc = planeDescription;
        this.planeNormal = vec3.fromValues(desc.planeNormal[0], desc.planeNormal[1], desc.planeNormal[2]);
        this.planePoint = vec3.fromValues(desc.pointOnPlane[0], desc.pointOnPlane[1], desc.pointOnPlane[2]);
        this.associatedObject = associatedObject;
        this.bracketDistanceMin = p.bracketDistanceMin || 0;   /* Discard collisions outside of  */
        this.bracketDistanceMax = p.bracketDistanceMax || 100; /*  0-100m by default             */
        this.features = []; /* List of things to be tested in the plane */
        this.collisionBoxes = [];
    }

    PlanarCollider.prototype.findRayCollision = function (testRayOrigin, testRayVec, bracketDist, ctxObj, debugObj) {
        var collider = this;
        var brkt = bracketDist || {};
        var bracketMax = brkt.max || 100;
        var bracketMin = brkt.min || -100;
        /* First, test if the ray collides with the plane in between the bracket distances. */
        /* If that collision exists, then test against the individual collisionBox features. */
        /* If collisionBox is set then find collision with the box.
        */
    
        var rayOrigin = vec3.fromValues(testRayOrigin.x, testRayOrigin.y, testRayOrigin.z); // vec3 l0
        var rayVector =  vec3.create();                 // vec3 l
        var pointOfInterest = null;                     // float t
    
        /* Set up the plane params and transform as necessary */
        var planeNormal = vec3.clone(collider.planeNormal);
        var pointOnPlane = vec3.clone(collider.planePoint);
        var transmat = null;
        if (collider.associatedObject) {
            var drawable = collider.associatedObject;
            transmat = drawable.transformationMatrix();
        
            var quW = quat.create();
            var orien = drawable.currentOrientation || drawable.orientation;
            quat.rotateX(quW, quW, orien.x);
            quat.rotateY(quW, quW, orien.y);
            quat.rotateZ(quW, quW, orien.z);
            vec3.transformQuat(planeNormal, planeNormal, quW);
        
            vec3.transformMat4(pointOnPlane, pointOnPlane, transmat);
        }
    
        /* pointOfInterest represents the distance along the vector at which collision occurs with the plane. */
        vec3.normalize(rayVector, testRayVec);
        vec3.normalize(planeNormal, planeNormal);
    
        var denom = vec3.dot(planeNormal, rayVector);
        var pointVsRay = vec3.create();
        vec3.subtract(pointVsRay, pointOnPlane, rayOrigin);
        var pointOfInterest = vec3.dot(pointVsRay, planeNormal) / denom;
    
        if (!(bracketMin <= pointOfInterest && pointOfInterest <= bracketMax)) return; 
    
        if (collider.collisionBoxes.length) {
            var collisionPoint = [
                testRayOrigin.x + (pointOfInterest*rayVector[0]), 
                testRayOrigin.y + (pointOfInterest*rayVector[1]), 
                testRayOrigin.z + (pointOfInterest*rayVector[2])
            ];
            for (var i=0; i<collider.collisionBoxes.length; i++) {
                var cbox = collider.collisionBoxes[i];
                var boxBL = vec3.clone(cbox.bottomLeft);
                var boxTR = vec3.clone(cbox.topRight);
                vec3.transformMat4(boxBL, boxBL, transmat);
                vec3.transformMat4(boxTR, boxTR, transmat);
            
                /* Don't rely on these to be the left, right, top etc. They're just abstract concepts */
                var colLeft, colRght, colTop, colBtm, colFrnt, colBack;
                colLeft = Math.min(boxBL[0], boxTR[0]);
                colRght = Math.max(boxBL[0], boxTR[0]);
                if (colRght - colLeft < 0.001) {
                    colLeft -= 0.002;
                    colRght += 0.002;
                }
                colBtm = Math.min(boxBL[1], boxTR[1]);
                colTop = Math.max(boxBL[1], boxTR[1]);
                if (colTop - colBtm < 0.001) {
                    colBtm -= 0.002;
                    colTop += 0.002;
                }
                colFrnt = Math.min(boxBL[2], boxTR[2]);
                colBack = Math.max(boxBL[2], boxTR[2]);
                if (colBack - colFrnt < 0.001) {
                    colFrnt -= 0.002;
                    colBack += 0.002;
                }
            
                if ((colLeft <= collisionPoint[0] && collisionPoint[0] <= colRght) 
                && (colBtm  <= collisionPoint[1] && collisionPoint[1] <= colTop)
                && (colFrnt <= collisionPoint[2] && collisionPoint[2] <= colBack)
                && pointOfInterest <= 0) {
                     // console.log('yep');
                     if (cbox.callback) {
                         cbox.callback(ctxObj); /* TODO what to put in here? */
                     }
                     return {idx: i, poi: pointOfInterest};
                }
            }
        
            /* DEBUG */
            if (debugObj) {
                debugObj.pointOfInterest = pointOfInterest;
                debugObj.collisionBoxInf = {
                    x: [colLeft, collisionPoint[0], colRght],
                    y: [colBtm, collisionPoint[1], colTop],
                    z: [colFrnt, collisionPoint[2], colBack],
                    collisionPoint: collisionPoint
                };
            }
        }
        else if (collider.callback) {
            var collisionPoint = [
                testRayOrigin.x + (pointOfInterest*rayVector[0]), 
                testRayOrigin.y + (pointOfInterest*rayVector[1]), 
                testRayOrigin.z + (pointOfInterest*rayVector[2])
            ];
            
            collider.callback({
                POI: pointOfInterest,
                collisionPoint: collisionPoint
            });
            // console.log('')
        }
        else {
            console.log('awef');
            
        }
        
    
    }



    var makeControllerRayProjector = function (scene, gpId, colliders) {
        var projector = function (drawable, timePoint) {
            var vrGamepads = FCUtil.getVRGamepads();
            // console.log('Got ', vrGamepads.length, 'VR gamepads from ', gamepads.length, 'total gamepads');
            if (vrGamepads.length && vrGamepads[gpId]) {
                var myGp = vrGamepads[gpId];
                var gPose = myGp.pose;
                var gpMat = mat4.create();
            
                var myPointerOrigin, myPointerVector;
            
                if (window.vrDisplay.stageParameters && gPose && gPose.orientation && gPose.position) {
                    mat4.fromRotationTranslation(gpMat, gPose.orientation, gPose.position);
                    mat4.multiply(gpMat, vrDisplay.stageParameters.sittingToStandingTransform, gpMat);
            
                    var ploc = scene.playerLocation;
                    var trans = vec3.fromValues(ploc.x, ploc.y, ploc.z);
                    var reloc = mat4.create();
                    mat4.fromTranslation(reloc, trans);
                    mat4.mul(gpMat, reloc, gpMat);
            
                }

                var finalTrans = vec3.create();
                mat4.getTranslation(finalTrans, gpMat);
                myPointerOrigin = {x: finalTrans[0], y: finalTrans[1], z: finalTrans[2]};
            
                var axes = vec3.fromValues(0, 0, 1);

                var roQuat = quat.create();
                mat4.getRotation(roQuat, gpMat);
                vec3.transformQuat(axes, axes, roQuat);
                myPointerVector = [axes[0], axes[1], axes[2]];
            
                scene.pointerVec = myPointerVector;
                scene.pointerOrigin = myPointerOrigin;
            
                if (colliders) {
                    // console.log('colliders?');
                    for (var i=0; i<colliders.length; i++) {
                        var collider = colliders[i];
                        // console.log(myPointerOrigin, myPointerVector);
                        var context = {gamepad: myGp};
                        var d = collider.findRayCollision(myPointerOrigin, myPointerVector, null, context);
                        // console.log(d);
                        if (d) {
                            updateReadout('D', d.idx);
                        }
                
                    }
                
                }
            }
        }
        return projector;
    }

    
    
    return {
        loadImageAsTextureAnd: loadImageAsTextureAnd,
        loadImagesAsTextures: loadImagesAsTextures,
        makeImageBoard: makeImageBoard,
        httpGet: httpGet,
        httpGetJSON: httpGetJSON,
        makeTextBoard: makeTextBoard,
        makeTextureFromCanvas: makeTextureFromCanvas,
        makeTextTexture: makeTextTexture,
        makeGamepadTracker: makeGamepadTracker,
        makeControllerRayProjector: makeControllerRayProjector,
        renderTextToTexture: renderTextToTexture,
        loadBoardsFromContentData: loadBoardsFromContentData,
        getVRGamepads: getVRGamepads,
        PlanarCollider: PlanarCollider
    };
    
})();