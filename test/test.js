function webGLStart() {
  var canvas = $('#canvas');

  var cube_faces = [
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
      1.0,  1.0,  1.0,
      1.0,  1.0, -1.0,
      1.0, -1.0,  1.0],
    // Left face
    [-1.0, -1.0, -1.0,
     -1.0, -1.0,  1.0,
     -1.0,  1.0, -1.0,
     -1.0,  1.0,  1.0]
  ];
  var pMatrix  = mat4.create(),
      mvMatrix = mat4.create(); // perspective and model-view matrix
  var uniforms; 
  var drawScene = SGL.init("canvas", "shader-fs", "shader-vs",
                     { clearColor: [ 0.0, 0.0, 0.0, 1.0 ],
                       attributes: { vertexPos: { value: cube_faces, itemSize: 3 } }
                      });
  var mbErr;

  mat4.perspective(45, canvas.width()/canvas.height(), 0.1, 100.0, pMatrix);
  mat4.identity(mvMatrix);
  // zoom out

  mat4.translate(mvMatrix, [0.0, 0.0, -7.0]);
  mat4.rotate(mvMatrix, Math.PI/4, [0,0,1]);
  mat4.rotate(mvMatrix, Math.PI/4, [0,1,0]);


  uniforms = { pMatrix: pMatrix, mvMatrix: mvMatrix,
               zoom: 2.5, panX: 0.0, panY: 0.0 };

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
}
