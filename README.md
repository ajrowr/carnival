# Carnival

A Javascript framework for WebVR.

The goal of Carnival is to make it easy to get up and running quickly with making simple, data-driven WebVR apps. Don't think of it as a 3D engine (though it does include one - albeit so far quite a primitive one) or a game development framework (though you probably could build a simple game in it). I think of it as an object-driven scene visualiser. In time I want to be able to think of it as a rapid application development framework for WebVR.

Carnival is in a very early stage of development; you could probably say pre-alpha. You can build simple things with it right now, and as the project progresses the scope will expand. At this time it consists of the following modules:

`lib/fc_scene.js` - contains the FCScene superclass and most of the rendering machinery.  
`lib/fc_engine.js` - provides the glue between the scene and the browser.  
`lib/fc_util.js` - a bunch of handy utilities.  
`lib/fc_primitives.js` - some basic 3d model shapes and mechanisms for loading models (currently just ASCII STL, more formats planned).  
`lib/fc_feedtools.js` - tools for connecting to and integrating with data feeds.  

Note that this structure is subject to change.

## Getting started

Best way to get started is to have a look in the "example" folder. There's a heavily commented `scene.js` file and an `index.html` that loads it. You should be able to clone it and run it from your local filesystem.

Generally speaking, the normal way to proceed is to subclass `FCScene` and implement (at the very least) the `setupScene` method and (most likely) the `setupPrereqs` method, each of which will be run by `fc_engine` at the appropriate time. `setupPrereqs` is used to manage asynchronous loading of textures, shaders, models etc and ensures that `setupScene` is only called once these loads are completed. `setupScene` is used to create objects, attach behaviours to them and add them to the scene. Once `setupScene` is complete, the objects you added will render continuously and execute the attached behaviours on each render cycle. They can be manipulated via scripts and via the console.

The example code will show you how this all works, and walk through a few of the various types of objects you can use and different ways of using them, including how to attach event-driven code to the Vive hand controllers.

I will be putting together more docs but, for now, the comments in the code should give you a good head start! Any questions please email me - alan@codex.cx - or tweet me - @ajrowr . I'm friendly and helpful :)
