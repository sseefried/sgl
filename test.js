function makeKeyHandler(drawScene, uniforms) {
  return function(e) {
    var key = e.which;
    var panInc = 0.05;
    var zoomFactor = 1.1;


    if (key===61||key===43) {
      uniforms.zoom /= zoomFactor;
    }

    if (key===45||key==95) {
      uniforms.zoom *= zoomFactor;
    }

    // W
    if (key===119) {
      uniforms.panY -= panInc;
    }

    // A
    if (key===97) {
       uniforms.panX += panInc;
    }

    // S
    if (key===115) {
      uniforms.panY += panInc;
    }

    // D
    if (key===100) {
       uniforms.panX -= panInc;
    }
    drawScene(uniforms);
  }
}

function webGLStart() {
  var canvas = $('#canvas');
  var vertices = SGL.mesh2D(1,2); // FIXME: 2 should be 1 perhaps? 1 is the width of the viewport?
  var uniforms = { zoom: 1.0, panX: 0.0, panY: 0.0 };
  var drawScene = SGL.init("canvas", "shader-fs", "shader-vs",
                     { clearColor: [0.0,0.0,0.0,1.0],
                       attributes: { vertexPos: { value: vertices, itemSize: 2 } }
                      });
  var mbErr;

  if (SGL.isError(drawScene)) {
    alert(drawScene.msg);
    return;
  }

  var drawSceneWrapper = function(uniforms) {
    var mbErr;
    mbErr = drawScene(uniforms);
    if (SGL.isError(mbErr)) { alert(mbErr.msg); }
  }

  drawSceneWrapper(uniforms);

  $('body').keypress(makeKeyHandler(drawSceneWrapper, uniforms));
}
