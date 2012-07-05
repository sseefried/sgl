/*
 * 
 *
 * List of things that can go wrong.
 *   a) canvas doesn't exist
 *   b) fragement sahder doesn't exist
 *   c) vertex shader doesn't exist
 */
var SGL = (function() {

  function initGL(canvasId) {
    var gl, canvas = document.getElementById(canvasId);
    try {
       gl = canvas.getContext("experimental-webgl");
       gl.viewportWidth = canvas.width;
       gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
       alert("Could not initialise WebGL, sorry :-(");
    }
    return gl;
  }

  function getShader(gl, id) {
     var shaderScript = document.getElementById(id);
     if (!shaderScript) {
         return null;
     }

     var str = "";
     var k = shaderScript.firstChild;
     while (k) {
         if (k.nodeType == 3) {
             str += k.textContent;
         }
         k = k.nextSibling;
     }

     var shader;
     if (shaderScript.type == "x-shader/x-fragment") {
         shader = gl.createShader(gl.FRAGMENT_SHADER);
     } else if (shaderScript.type == "x-shader/x-vertex") {
         shader = gl.createShader(gl.VERTEX_SHADER);
     } else {
         return null;
     }

     gl.shaderSource(shader, str);
     gl.compileShader(shader);

     if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
         alert(gl.getShaderInfoLog(shader));
         return null;
     }
    return shader;
  }

 /*
  * attrRec should be { value: <Float32Array> }
  * Adds fields "buffer" and "location" to object.
  */
  function setUpBuffer(gl, shaderProgram, attrRec) {
    attrRec.buffer   = gl.createBuffer();
    attrRec.location = gl.getAttribLocation(shaderProgram, attrRec.name);
    gl.enableVertexAttribArray(attrRec.location);
    gl.bindBuffer(gl.ARRAY_BUFFER, attrRec.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attrRec.value, gl.STATIC_DRAW);
  }

  //
  // attribute should be attribute returned by gl.getAttribLocation
  // attrRec should be { location: <loc>, buffer: <>, value: <value>, itemSize: <number>}
  //
  function drawFromBufferToAttribute(gl, attrRec) {
    var numItems = attrRec.value.length / attrRec.itemSize;
    gl.bindBuffer(gl.ARRAY_BUFFER, attrRec.buffer);
    gl.vertexAttribPointer(attrRec.location, attrRec.itemSize, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, numItems);
  }

  // FIXME: Fill out.
  function typeToUniformFun(type) {
    return "uniform1f";
  }

  /* For some reason WebGL just hates the (x,y) value (0.0, 0.0). We add a small error value
     to prevent this problem */
  function mesh(n,width) {
    var a = new Float32Array(2*(2*(n*(n+1))  + 2*(n-1)   ));
    var i, j, len = 0;
    var delta = width / n + 0.000000000000001;

    var x, y = -(width/2.0);
    for (j = 0; j < n; j++, y+=delta) {
        if (j > 0) {
            /* Degenerate triangles */
            a[len++] = (width/2.0); // x value
            a[len++] = y; // y value
            a[len++] = -(width/2); // x value
            a[len++] = y; // y value
        }

        for (i = 0, x = -(width/2); i <= n; i++, x+=delta) {
            a[len++] = x; // x value
            a[len++] = y; // y value
            a[len++] = x; // x value
            a[len++] = y+delta; // y value
        }
    }
    return a;
  }

  function init(canvasId, fragmentShaderId, vertexShaderId, options) {
    var 
      gl,
      squareVertexPositionBuffer, // contains the vertex positions of the mesh
      fragmentShader,
      vertexShader,
      attributes = options.attributes || [],
      shaderProgram;

      gl = initGL(canvasId);
      fragmentShader = getShader(gl, fragmentShaderId);
      vertexShader   = getShader(gl, vertexShaderId);
      shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    for (i in attributes) {
      setUpBuffer(gl, shaderProgram, attributes[i]);
    }

    if (options.clearColor) {
      (function(a) { gl.clearColor(a[0], a[1], a[2], a[3])})(options.clearColor);
    } else {
      gl.clearColor(1.0,1.0,1.0,1.0); // opaque white
    }

    function drawScene(uniforms) {
      gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Set the uniforms
      for (name in uniforms) {
        if (uniforms.hasOwnProperty(name)) {
          gl[typeToUniformFun(uniforms[name].type)](gl.getUniformLocation(shaderProgram, name), 
                              uniforms[name].value);
        }
      }
      // Now draw!
      for (i in attributes) {
        drawFromBufferToAttribute(gl, attributes[i]);
      }
    }

    return drawScene;
  }

  // Returns "methods" of this "module"
  return({ init: init,
           mesh: mesh });

})();

function makeKeyHandler(drawScene, uniforms) {
  console.log(uniforms);
  return function(e) {
    var key = e.which;
    var panInc = 0.05;
    var zoomFactor = 1.1;


    if (key===61||key===43) {
      uniforms.zoom.value /= zoomFactor;
    }

    if (key===45||key==95) {
      uniforms.zoom.value *= zoomFactor;
    }

    // W
    if (key===119) {
      uniforms.panY.value -= panInc;
    }

    // A
    if (key===97) {
       uniforms.panX.value += panInc;
    }

    // S
    if (key===115) {
      uniforms.panY.value += panInc;
    }

    // D
    if (key===100) {
       uniforms.panX.value -= panInc;
    }
    drawScene(uniforms);
  }
}

function webGLStart() {
  var canvas = $('#canvas');
  /* Each of these should be a DOM element with an attribute called "data-value" */
  var vertices = SGL.mesh(500,2.0);
  var uniforms = { zoom: { value: 1.0, type: "float" },
                   panX: { value: 0.0, type: "float" },
                   panY: { value: 0.0, type: "float" }};
  var drawScene = SGL.init("canvas", "shader-fs", "shader-vs",
                     { clearColor: [0.0,0.0,0.0,1.0],
                       attributes: [ {name: "vertexPos", value: vertices, itemSize: 2 }]
                      });

  $('body').keypress(makeKeyHandler(drawScene, uniforms));
  drawScene(uniforms);
}

