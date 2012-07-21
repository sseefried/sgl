
//
// Module: Simple GL
// Author: Sean Seefried
//         Copyright 2012
//
//
// Function @mesh2D@
// ~~~~~~~~~~~~~~~~~
//
// Creates a 2D mesh with @n@ squares in it (i.e. 2*n triangles) with corners
// (-n, n), (n,n), (n, -n), (-n,-n) where n = @width@/2. It is centered at the origin.
//
// The mesh is suitable for drawing with WebGL's 'drawArrays' function,
// with method 'TRIANGLE_STRIP'. It uses "degenerate triangles" at the end of each row
// to make this work.
//
//
//
// Function @init@
// ~~~~~~~~~~~~~~~
//
//   Usage: init(canvasId, fragmentShaderId, vertexShaderId, options)
//
//
//   @init@ initialises a canvas, compiles and links a fragement and vertex shader
//   and returns an "SGL context".  The SGL context is an object of form:
//     { gl: ...,
//       drawScene: ...,
//       shaderProgram: ...,
//       attributeData: ... }
//
//   Field "drawScene" is a function used to draw the scene. (See "The drawScene function" below.)
//   The other field are described below. They are really only used by the @cleanUp@ function.
//
//   - gl.               WebGL Context
//   - shaderProgram.    The associated shader program -- contains refereces to
//                       compiled, and linked vertext/fragment shaders.
//   - attributeData.    Data on GLSL attribute buffers/locations.
//
//
//   The @options@ parameter
//   -----------------------
//
//   The @options@ variable is a record. Acceptions options are:
//   - clearColor: <color array of length 4. RGBA. Colour value in interval [0.0, 1.0] >
//     Default: Opaque white.
//   - attributes: <attributes object>
//
//   The attributes object is of the form { <attribute name>: <attribute specificaiton, ... }
//   <attribute name> must be defined as an attribute in the vertex shader.
//
//   An <attribute specification> is a record of form { value: <array>, itemSize: <integer> }
//   @itemSize@ is the number of numbers that define each vertex (usually 2 or 3).
//
//   The <array> can either be a primitive array of an array of primitive arrays.
//   Each primitive array must contain only numbers which represent vertex positions to be
//   drawn as a triangle strip. This means that for array [v0,v1,v2...] triangles are drawn as
//   follows: (v0,v1,v2), (v1,v2,v3), (v2,v3,v4), ...
//
//   Each primitive array must have at least 3 elements (so at least one triangle can be drawn)
//   and must be a multiple of @itemSize@.
//
//   @itemSize@ must be less than or equal to the number of elements in the corresponding
//   attribute of the vertex shader. e.g. @itemSize = 2@ will be suitable for an attribute of
//   'vec2' or 'vec3', whereas @itemSize = 3@ will only be suitable for an attribute of
//   type 'vec3'.
//
//   The drawScene function
//   ------------------------
//
//   The drawScene function takes a single argument: a hash of uniform specifications.
//   It writes those uniforms to the shader program and displays the scene in the canvas.
//
//   The hash is of the form { <uniform name>: <uniform value>, ...}
//
//   A GLSL uniform with name <uniform name> should exist in either the vertex or fragment shader.
//   If it does not, nothing happens.
//
//   Each uniform value must be appropriate for the GLSL uniform.
//   GLSL type  | JavaScript type
//   -----------+-----------------
//   float      | Number
//   int        | Number
//   ivec2/vec2 | Array of numbers, length = 2
//   ivec3/vec3 | Array of numbers, length = 3
//   ivec4/vec4 | Array of numbers, length = 4
//   mat3       | Array of numbers, length = 9
//   mat4       | Array of numbers, length = 16
//
// Function @cleanUp@
// ------------------
//
//   Takes the SGL context returned by function @init@ and cleans up the resources.
//   It unlinks the shader programs, deletes buffers and cleans up vertex attribute arrays.
//
// Function @isError@
// ~~~~~~~~~~~~~~~~~~
//   Function @init@ can return an erroneous value. @isError@ returns @true@ if this is
//   the case. The erroneous value has an attribute @msg@ containing a string that explains
//   what went wrong.
//
//   Example usage:
//
//   drawScene = SGL.init("canvas", "fragShader", "vertexShader", {});
//   if (SGL.isError(drawScene)) {
//     alert(drawScene.msg);
//   }

//
// SGL is defined as a "module" using Douglas Crockford's trick of invoking
// an anonymous zero-argument function. It returns an object containing
// the exported "methods" of the "module".
//
var SGL = (function() {

  // Function 'error' returns a value that signifies an erroneous conditon
  // along with a descriptive message.
  //
  // Typical use case:
  //
  //  v = someFun(someParams...);
  //  if (SGL.isError v) {
  //    ... do something ...
  //  } else {
  //    ... v is correct value here ...
  //  }
  //
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
      noAttribute: function(s) { return "No attribute in shader called \"" + s + "\""},
      shaderCompileFail: function(shaderSort, msg) {
                            return "Error in " + shaderSort + " shader\n" + msg; },
      shaderLinkFail:    function(msg) { return msg; },
      itemSizeZero:      "itemSize <= 0 is invalid",
      itemSizeToLarge:   function(itemSize, name) {
                           return "itemSize = "+ itemSize + " too large for attribute \"" +
                          name + "\""; },
      arrayNotMutipleOfItemSize: function(arrayLen, itemSize) {
                                  return("Array length = " + arrayLen + " is not a multiple of " +
                                         "itemSize = " + itemSize);
                                 },
    }

  function isArray(value) {
    return value && typeof value === 'object' &&
    (value.constructor === Array || value.constructor === Float32Array);
  }


  //
  // @val@ is either a vertex array or array of vertex arrays.
  // Function @flattenedArray@ returns an object of the form { array: ..., offsets: ...}
  //
  // Each offset object is of the form { offset:... , length:...}
  // These values are used by gl.drawArrays to draw triangle strips.
  //
  // For array [a0, a1, ..., an]
  // we get [ { offset: 0,                   length: <a0.length/itemSize> },
  //          { offset: <a0.length/itemSize, length: <a1.length/itemSize> },
  //           ...,
  //          { offset <(sum of a0.length .. a{n-1}.length) / itemSize,
  //            length: <an.length/itemSize> }
  //        ]
  //
  function flattenedArray(val, itemSize) {
    var TRIANGLE_SIDES_MINUS_ONE = 2,
        TRIANGLE_SIDES = 3;
    var ai, i, a = [], index, offsets = [];
    if (isArray(val)) {

      if (val.length > 0 && isArray(val[0])) { // array of arrays
        as = val;
      } else { // flat array
        as = [val];
      }

      for (index=0, ai=0; ai < as.length; ai++) {
        if (as[ai].length % itemSize != 0) {
          return error(SGLError.arrayNotMutipleOfItemSize(as[ai].length, itemSize));
        }
        for (i=0; i<as[ai].length; i++) {
          a[index+i] = as[ai][i];
        }

        offsets[ai] = { offset: index / itemSize , length: as[ai].length / itemSize };
        index += as[ai].length
      }
    }
    return({ array: new Float32Array(a), offsets: offsets});
  }

  //
  // Initialises canvas and sets the viewport width and height to be equal to the
  // width and height of the canvas DOM element.
  //
  function initGL(canvasId) {
    var gl, canvas = document.getElementById(canvasId);
    try {
      // alpha: false prevents compositing with the background colour of the HTML page
      gl = canvas.getContext("experimental-webgl", { antialias: true, alpha: false });

      /* The 'width' and 'height' attributes of the canvas object are NOT the same as
       * the display width and display height (which you can control with CSS).
       *
       * The 'width' and 'height' attributes of the canvas element are used to control
       * the size of the *coordinate space*. It is quite possible for the display size
       * to be quite different.
       *
       * We ensure that the canvas attributes and the display width/height are equal in the
       * code below.
       *
       * See http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html
       */
      canvas.width  = $(canvas).width();
      canvas.height = $(canvas).height();

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
  // This function adds fields "buffer", "location" and "offsets" to @attrRec@ object,
  // for use later in the @drawFromBufferToAttribute@ function.
  //
  function setUpAttributeBuffer(gl, shaderProgram, attrName, attrRec) {
    var i = 0, obj;
    attrRec.location = gl.getAttribLocation(shaderProgram, attrName);
    obj = flattenedArray(attrRec.value, attrRec.itemSize);
    if (isError(obj)) { return obj;}
    if (attrRec.location < 0 ) { return error(SGLError.noAttribute(attrName)) }
    gl.enableVertexAttribArray(attrRec.location);

    attrRec.buffer       = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, attrRec.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, obj.array, gl.STATIC_DRAW);
    gl.vertexAttribPointer(attrRec.location, attrRec.itemSize, gl.FLOAT, false, 0, 0);

    attrRec.offsets = obj.offsets;
  }

  //
  // Draws from an attribute buffer (set up with @setUpAttributeBuffer@)
  // to the frame buffer.
  //
  // * @gl@ is the WebGL context
  // * @shaderProgram@ is the compile shader program
  // * @attributes@ should be a record containing at least
  //   the following fields: value, itemSize, location, buffer
  // * @i@ is the index of the active attributes
  //
  function drawFromBufferToAttribute(gl, shaderProgram, attributes, i) {
    var i, attrRec, attrInfo;
    attrInfo = gl.getActiveAttrib(shaderProgram, i);
    if (attributes[attrInfo.name]) {
      attrRec = attributes[attrInfo.name];
      gl.bindBuffer(gl.ARRAY_BUFFER, attrRec.buffer);
      maxAttrItemSize = maxItemSize(gl, attrInfo.type)
      if (attrRec.itemSize <= 0) { return error(SGLError.itemSizeZero); }
      if (attrRec.itemSize > maxAttrItemSize) {
        return error(SGLError.itemSizeToLarge(attrRec.itemSize,
                     typeToString(gl, attrInfo.type) + " " + attrInfo.name));
      }

      //
      // FIXME: This is not that efficient. See if there is a way to use gl.drawElements to
      // make this work.
      //
      for (i=0; i < attrRec.offsets.length; i++) {
        gl.drawArrays(gl.TRIANGLE_STRIP, attrRec.offsets[i].offset,
                      attrRec.offsets[i].length);
      }
    }
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
    var fun, isMatrixFun = false;
    switch(type) {
      case      gl.FLOAT: fun = "uniform1f";        break;
      case gl.FLOAT_VEC2: fun = "uniform2fv";       break;
      case gl.FLOAT_VEC3: fun = "uniform3fv";       break;
      case gl.FLOAT_VEC4: fun = "uniform4fv";       break;

      case gl.FLOAT_MAT2:
        fun = "uniformMatrix2fv";
        isMatrixFun = true;
        break;
      case gl.FLOAT_MAT3:
        fun = "uniformMatrix3fv";
        isMatrixFun = true;
        break;
      case gl.FLOAT_MAT4:
        fun = "uniformMatrix4fv";
        isMatrixFun = true;
        break;
    }
    // Must wrap function otherwise you get "illegal invocation" error.
    return function(loc, value) {
      if (isMatrixFun) {
        return gl[fun](loc, false, value);
      } else {
        return gl[fun](loc, value);
      }
    };

  }

  function mesh2D(n,width) {
    var a = new Float32Array(2*(2*(n*(n+1))  + 2*(n-1)   ));
    var i, j, len = 0;
    var delta = width / n  + 0.000000000000001;

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
  // { gl:... , drawScene:..., shaderProgram:... , attributeData:... }
  //

  //
  // See documentation at head of file.
  //
  function cleanUp(sglContext) {
    var i, shaders, gl = sglContext.gl;
    if (gl === undefined || sglContext.shaderProgram === undefined) { return; }

    shaders = gl.getAttachedShaders(sglContext.shaderProgram);

    for (i in shaders) {
      gl.detachShader(sglContext.shaderProgram, shaders[i]);
      gl.deleteShader(shaders[i]);
    }

    for (i in sglContext.attributeData) {
      gl.deleteBuffer(sglContext.attributeData[i].buffer);
      gl.disableVertexAttribArray(sglContext.attributeData[i].location);
    }

    gl.deleteProgram(sglContext.shaderProgram);
  }

  //
  // See documentation at head of file
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
      sglContext = {}, // return value of this function
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
        mbErr = setUpAttributeBuffer(gl, shaderProgram, attrName, attributes[attrName]);
        if (isError(mbErr)) { return mbErr; }
      }
    }

    if (options.clearColor) {
      (function(a) { gl.clearColor(a[0], a[1], a[2], a[3])})(options.clearColor);
    } else {
      gl.clearColor(1.0,1.0,1.0,1.0); // opaque white
    }

    gl.enable(gl.DEPTH_TEST); // Very strange things happen if this is not enabled.

    // This function is returned so that one can draw the scene.
    function drawScene(uniforms) {
      var uniformInfo, loc;

      gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      for (i=0; i < gl.getProgramParameter(shaderProgram,gl.ACTIVE_UNIFORMS); i++) {
        uniformInfo = gl.getActiveUniform(shaderProgram, i)
        loc = gl.getUniformLocation(shaderProgram, uniformInfo.name);
        if (uniforms[uniformInfo.name]) {
          uniformFun(gl, uniformInfo.type)(loc, uniforms[uniformInfo.name]);
        }
      }

      // Now draw!
      for (i=0; i < gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES); i++) {
        mbErr = drawFromBufferToAttribute(gl, shaderProgram, attributes, i);
        if (isError(mbErr)) { return mbErr; }
      }
    }

    // Set up the return value.
    sglContext = { gl: gl, drawScene: drawScene, shaderProgram: shaderProgram,
                  attributeData: [] };

    for (i in attributes) {
      sglContext.attributeData.push({ buffer:   attributes[i].buffer,
                                      location: attributes[i].location});
    }

    return(sglContext);
  }

  // Returns "methods" of this "module"
  return({ init: init,
           mesh2D: mesh2D,
           isError: isError,
           cleanUp: cleanUp });

})();
