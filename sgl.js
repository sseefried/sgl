/*
 * 
 */
var SGL = (function() {

  /* 
   * Function 'error' returns a value that signifies an erroneous conditon
   * along with a descriptive message.
   *
   * Typical use case:
   *
   *  v = someFun(someParams...);
   *  if (SGL.isError v) {
   *    ... do something ...
   *  } else {
   *    ... v is correct value here ...
   *  }
   */
  function error(msg) { return { error: true, msg: msg }}
  function isError(e) { return e && e.error };

  // SGLError: An algebraic data type of of errors
  var SGLError =
    { noInit:            "Could not initialise WebGL",
      missingCanvas:     function(id) {
                           return "Could not find canvas with id \"" + id + "\"";},
      missingShader:     function(id) {
                           return "Could not find shader with id \"" + id + "\"";},
      unknownShaderType: function(s) {
                           return "Unknown shader type \"" + s + "\"" },
      shaderCompileFail: function(shaderSort, msg) {
                            return "Error in " + shaderSort + " shader\n" + msg; },
      shaderLinkFail:    function(msg) { return msg; },
      itemSizeZero:      "itemSize <= 0 is invalid",
      itemSizeToLarge:   function(itemSize, name) {
                           return "itemSize = "+ itemSize + " too large for attribute \"" +
                          name + "\""; }
    }

  //
  // Initialises canvas and sets the viewport width and height to be equal to the
  // width and height of the canvas DOM element.
  //
  function initGL(canvasId) {
    var gl, canvas = document.getElementById(canvasId);
    try {
       gl = canvas.getContext("experimental-webgl");
       gl.viewportWidth  = canvas.width;
       gl.viewportHeight = canvas.height;
    } catch (e) {}
    if (!gl) {
      return error(SGLError.noInit);
    }
    return gl;
  }

  // 
  // @getShader(gl,id)@ tries to find either GLSL fragment or vertex shader at the
  // DOM element with ID of @id@. 
  //
  // It attemps to compile the shader and returns an error (via function @error@)
  // if it cannot.
  //
  function getShader(gl, id) {
    var shaderScript = document.getElementById(id), shader, str = "", k, shaderSort;

    if (!shaderScript) {
        return error(SGLError.missingShader(id));
    }

    k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
             str += k.textContent;
        }
        k = k.nextSibling;
    }

    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
        shaderSort = "fragment";
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
        shaderSort = "vertex";
    } else {
        return error(SGLError.unknownShaderType(shaderScript.type));
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return error(SGLError.shaderCompileFail(shaderSort, gl.getShaderInfoLog(shader)));
    }
    return shader;
  }

  //
  // Sets up a new buffer for GLSL attribute @attrName@
  //
  // @attrRec@ should contain at least the field @value@.
  // This function adds fields "buffer" and "location" to @attrRec@ object,
  // for use later in the @drawFromBufferToAttribute@ function.
  //
  function setUpAttributeBuffer(gl, shaderProgram, attrName, attrRec) {
    attrRec.buffer   = gl.createBuffer();
    attrRec.location = gl.getAttribLocation(shaderProgram, attrName);
    gl.enableVertexAttribArray(attrRec.location);
    gl.bindBuffer(gl.ARRAY_BUFFER, attrRec.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, attrRec.value, gl.STATIC_DRAW);
  }

  //
  // Draws from an attribute buffer (set up with @setUpAttributeBuffer@)
  // to the frame buffer.
  // 
  // * @gl@ is the WebGL context
  // * @shaderProgram@ is the compile shader program
  // * @attributes@ should contains records containing at least 
  //   the following fields: value, itemSize, location, buffer
  // * @i@ is the index of the active attributes
  //
  function drawFromBufferToAttribute(gl, shaderProgram, attributes, i) {
    attrInfo = gl.getActiveAttrib(shaderProgram, i);
    var attrRec = attributes[attrInfo.name], 
        numItems = attrRec.value.length / attrRec.itemSize, attr,
        maxAttrItemSize;

    gl.bindBuffer(gl.ARRAY_BUFFER, attrRec.buffer);
    maxAttrItemSize = maxItemSize(gl, attrInfo.type)
    if (attrRec.itemSize <= 0) { return error(SGLError.itemSizeZero); }
    if (attrRec.itemSize > maxAttrItemSize) {
      return error(SGLError.itemSizeToLarge(attrRec.itemSize,
                          typeToString(gl, attrInfo.type) + " " + attrInfo.name));
    }


    gl.vertexAttribPointer(attrRec.location, attrRec.itemSize, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, numItems);
  }

  //
  // Converts a WebGL type (of type GLEnum) to a human readable string.
  //
  function typeToString(gl, type) {
    switch(type) {
      case      gl.FLOAT: return "float";
      case gl.FLOAT_VEC2: return "vec2";
      case gl.FLOAT_VEC3: return "vec3";
      case gl.FLOAT_VEC4: return "vec4";
      case gl.FLOAT_MAT2: return "mat2";
      case gl.FLOAT_MAT3: return "mat3";
      case gl.FLOAT_MAT4: return "mat4";
    }
  }

  //
  // Returns maximum "itemSize" for an attribute to be used in
  // a call to @gl.vertexAttribPointer@.
  //
  function maxItemSize(gl, type) {
    switch(type) {
      case      gl.FLOAT: return 1;
      case gl.FLOAT_VEC2: return 2;
      case gl.FLOAT_VEC3: return 3;
      case gl.FLOAT_VEC4: return 4;
      case gl.FLOAT_MAT2: return 4;
      case gl.FLOAT_MAT3: return 9;
      case gl.FLOAT_MAT4: return 16;
    }
  }

  //
  // Returns the function for writing a value to a GLSL uniform appropriate to
  // the uniform's type.
  //
  // Valid types for attributes are "float", "vec2", "vec3", "vec4", "mat2", "mat3" and "mat4"
  //
  function uniformFun(gl, type) {
    var fun;
    switch(type) {
      case      gl.FLOAT: fun = "uniform1f";        break;
      case gl.FLOAT_VEC2: fun = "uniform2fv";       break;
      case gl.FLOAT_VEC3: fun = "uniform3fv";       break;
      case gl.FLOAT_VEC4: fun = "uniform4fv";       break;
      case gl.FLOAT_MAT2: fun = "uniformMatrix2fv"; break;
      case gl.FLOAT_MAT3: fun = "uniformMatrix3fv"; break;
      case gl.FLOAT_MAT4: fun = "uniformMatrix4fv"; break;
    }
    // Must wrap function otherwise you get "illegal invocation" error.
    return function(loc, value) { return gl[fun](loc, value); };
  }

  //
  // Creates a 2D mesh with @n@ squares in it (i.e. 2*n triangles) with corners 
  // (-x, x), (x,x), (x, -x), (-x,-x) where x = @width@/2. It is centered at the origin.
  //
  // NOTE: For some reason WebGL just hates the (x,y) value (0.0, 0.0). We add a small error value
  //       to prevent this problem
  function mesh2D(n,width) {
    var a = new Float32Array(2*(2*(n*(n+1))  + 2*(n-1)   ));
    var i, j, len = 0;
    var delta = width / n + 0.000000000000001;

    var x, y = -(width/2.0);
    for (j = 0; j < n; j++, y+=delta) {
        if (j > 0) {
            /* Degenerate triangles */
            a[len++] = (width/2.0); // x value
            a[len++] = y;           // y value
            a[len++] = -(width/2);  // x value
            a[len++] = y;           // y value
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

  //
  // @init@ initialises a canvas, compiles and links a fragement and vertex shader
  // and returns a "drawScene" function which, given a hash of uniform values,
  // writes those uniforms and displays the scene.
  //
  // FIXME: Write more doco
  //
  function init(canvasId, fragmentShaderId, vertexShaderId, options) {
    var
      gl,
      i, // index
      fragmentShader,
      vertexShader,
      attributes = options.attributes || [],
      loc,
      mbErr, // mbErr = "maybe error"
      shaderProgram;

    gl = initGL(canvasId);
    if (isError(gl)) { return gl;}

    fragmentShader = getShader(gl, fragmentShaderId);
    if (isError(fragmentShader)) { return fragmentShader; }
    vertexShader   = getShader(gl, vertexShaderId);
    if (isError(vertexShader)) { return vertexShader; }

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      return error(SGLError.programLinkFail(getProgramInfoLog(shaderProgram)));
    }

    gl.useProgram(shaderProgram);

    for (attrName in attributes) {
      if (attributes.hasOwnProperty(attrName)) {
        setUpAttributeBuffer(gl, shaderProgram, attrName, attributes[attrName]);
      }
    }

    if (options.clearColor) {
      (function(a) { gl.clearColor(a[0], a[1], a[2], a[3])})(options.clearColor);
    } else {
      gl.clearColor(1.0,1.0,1.0,1.0); // opaque white
    }

    function drawScene(uniforms) {
      var uniformInfo, loc;

      gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      for (i=0; i < gl.getProgramParameter(shaderProgram,gl.ACTIVE_UNIFORMS); i++) {
        uniformInfo = gl.getActiveUniform(shaderProgram, i)
        loc = gl.getUniformLocation(shaderProgram, uniformInfo.name);
        uniformFun(gl, uniformInfo.type)(loc, uniforms[uniformInfo.name] || 0.0); // default to zero
      }

      // Now draw!
      for (i=0; i < gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES); i++) {
        mbErr = drawFromBufferToAttribute(gl, shaderProgram, attributes, i);
        if (isError(mbErr)) { return mbErr; }
      }
    }

    return drawScene;
  }

  // Returns "methods" of this "module"
  return({ init: init,
           mesh2D: mesh2D,
           error: error,
           isError: isError });

})();
