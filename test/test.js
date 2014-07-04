// Requires libraries
// - jQuery
// - glMatrix


function webGLStart() {
  var canvas = $('#canvas'),

      cube_faces = [
        // Back face
        [ -1.0,  1.0, -1.0,
          -1.0, -1.0, -1.0,
           1.0,  1.0, -1.0,
           1.0, -1.0, -1.0
        ],
        // Front face
        [ -1.0,  1.0,  1.0,
          -1.0, -1.0,  1.0,
           1.0,  1.0,  1.0,
           1.0, -1.0,  1.0,
        ],
        // Top face
        [ -1.0,  1.0,  1.0,
          -1.0,  1.0, -1.0,
           1.0,  1.0,  1.0,
           1.0,  1.0, -1.0 ],
        // Bottom face
        [-1.0, -1.0, -1.0,
          1.0, -1.0, -1.0,
         -1.0, -1.0,  1.0,
          1.0, -1.0,  1.0],
        // Right face
         [1.0, -1.0, -1.0,
          1.0,  1.0, -1.0,
          1.0, -1.0,  1.0,
          1.0,  1.0,  1.0],
        // Left face
        [-1.0, -1.0, -1.0,
         -1.0, -1.0,  1.0,
         -1.0,  1.0, -1.0,
         -1.0,  1.0,  1.0]
      ],
      pMatrix  = mat4.create(),
      mvMatrix = mat4.create(), // perspective and model-view matrix
      uniforms, sglContext;

  // Set up matrices. mat4 object comes from glMatrix library
  mat4.perspective(45, canvas.width()/canvas.height(), 0.1, 100.0, pMatrix);
  mat4.identity(mvMatrix);

  // Zoom out
  mat4.translate(mvMatrix, [0.0, 0.0, -7.0]);
  // Rotate
  mat4.rotate(mvMatrix, Math.PI/4, [0,0,1]);
  mat4.rotate(mvMatrix, Math.PI/4, [0,1,0]);

  sglContext = SGL.init("canvas", "shader-fs", "shader-vs",
                      { clearColor: [ 0.0, 0.0, 0.0, 1.0 ],
                        attributes: { vertexPos: { value: cube_faces, itemSize: 3 } }
                      });

  if (SGL.isError(sglContext)) {
    alert(sglContext.msg);
    return;
  }

  var drawSceneWrapper = function(uniforms) {
    var mbErr;
    mbErr = sglContext.drawScene(uniforms);
    if (SGL.isError(mbErr)) { alert(mbErr.msg); }
  }

  var step = function(time) {
    mat4.rotate(mvMatrix, 0.02, [0,1,0]); // spin on on two axis at different rates.
    mat4.rotate(mvMatrix, -0.03, [-1,0,1]);
    uniforms = { pMatrix: pMatrix, mvMatrix: mvMatrix };
    drawSceneWrapper(uniforms);
    if (true) {
      requestAnimationFrame(step);
    } else {
      SGL.cleanUp(sglContext);
    }
  }

  requestAnimationFrame(step);


}
