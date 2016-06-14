(function () {
"use strict";

var PLAYER_HEIGHT = 1.82;

var vrDisplay = null;
var projectionMat = mat4.create();
var viewMat = mat4.create();
var poseMat = mat4.create();
var standingPosition = vec3.create();
var orientation = [0, 0, 0];
var position = [0, 0, 0];

var vrPresentButton = null;

var webglCanvas = document.getElementById('webgl-canvas');
var gl = null;
var scene = null;

function initWebGL(preserveDrawingBuffer, stageParameters) {
    var glAttribs = {
        alpha: false,
        antialias: true,
        preserveDrawingBuffer: preserveDrawingBuffer
    };
    gl = webglCanvas.getContext("webgl", glAttribs);
    gl.clearColor(0.1, 0.4, 0.2, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    
    var sceneClass = window.sceneClass || FCScene;
    if (window.vrScene) {
        window.vrScene.init(gl, stageParameters);
        window.vrScene.setup();
        window.vrScene.isRendering = true;
    }

    window.addEventListener('resize', onResize, false);
    onResize();
    window.requestAnimationFrame(onAnimationFrame);
}
        
// var presentingMessage = document.getElementById("presenting-message"); //



/* ---------------- */
function onVRRequestPresent () {
  // This can only be called in response to a user gesture.
  vrDisplay.requestPresent([{ source: webglCanvas }]).then(function () {
    // Nothing to do because we're handling things in onVRPresentChange.
  }, function () {
    VRSamplesUtil.addError("requestPresent failed.", 2000);
  });
}

function onVRExitPresent () {
  vrDisplay.exitPresent().then(function () {
    // Nothing to do because we're handling things in onVRPresentChange.
  }, function () {
    VRSamplesUtil.addError("exitPresent failed.", 2000);
  });
}

function onVRPresentChange () {
  // When we begin or end presenting, the canvas should be resized to the
  // recommended dimensions for the display.
  onResize();

  if (vrDisplay.isPresenting) {
    if (vrDisplay.capabilities.hasExternalDisplay) {
      // Because we're not mirroring any images on an external screen will
      // freeze while presenting. It's better to replace it with a message
      // indicating that content is being shown on the VRDisplay.
      // presentingMessage.style.display = "block";

      // On devices with an external display the UA may not provide a way
      // to exit VR presentation mode, so we should provide one ourselves.
      // VRSamplesUtil.removeButton(vrPresentButton);
      // vrPresentButton = VRSamplesUtil.addButton("Exit VR", "E", "../cardboard64.png", onVRExitPresent);
    }
  } else {
    // If we have an external display take down the presenting message and
    // change the button back to "Enter VR".
    if (vrDisplay.capabilities.hasExternalDisplay) {
      // presentingMessage.style.display = "";

      // VRSamplesUtil.removeButton(vrPresentButton);
      // vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "../cardboard64.png", onVRRequestPresent);
    }
  }
}


function onResize () {
  if (vrDisplay && vrDisplay.isPresenting) {
    // If we're presenting we want to use the drawing buffer size
    // recommended by the VRDevice, since that will ensure the best
    // results post-distortion.
    var leftEye = vrDisplay.getEyeParameters("left");
    var rightEye = vrDisplay.getEyeParameters("right");

    // For simplicity we're going to render both eyes at the same size,
    // even if one eye needs less resolution. You can render each eye at
    // the exact size it needs, but you'll need to adjust the viewports to
    // account for that.
    webglCanvas.width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2;
    webglCanvas.height = Math.max(leftEye.renderHeight, rightEye.renderHeight);
  } else {
    // We only want to change the size of the canvas drawing buffer to
    // match the window dimensions when we're not presenting.
    webglCanvas.width = webglCanvas.offsetWidth * window.devicePixelRatio;
    webglCanvas.height = webglCanvas.offsetHeight * window.devicePixelRatio;
  }
}
// window.addEventListener("resize", onResize, false);
// onResize();

function getPoseMatrix (out, pose) {
  orientation = pose.orientation;
  position = pose.position;
  if (!orientation) { orientation = [0, 0, 0, 1]; }
  if (!position) { position = [0, 0, 0]; }

  if (vrDisplay.stageParameters) {
    // If the headset provides stageParameters use the
    // sittingToStandingTransform to transform the pose into a space where
    // the floor in the center of the users play space is the origin.
    mat4.fromRotationTranslation(out, orientation, position);
    mat4.multiply(out, vrDisplay.stageParameters.sittingToStandingTransform, out);
  } else {
    // Otherwise you'll want to translate the view to compensate for the
    // scene floor being at Y=0. Ideally this should match the user's
    // height (you may want to make it configurable). For this demo we'll
    // just assume all human beings are 1.65 meters (~5.4ft) tall.
    vec3.add(standingPosition, position, [0, PLAYER_HEIGHT, 0]);
    mat4.fromRotationTranslation(out, orientation, standingPosition);
  }
}


function renderSceneView (poseInMat, eye, pov) {
  if (eye) {
    mat4.translate(viewMat, poseInMat, eye.offset);
    mat4.perspectiveFromFieldOfView(projectionMat, eye.fieldOfView, 0.1, 1024.0);
    mat4.invert(viewMat, viewMat);
  } else {
    mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
    mat4.invert(viewMat, poseInMat);
  }

  window.vrScene.render(projectionMat, viewMat, pov);
}

function onAnimationFrame (t) {
  // stats.begin();
  if (!gl) return;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!window.vrScene) {
      var err = 'No scene was found in window.vrScene';
      if (window.showError) {
          window.showError(err);
      }
      else {
          console.log(err);
      }
  }

  if (vrDisplay) {
    // When presenting content to the VRDisplay we want to update at its
    // refresh rate if it differs from the refresh rate of the main
    // display. Calling VRDisplay.requestAnimationFrame ensures we render
    // at the right speed for VR.
    vrDisplay.requestAnimationFrame(onAnimationFrame);
    
    // var vrGamepads = [];
    // var gamepads = navigator.getGamepads();
    // for (var i=0; i<gamepads.length; ++i) {
    //     var gamepad = gamepads[i];
    //     if (gamepad && gamepad.pose) {
    //         vrGamepads.push(gamepad);
    //         for (var j=0; j < gamepad.buttons.length; ++j) {
    //             if (gamepad.buttons[j].pressed) {
    //                 console.log('Button '+j+' pressed');
    //                 console.debug(gamepad);
    //             }
    //         }
    //     }
    // }

    // As a general rule you want to get the pose as late as possible
    // and call VRDisplay.submitFrame as early as possible after
    // retrieving the pose. Do any work for the frame that doesn't need
    // to know the pose earlier to ensure the lowest latency possible.
    var pose = vrDisplay.getPose();
    getPoseMatrix(poseMat, pose);
    
    /* let's try relocating the player */
    /* If scene.playerLocation is updated, here's how we notice it */
    var ploc = window.vrScene.playerLocation;
    var trans = vec3.fromValues(ploc.x, ploc.y, ploc.z);
    var reloc = mat4.create();
    mat4.fromTranslation(reloc, trans);
    // console.debug(reloc);
    mat4.mul(poseMat, reloc, poseMat);
    /* ... */

    if (vrDisplay.isPresenting) {
      // When presenting render a stereo view.
      gl.viewport(0, 0, webglCanvas.width * 0.5, webglCanvas.height);
      renderSceneView(poseMat, vrDisplay.getEyeParameters("left"), 'left_eye');

      gl.viewport(webglCanvas.width * 0.5, 0, webglCanvas.width * 0.5, webglCanvas.height);
      renderSceneView(poseMat, vrDisplay.getEyeParameters("right"), 'right_eye');

      // If we're currently presenting to the VRDisplay we need to
      // explicitly indicate we're done rendering and inform the
      // display which pose was used to render the current frame.
      vrDisplay.submitFrame(pose);
    } else {
      // When not presenting render a mono view that still takes pose into
      // account.
      gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
      renderSceneView(poseMat, null);
      // stats.renderOrtho();
    }
  } else {
    window.requestAnimationFrame(onAnimationFrame);

    // No VRDisplay found.
    gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
    mat4.perspective(projectionMat, Math.PI*0.4, webglCanvas.width / webglCanvas.height, 0.1, 1024.0);
    mat4.identity(viewMat);
    mat4.translate(viewMat, viewMat, [0, -PLAYER_HEIGHT, 0]);
    scene.render(projectionMat, viewMat);

    // stats.renderOrtho();
  }

  // stats.end();
}

if (navigator.getVRDisplays) {
  navigator.getVRDisplays().then(function (displays) {
    if (displays.length > 0) {
      vrDisplay = displays[0];
      window.vrDisplay = vrDisplay; /* TODO find a nicer way */
      
      initWebGL(true, vrDisplay.stageParameters);
      
      // if (vrDisplay.stageParameters &&
      //     vrDisplay.stageParameters.sizeX > 0 &&
      //     vrDisplay.stageParameters.sizeZ > 0) {
      //         scene.
      //     }
      
      // VRSamplesUtil.addButton("Reset Pose", "R", null, function () { vrDisplay.resetPose(); });

      // Generally, you want to wait until VR support is confirmed and
      // you know the user has a VRDisplay capable of presenting connected
      // before adding UI that advertises VR features.
      if (vrDisplay.capabilities.canPresent)
        // vrPresentButton = VRSamplesUtil.addButton("Enter VR", "E", "../cardboard64.png", onVRRequestPresent);

      // The UA may kick us out of VR present mode for any reason, so to
      // ensure we always know when we begin/end presenting we need to
      // listen for vrdisplaypresentchange events.
      window.addEventListener('vrdisplaypresentchange', onVRPresentChange, false);
      
      // /* CHEEKY ... automatically launch VR mode if possible */
      // window.addEventListener('load', function () {
      //     console.log('onLoad triggered');
      vrDisplay.requestPresent([{ source: webglCanvas }]); /* SERIOUSLY this could be fragile */
      // });
      // console.debug(window.onload);
      
      
    } else {
      // VRSamplesUtil.addInfo("WebVR supported, but no VRDisplays found.", 3000);
    }
  });
} else if (navigator.getVRDevices) {
  // VRSamplesUtil.addError("Your browser supports WebVR but not the latest version. See <a href='http://webvr.info'>webvr.info</a> for more info.");
} else {
  // VRSamplesUtil.addError("Your browser does not support WebVR. See <a href='http://webvr.info'>webvr.info</a> for assistance.");
}
        
window.requestAnimationFrame(onAnimationFrame);
})();
