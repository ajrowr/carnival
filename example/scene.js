/* Very simple example scene. */

window.ExampleScene = (function () {
    "use strict";
    
    function Scene() {
        /* Declare any class and instance vars unique to this scene, here. */
        FCScene.call(this);
    }
    
    Scene.prototype = Object.create(FCScene.prototype);
    
    /* Scene setup occurs in two phases - setupPrereqs and setupScene. */
    /* These are called by and via the FCScene superclass at the appropriate times, you just need to implement the methods. */
    
    /* setupPrereqs returns a Promise and is intended for prerequisites that the scene needs to set up */
    /* successfully. Generally speaking, if you have things that will take time to load (eg assets like textures, 
    /* models, shaders) and/or occurs asynchronously you should set them up in setupPrereqs. For consistency's sake, */
    /* setupPrereqs is a good place for *all* texture, model and shader fabrication, even if it's synchronous. */
    
    /* In this we will use a few assets from Looksy to get you started. */
    Scene.prototype.setupPrereqs = function () {
        var scene = this;
        var prereqPromises = [];
        
        /* To make it easy to refer to things, we assign labels on things like textures, objects, shaders etc. */
        /* FCScene maintains hashes of these things so that they can easily be retrieved by referencing the */
        /* label. This is optional but very useful for objects which will be referred to frequently and/or by */
        /* different parts of the code. */
        /* Any of the scene.addX methods support labels. The general pattern is arg0=core_data_for_asset, arg1=label */
        
        return new Promise(function (resolve, reject) {
            
            /* Synchronous things */
            scene.addTextureFromColor({r:0.1, g:0.2, b:0.6, a:1.0}, 'royalblue'); /* label is "royalblue" */
            scene.addTextureFromColor({hex:'#10991f'}, 'green'); /* label is "green" */
            
            /* Asynchronous things */
            prereqPromises.push(scene.addTextureFromImage('assets/grassygrass01.jpg', 'grass01')); /* label is "grass01" */
            prereqPromises.push(scene.addTextureFromImage('assets/concrete01.jpg', 'concrete01')); /* label is "concrete01" */
            prereqPromises.push(scene.addModelSource('assets/controlleresque.stl', 'controlleresque')); /* label is "controlleresque" */
            prereqPromises.push(scene.addModelSource('assets/meta4.stl', 'meta4logotype')); /* .... ok, you get the idea */
            
            /* Shaders are a little more complex. arg3 is a description of the attribute args that the GLSL shader can accept. */
            /* Unless you're writing your own shaders (and building your own primitives), you can pretty much just copy */ 
            /* and paste these. */
            prereqPromises.push(scene.addShaderFromUrlPair(
                'assets/basic.vs', 'assets/basic.fs', 'basic', {
                    position: 0,
                    texCoord: 1,
                    vertexNormal: 2
                }
            ));
            prereqPromises.push(scene.addShaderFromUrlPair(
                'assets/diffuse2.vs', 'assets/diffuse2.fs', 'diffuse', {
                    position: 0,
                    texCoord: 1,
                    vertexNormal: 2
                }
            ));
            /* NB. I intend on making at least enough shaders for most common use cases. */
            /* Labels here are "basic" and "diffuse" respectively and we'll be using them a lot. */
            /* Basic shader supports textures but no lighting. Diffuse shader supports textures and lighting. */
            
            /* If you don't know about Promises you should really read up on them. They're incredibly useful and */
            /* not actually that complicated. */
            Promise.all(prereqPromises).then(function () {
                resolve();
            });
        })
    }
    
    /* setupScene performs the actual construction of the scene and is only called if and when the setupPrereqs 
    /* promise resolve()s. */
    /* Therefore we can rely on all the prerequisites having been loaded. */
    
    Scene.prototype.setupScene = function () {
        var scene = this;
        var DEG=360/(2*Math.PI); /* Conversion factor from degrees to radians. Very useful */
        var _hidden_beneath_floor = {x:0, y:-3.5, z:0}; /* For things whose positions will update programmatically */
                                                        /* eg controllers */
        
        /* Let's add a really simple floor. Basically just a big flat plane, textured on the side that faces up. */
        var floorInfo = {
            /* Center it at the origin */
            location: {x: 0, z: 0, y: 0},
            /* Different primitives accept size info in different ways. This is 12m in each direction of modelspace origin */
            /* Check the source code of the various primitives for more info */
            size: {minX: -12, maxX: 12, minY: -12, maxY: 12}, 
            /* We're using WallShape which is vertical by default. 270 rotates it to horizontal. */
            /* Why not 90? 90 would make it face downwards. We need it to face upwards or it'll be invisible due */
            /* to backface culling. We'll use 90 for the ceiling. */
            orientation: {x:270/DEG, y:0, z:0} 
        }
        scene.addObject(new FCShapes.WallShape(
            floorInfo.location,
            floorInfo.size,
            floorInfo.orientation,
            {
                /* This is where the labels start to come in really handy! */
                label: 'floor', 
                textureLabel: 'concrete01', /* You can also use: texture: scene.textures.concrete01 ... if you want */
                shaderLabel: 'basic', 
                /* Segments is for texturing. When using a tiling texture each segment gets one copy of the tex. */
                /* Works great with tiled textures. */
                /* Concrete01 is however not a tiled texture so it will be super obvious when you look at it. :) */
                segmentsX: 12, 
                segmentsY: 12
            }
        ));
        
        /* Notice that we didn't keep a reference to this object. That's fine. We can retrieve it anytime we want */
        /* with scene.getObjectByLabel('floor'); */
        
        /* Speaking of which, it's good practise to pass texture and shader objects only when you need to, and instead */
        /* use labels for most purposes. Why? Labels are intended to make things portable. You may not always have 
        /* access to the scene object, for instance. */
        /* When would you set textures directly? When a texture is a throwaway thing that you know you won't */
        /* need again, or it is likely to get overwritten or updated - eg if you're displaying some */
        /* informative contextual text by making it into a texture (more on that later) then it will probably get */
        /* replaced at some point with some other text. In which case a label just isn't useful since the texture is */
        /* a throwaway anyway - giving it a label can actually be harmful since it prevents it from getting garbage- */
        /* collected. */
        /* Rule of thumb: any texture you'll refer to again, give it a label. Otherwise use null. */
        
        /* Now let's make a "raft", IE a piece of floor that equates to the player's room-scale play area. */
        scene.addObject(new FCShapes.GroundedCuboid(
            {x: 0, z: 0, y: 0},
            {w: scene.stageParams.sizeX, d: scene.stageParams.sizeZ, h: 0.01},
            null,
            {label: 'raft', textureLabel: 'grass01', shaderLabel: 'basic'}
        ));
        
        
        /* Controller models */
        
        /* For this we're using models loaded from an STL file so we have to make a few modelspace adjustments */
        /* before they make sense. */
        var ctrlInfo = {
            src: scene.modelSources.controlleresque,
            /* This is a model-space translation. Basically placing it "in" your hand instead of floating near it */
            translate: {x:0.00, y:-0.016, z:0.15},
            /* Vive room-scale uses units like 1.0 => 1 metre. The modelling software has different units so we scale. */
            size: {scale:0.01},
            /* Rotate the model to the correct orientation */
            rotate: {x:0/DEG, y:180/DEG, z:90/DEG}, 
            /* We'll be using diffuse rather than basic shaders for this, so the colours are specified differently. */
            /* Instead of being a texture fabricated from a colour, these will be used as inputs to the shader program. */
            greenColor: scene.addTextureFromColor({r:0.2, g:0.9, b:0.6}),
            blueColor: scene.addTextureFromColor({r:0.2, g:0.6, b:0.9})
        };
        
        /* To correctly position and orient an object, we need to transform it in both model-space and world-space. */
        /* World-space transformations represent "where" the object is and which way it's facing. */
        /* Model-space transformations are transformations made to get the model to a sensible base for the world-space */
        /* transforms to happen. */
        /* For instance these controller models were made in OpenSCAD and they start at 0,0,0 and extend in all 3 axes */
        /* in the +ve direction. But we want them centered on the location provided by WebVR, so the model-space transform */
        /* is what we use to center them. */
        /* obj.translation and obj.rotation represent the model-space transformations. */
        /* obj.pos and obj.orientation represent the world-space transforms. */
        var ctrl1 = new FCShapes.LoaderShape(
            ctrlInfo.src,
            _hidden_beneath_floor, /* Hide it under the floor. This position will be overridden */
            ctrlInfo.size,
            null,
            {
                shaderLabel: 'diffuse',
                texture: ctrlInfo.greenColor,
                groupLabel: 'controllerTrackers'
            }
            
        );
        ctrl1.translation = ctrlInfo.translate;
        ctrl1.rotation = ctrlInfo.rotate;
        
        /* Behaviours are a way of attaching functions to an object that get run every time that object */
        /* is drawn. */
        /* makeGamepadTracker is a handy util that generates a behaviour to make an object track a */
        /* controller. */
        ctrl1.behaviours.push(FCUtil.makeGamepadTracker(
            scene, 
            0,          /* The controller ID. Note that if we want to discern left- and right-handedness, that's */
                        /* our job; the engine doesn't do it for us. I usually just make the controllers visually */
                        /* distinct and then talk in terms of (eg) the "green controller" or the "blue controller" */
            
            null        /* This is where we can optionally pass in a button handling function which the behaviour */
                        /* will call when buttons are pressed on the controller. We'll go into that later. */
        ));
        scene.addObject(ctrl1);
        
        /* And now we have a green controller in the scene which tracks spatial movement of the actual controller. */
        /* Now let's add a blue one which does some things when you press the buttons. */
        
        /* Sorry about my controller models. They're a work in progress. OpenSCAD seems to generate pretty quirky vertex */
        /* normals on STL export, and yes, they really do look more like bottle openers than Vive controllers. ¯\_(ツ)_/¯ */
        
        /* A logotype to test model-space transforms */
        // var _logoScale = 1/20;
        // var logo = new FCShapes.LoaderShape(
        //     scene.modelSources.meta4logotype,
        //     {x:2, y:1, z:4},
        //     {scale:_logoScale},
        //     {x:0, y:-180/DEG, z:0},
        //     {
        //         textureLabel: 'royalblue',
        //         shaderLabel: 'diffuse',
        //         // baseColor: {r:0.7, g:0.3, b:0.2},
        //         label: 'logotype'
        //     }
        // );
        // logo.translation = {x:-16.0*_logoScale, y:0, z:0};
        // logo.rotation = {x:20/DEG, y:45/DEG, z:0};
        // scene.addObject(logo);
        
        
        /* Let's add some cubes into the scene because cubes are fun. */
        // var cubeCount = 20;
        // var cubeDistance = 1.5*Math.max(scene.stageParams.sizeX, scene.stageParams.sizeZ);
        // var anglePerCube = (2*Math.PI)/cubeCount; /* Radians */
        // for (var i=0; i<cubeCount; i++) {
        //     for (var j=0; j<2; j++) {
        //         var dist = cubeDistance + (0.5*j);
        //         var cubeAngle = i*anglePerCube;
        //         scene.addObject(new FCShapes.Cuboid(
        //             {x:dist*Math.cos(cubeAngle), y:0, z:dist*Math.sin(cubeAngle)}, /* Position */
        //             {w:0.25, h:0.25, d:0.25}, /* Size */
        //             {x:0, y:-1*cubeAngle, z:0}, /* Rotation */
        //             {
        //                 shaderLabel: 'diffuse'
        //             }
        //         ));
        //     }
        //
        // }
        
        /* Let's add some cubes with a practical purpose. We'll get them to show their own coordinates so we */
        /* can get an idea of the spatial dimensions. */
        /* To do this we will paint them with text textures. */
        /* Let's also colour them so as to reflect their location in space - correlating X with R, Y with G and Z with B. */
        /* To do this we'll introduce not only text textures but also objects with multiple faces. */
        /* We'll use a primitive called BoardCuboids for this - a cuboid with 3 faces, "front" (representing the front), */
        /* "caption" representing a small caption (which we won't use) which hovers in front of the front, and "other" */
        /* (representing all the other faces). */
        /* Note that having a lot of multi-faced objects in a scene can cause significant drops in performance. */
        /* Side note: BoardCuboids are what Looksy uses for its image boards. */
        
        var colorFactor = function (v) {
            return (1.0/24)*(12+v);
        };
        for (var i=-12; i<=12; i+=6) {
            for (var j=-12; j<=12; j+=6) { /* This is Y so keep things above the floor */
                for (var k=-12; k<=12; k+=6) {
                    var myPos = {x:i, y:j+12, z:k};
                    // if 
                    var newCube = new FCShapes.BoardCuboid(
                        myPos,
                        {w:0.9, h:0.9 ,d:0.9},
                        {x:0, y: -90/DEG + (-1*Math.atan2(myPos.z, myPos.x)), z:0}, /* Rotate to face origin */
                        {
                            shaderLabel: 'diffuse',
                            texture: scene.addTextureFromColor({r:colorFactor(i), g:colorFactor(j), b:colorFactor(k)}),
                            groupLabel: 'gridCubes'
                        }
                    );
                    /* Normally object faces inherit textures etc from the parent object if not given textures of their own. */
                    /* But we want to suppress display of the caption face rather than have it inherit a texture. To do this */
                    /* we set noTexture on the face. */
                    newCube.faces.caption.noTexture = true; 
                    
                    /* renderTextToTexture uses sensible defaults where it can so all it really needs to know is the */
                    /* text in each block, and the canvas dimensions (since it can't guess the proportions). */
                    /* It does accept a bunch of args for each block though, check it out in fc_util.js for more info */
                    newCube.faces.front.texture = FCUtil.renderTextToTexture(scene.gl,
                        [
                            {t:'x: '+myPos.x},
                            {t:'y: '+myPos.y},
                            {t:'z: '+myPos.z}
                        ],
                        {
                            /* This is the size of the canvas used for text rendering. Bigger canvas => smaller text */
                            canvasWidth: 120, canvasHeight: 120 
                        }
                    );
                    scene.addObject(newCube);
                }
            }
        }
        
        /* Let's build a button handler for the blue controller. */
        /* Whenever the trigger is pressed a cube will be created at the controller's current location. */
        /* NB the button handlers are due for an upgrade. The current ones can't handle multiple buttons at */
        /* a time - the handler gets called once for each button, so anything that depends on a combination */
        /* of buttons is not directly catered for. You do get a ref to the raw gamepad data via extra.gamepad */
        /* so you can fudge it, but it's hackish. Fixing this is high on my priority list! */
        /* When I do fix this, the API will change, so be ready for that. */
        var buttonHandler = function (controllerIndex, buttonIndex, buttonStatus, trackpadSector, buttonRaw, extra) {
            if (buttonIndex == 1 && buttonStatus == 'pressed') {
                var hand = scene.playerSpatialState.hands[1]; /* playerSpatialState gets updated regularly by the engine */
                var cube = new FCShapes.SimpleCuboid(
                    hand.pos,
                    {w: 0.2, h:0.2, d:0.2},
                    hand.ori,
                    {textureLabel: 'green', shaderLabel: 'diffuse'}
                );
                scene.addObject(cube);
            }
        }
        
        var ctrl2 = new FCShapes.LoaderShape(
            ctrlInfo.src,
            _hidden_beneath_floor, /* Hide it under the floor. This position will be overridden */
            ctrlInfo.size,
            null,
            {
                shaderLabel: 'diffuse',
                texture: ctrlInfo.blueColor,
                groupLabel: 'controllerTrackers'
            }
            
        );
        ctrl2.translation = ctrlInfo.translate;
        ctrl2.rotation = ctrlInfo.rotate;
        ctrl2.behaviours.push(FCUtil.makeGamepadTracker(scene, 1, buttonHandler));
        scene.addObject(ctrl2);
        
        /* Aaaand that's it for now... */
    }
    
    return Scene;
})();
