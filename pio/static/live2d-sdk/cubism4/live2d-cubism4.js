/**
 * Live2D Cubism 4 Renderer for Web
 * 
 * 兼容 Cubism 3+ 模型（.moc3 / .model3.json）
 * Cubism Core 从 Live2D 官方 CDN 加载
 * 
 * API 参考: Live2D Cubism 4 Core (native data-oriented API)
 * 模型通过数组直接访问 parameters/drawables/parts
 */

(function (global) {
  'use strict';

  // ============================================================
  // 等待 Cubism Core 加载完成
  // ============================================================
  function waitForCore(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (typeof Live2DCubismCore !== 'undefined') {
        resolve(Live2DCubismCore);
        return;
      }
      var start = Date.now();
      var timer = setInterval(function () {
        if (typeof Live2DCubismCore !== 'undefined') {
          clearInterval(timer);
          resolve(Live2DCubismCore);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Live2DCubismCore 加载超时'));
        }
      }, 50);
    });
  }

  // ============================================================
  // Matrix44 - 4x4 矩阵
  // ============================================================
  function Matrix44() {
    this._tr = new Float32Array(16);
    this.identity();
  }

  Matrix44.prototype.identity = function () {
    for (var i = 0; i < 16; i++) {
      this._tr[i] = (i % 5 === 0) ? 1 : 0;
    }
  };

  Matrix44.prototype.getArray = function () {
    return this._tr;
  };

  Matrix44.prototype.setMatrix = function (m) {
    for (var i = 0; i < 16; i++) this._tr[i] = m[i];
  };

  Matrix44.prototype.multTranslate = function (x, y) {
    this._tr[12] += this._tr[0] * x + this._tr[4] * y;
    this._tr[13] += this._tr[1] * x + this._tr[5] * y;
    this._tr[14] += this._tr[2] * x + this._tr[6] * y;
    this._tr[15] += this._tr[3] * x + this._tr[7] * y;
  };

  Matrix44.prototype.multScale = function (sx, sy) {
    this._tr[0] *= sx;  this._tr[1] *= sx;  this._tr[2] *= sx;  this._tr[3] *= sx;
    this._tr[4] *= sy;  this._tr[5] *= sy;  this._tr[6] *= sy;  this._tr[7] *= sy;
  };

  Matrix44.prototype.translate = function (x, y) {
    this._tr[12] = x;
    this._tr[13] = y;
  };

  Matrix44.prototype.scale = function (sx, sy) {
    this._tr[0] = sx;
    this._tr[5] = sy;
  };

  Matrix44.prototype.transformX = function (x) {
    return this._tr[0] * x + this._tr[12];
  };

  Matrix44.prototype.transformY = function (y) {
    return this._tr[5] * y + this._tr[13];
  };

  Matrix44.prototype.invertTransformX = function (x) {
    return (x - this._tr[12]) / this._tr[0];
  };

  Matrix44.prototype.invertTransformY = function (y) {
    return (y - this._tr[13]) / this._tr[5];
  };

  // ============================================================
  // CubismModel - Cubism 4 Core 模型包装器
  // ============================================================
  function CubismModel(coreModel, moc) {
    this._coreModel = coreModel;
    this._moc = moc;
    this._params = coreModel.parameters;
    this._parts = coreModel.parts;
    this._drawables = coreModel.drawables;
    this._canvasInfo = coreModel.canvasinfo;

    // 保存初始参数
    this._savedParameters = new Float32Array(this._params.values);
    
    // 构建参数 ID → 索引映射
    this._paramIdToIndex = {};
    for (var i = 0; i < this._params.count; i++) {
      this._paramIdToIndex[this._params.ids[i]] = i;
    }
    
    // 构建 part ID → 索引映射
    this._partIdToIndex = {};
    for (var i = 0; i < this._parts.count; i++) {
      this._partIdToIndex[this._parts.ids[i]] = i;
    }
  }

  CubismModel.prototype.getCanvasWidth = function () {
    return this._canvasInfo.CanvasWidth;
  };

  CubismModel.prototype.getCanvasHeight = function () {
    return this._canvasInfo.CanvasHeight;
  };

  CubismModel.prototype.getParameterIndex = function (paramId) {
    var idx = this._paramIdToIndex[paramId];
    return idx !== undefined ? idx : -1;
  };

  CubismModel.prototype.getParameterValue = function (index) {
    return this._params.values[index];
  };

  CubismModel.prototype.setParameterValue = function (index, value) {
    this._params.values[index] = value;
  };

  CubismModel.prototype.getParameterValueById = function (paramId) {
    var idx = this._paramIdToIndex[paramId];
    return idx !== undefined ? this._params.values[idx] : 0;
  };

  CubismModel.prototype.setParameterValueById = function (paramId, value, weight) {
    if (weight === undefined) weight = 1.0;
    var idx = this._paramIdToIndex[paramId];
    if (idx !== undefined) {
      var current = this._params.values[idx];
      this._params.values[idx] = current * (1 - weight) + value * weight;
    }
  };

  CubismModel.prototype.addParameterValueById = function (paramId, value, weight) {
    if (weight === undefined) weight = 1.0;
    var idx = this._paramIdToIndex[paramId];
    if (idx !== undefined) {
      this._params.values[idx] += value * weight;
    }
  };

  CubismModel.prototype.multiplyParameterValueById = function (paramId, value, weight) {
    if (weight === undefined) weight = 1.0;
    var idx = this._paramIdToIndex[paramId];
    if (idx !== undefined) {
      this._params.values[idx] *= (1 + (value - 1) * weight);
    }
  };

  CubismModel.prototype.getPartOpacity = function (index) {
    return this._parts.opacities[index];
  };

  CubismModel.prototype.setPartOpacity = function (index, value) {
    this._parts.opacities[index] = value;
  };

  CubismModel.prototype.setPartOpacityById = function (partId, value) {
    var idx = this._partIdToIndex[partId];
    if (idx !== undefined) {
      this._parts.opacities[idx] = value;
    }
  };

  CubismModel.prototype.saveParameters = function () {
    this._savedParameters.set(this._params.values);
  };

  CubismModel.prototype.loadParameters = function () {
    this._params.values.set(this._savedParameters);
  };

  CubismModel.prototype.update = function () {
    this._coreModel.update();
  };

  CubismModel.prototype.getDrawableCount = function () {
    return this._drawables.count;
  };

  CubismModel.prototype.getDrawableVertexCount = function (index) {
    return this._drawables.vertexCounts[index];
  };

  CubismModel.prototype.getDrawableVertexPositions = function (index) {
    return this._drawables.vertexPositions[index];
  };

  CubismModel.prototype.getDrawableVertexUvs = function (index) {
    return this._drawables.vertexUvs[index];
  };

  CubismModel.prototype.getDrawableIndexCount = function (index) {
    return this._drawables.indexCounts[index];
  };

  CubismModel.prototype.getDrawableIndices = function (index) {
    return this._drawables.indices[index];
  };

  CubismModel.prototype.getDrawableRenderOrders = function () {
    return this._drawables.renderOrders;
  };

  CubismModel.prototype.getDrawableConstantFlags = function () {
    return this._drawables.constantFlags;
  };

  CubismModel.prototype.getDrawableDynamicFlags = function () {
    return this._drawables.dynamicFlags;
  };

  CubismModel.prototype.getDrawableTextureIndices = function () {
    return this._drawables.textureIndices;
  };

  CubismModel.prototype.getParameterCount = function () {
    return this._params.count;
  };

  CubismModel.prototype.release = function () {
    if (this._coreModel) {
      this._coreModel.release();
      this._coreModel = null;
    }
    if (this._moc) {
      this._moc._release();
      this._moc = null;
    }
  };

  // ============================================================
  // CubismExpressionMotion - 表情
  // ============================================================
  function CubismExpressionMotion() {
    this._parameters = [];
    this._fadeInSeconds = 1.0;
    this._fadeOutSeconds = 1.0;
    this._weight = 0;
    this._state = 0;
    this._fadeInStartTime = 0;
    this._fadeOutStartTime = 0;
  }

  CubismExpressionMotion.create = function (expJson) {
    var motion = new CubismExpressionMotion();
    if (!expJson || !expJson.Parameters) return motion;

    for (var i = 0; i < expJson.Parameters.length; i++) {
      var p = expJson.Parameters[i];
      motion._parameters.push({
        id: p.Id,
        value: p.Value || 0,
        blend: p.Blend || 'Add'
      });
    }
    return motion;
  };

  CubismExpressionMotion.prototype.start = function () {
    this._state = 1;
    this._fadeInStartTime = Date.now();
    this._weight = 0;
  };

  CubismExpressionMotion.prototype.stop = function () {
    if (this._state !== 3 && this._state !== 4) {
      this._state = 3;
      this._fadeOutStartTime = Date.now();
    }
  };

  CubismExpressionMotion.prototype.isFinished = function () {
    return this._state === 4;
  };

  CubismExpressionMotion.prototype.update = function (model) {
    var now = Date.now();

    switch (this._state) {
      case 1:
        var elapsed = (now - this._fadeInStartTime) / 1000;
        if (elapsed >= this._fadeInSeconds) {
          this._weight = 1;
          this._state = 2;
        } else {
          this._weight = 0.5 - 0.5 * Math.cos((elapsed / this._fadeInSeconds) * Math.PI);
        }
        break;
      case 2:
        this._weight = 1;
        break;
      case 3:
        var elapsed = (now - this._fadeOutStartTime) / 1000;
        if (elapsed >= this._fadeOutSeconds) {
          this._weight = 0;
          this._state = 4;
        } else {
          this._weight = 0.5 + 0.5 * Math.cos((elapsed / this._fadeOutSeconds) * Math.PI);
        }
        break;
      case 4:
        this._weight = 0;
        break;
    }

    for (var i = 0; i < this._parameters.length; i++) {
      var p = this._parameters[i];
      switch (p.blend) {
        case 'Add':
          model.addParameterValueById(p.id, p.value, this._weight);
          break;
        case 'Multiply':
          model.multiplyParameterValueById(p.id, p.value, this._weight);
          break;
        case 'Overwrite':
        default:
          model.setParameterValueById(p.id, p.value, this._weight);
          break;
      }
    }
  };

  // ============================================================
  // CubismEyeBlink - 眨眼
  // ============================================================
  function CubismEyeBlink() {
    this._state = 0;
    this._nextBlinkTime = 0;
    this._stateStartTime = 0;
    this._blinkInterval = 4000;
    this._closingDuration = 100;
    this._closedDuration = 50;
    this._openingDuration = 150;
    this._eyeParamIdL = 'ParamEyeLOpen';
    this._eyeParamIdR = 'ParamEyeROpen';
    this._closeIfZero = true;
  }

  CubismEyeBlink.prototype.calcNextBlink = function () {
    return Date.now() + Math.random() * (2 * this._blinkInterval - 1);
  };

  CubismEyeBlink.prototype.update = function (model) {
    var now = Date.now();
    var value = 0;

    switch (this._state) {
      case 1:
        var elapsed = now - this._stateStartTime;
        if (elapsed >= this._closingDuration) {
          this._state = 2;
          this._stateStartTime = now;
          value = 0;
        } else {
          value = 1 - elapsed / this._closingDuration;
        }
        break;
      case 2:
        var elapsed = now - this._stateStartTime;
        if (elapsed >= this._closedDuration) {
          this._state = 3;
          this._stateStartTime = now;
          value = 0;
        } else {
          value = 0;
        }
        break;
      case 3:
        var elapsed = now - this._stateStartTime;
        if (elapsed >= this._openingDuration) {
          this._state = 0;
          this._nextBlinkTime = this.calcNextBlink();
          value = 1;
        } else {
          value = elapsed / this._openingDuration;
        }
        break;
      case 0:
      default:
        if (this._nextBlinkTime < now) {
          this._state = 1;
          this._stateStartTime = now;
          value = 1;
        } else {
          value = 1;
        }
        break;
    }

    if (this._nextBlinkTime === 0) {
      this._nextBlinkTime = this.calcNextBlink();
      this._state = 0;
      value = 1;
    }

    if (!this._closeIfZero) value = -value;

    model.setParameterValueById(this._eyeParamIdL, value);
    model.setParameterValueById(this._eyeParamIdR, value);
  };

  // ============================================================
  // CubismRenderer_WebGL - WebGL 渲染器
  // ============================================================
  function CubismRenderer_WebGL() {
    this._gl = null;
    this._shaderProgram = null;
    this._aPosition = null;
    this._aTexCoord = null;
    this._uMatrix = null;
    this._uTexture = null;
    this._uBaseColor = null;
    this._textures = {};
    this._modelMatrix = new Matrix44();
  }

  CubismRenderer_WebGL.prototype.initialize = function (gl) {
    this._gl = gl;
    this._initShader();
  };

  CubismRenderer_WebGL.prototype._compileShader = function (type, source) {
    var gl = this._gl;
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  CubismRenderer_WebGL.prototype._initShader = function () {
    var gl = this._gl;

    var vertSrc =
      'attribute vec2 a_position;\n' +
      'attribute vec2 a_texCoord;\n' +
      'varying vec2 v_texCoord;\n' +
      'uniform mat4 u_matrix;\n' +
      'void main() {\n' +
      '  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);\n' +
      '  v_texCoord = a_texCoord;\n' +
      '}';

    var fragSrc =
      'precision mediump float;\n' +
      'varying vec2 v_texCoord;\n' +
      'uniform sampler2D u_texture;\n' +
      'uniform vec4 u_baseColor;\n' +
      'void main() {\n' +
      '  vec4 color = texture2D(u_texture, v_texCoord);\n' +
      '  // 预乘 Alpha: RGB *= A, 消除模型关节处的白边/黑边\n' +
      '  vec4 premul = vec4(color.rgb * color.a, color.a);\n' +
      '  gl_FragColor = premul * u_baseColor;\n' +
      '}';

    var vertShader = this._compileShader(gl.VERTEX_SHADER, vertSrc);
    var fragShader = this._compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!vertShader || !fragShader) return false;

    var program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(program));
      return false;
    }

    this._shaderProgram = program;
    this._aPosition = gl.getAttribLocation(program, 'a_position');
    this._aTexCoord = gl.getAttribLocation(program, 'a_texCoord');
    this._uMatrix = gl.getUniformLocation(program, 'u_matrix');
    this._uTexture = gl.getUniformLocation(program, 'u_texture');
    this._uBaseColor = gl.getUniformLocation(program, 'u_baseColor');

    gl.deleteShader(vertShader);
    gl.deleteShader(fragShader);
    return true;
  };

  CubismRenderer_WebGL.prototype.loadTexture = function (textureIndex, image) {
    var gl = this._gl;
    if (this._textures[textureIndex]) {
      gl.deleteTexture(this._textures[textureIndex]);
    }

    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // UNPACK_FLIP_Y_WEBGL: 翻转 Y 轴, 匹配 Live2D UV (Y=0 在顶部)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    // UNPACK_PREMULTIPLY_ALPHA_WEBGL: 预乘 Alpha, 消除模型关节白边/黑边
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this._textures[textureIndex] = texture;
  };

  CubismRenderer_WebGL.prototype.setModelMatrix = function (matrix) {
    this._modelMatrix.setMatrix(matrix);
  };

  CubismRenderer_WebGL.prototype.beginFrame = function () {
    var gl = this._gl;
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendEquation(gl.FUNC_ADD);
    // 禁用面剔除，确保所有三角形都绘制
    gl.disable(gl.CULL_FACE);
  };

  CubismRenderer_WebGL.prototype.drawModel = function (model, alpha) {
    if (!model || !this._gl || !this._shaderProgram) return;

    var gl = this._gl;
    var drawableCount = model.getDrawableCount();
    var renderOrders = model.getDrawableRenderOrders();
    var textureIndices = model.getDrawableTextureIndices();
    var dynamicFlags = model.getDrawableDynamicFlags();

    if (!renderOrders || !textureIndices) return;

    // 按渲染顺序排序
    var drawables = [];
    for (var i = 0; i < drawableCount; i++) {
      drawables.push({ index: i, order: renderOrders[i] });
    }
    drawables.sort(function (a, b) { return a.order - b.order; });

    gl.useProgram(this._shaderProgram);
    gl.uniformMatrix4fv(this._uMatrix, false, this._modelMatrix.getArray());
    gl.uniform4f(this._uBaseColor, 1.0, 1.0, 1.0, alpha);

    for (var d = 0; d < drawables.length; d++) {
      var drawIdx = drawables[d].index;

      // 使用 dynamicFlags 检查可见性（model.update() 后更新）
      if (dynamicFlags && dynamicFlags[drawIdx] !== undefined) {
        var df = dynamicFlags[drawIdx];
        if (!(df & 0x01)) {
          continue; // 不可见，跳过
        }
      }

      var texIdx = textureIndices[drawIdx];
      var texture = this._textures[texIdx];
      if (!texture) continue;

      var vertexCount = model.getDrawableVertexCount(drawIdx);
      if (vertexCount === 0) continue;
      var vertices = model.getDrawableVertexPositions(drawIdx);
      var uvs = model.getDrawableVertexUvs(drawIdx);
      var indexCount = model.getDrawableIndexCount(drawIdx);
      var indices = model.getDrawableIndices(drawIdx);

      if (!vertices || !uvs || !indices) continue;

      // 构建交错顶点数据
      var vertexData = new Float32Array(vertexCount * 4);
      for (var j = 0; j < vertexCount; j++) {
        vertexData[j * 4] = vertices[j * 2];
        vertexData[j * 4 + 1] = vertices[j * 2 + 1];
        vertexData[j * 4 + 2] = uvs[j * 2];
        vertexData[j * 4 + 3] = uvs[j * 2 + 1];
      }

      var vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

      var ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      var indexArray = indices instanceof Uint16Array ? indices : new Uint16Array(indices);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(this._uTexture, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.enableVertexAttribArray(this._aPosition);
      gl.vertexAttribPointer(this._aPosition, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(this._aTexCoord);
      gl.vertexAttribPointer(this._aTexCoord, 2, gl.FLOAT, false, 16, 8);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

      gl.deleteBuffer(vb);
      gl.deleteBuffer(ib);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  };

  CubismRenderer_WebGL.prototype.release = function () {
    var gl = this._gl;
    if (!gl) return;
    for (var key in this._textures) {
      gl.deleteTexture(this._textures[key]);
    }
    if (this._shaderProgram) {
      gl.deleteProgram(this._shaderProgram);
    }
    this._textures = {};
    this._shaderProgram = null;
  };

  // ============================================================
  // Live2DCubism4Model - 高级模型控制器
  // ============================================================
  function Live2DCubism4Model() {
    this._moc = null;
    this._model = null;
    this._renderer = null;
    this._expressions = {};
    this._currentExpression = null;
    this._eyeBlink = new CubismEyeBlink();
    this._modelMatrix = new Matrix44();
    this._isInitialized = false;
    this._alpha = 1.0;
    this._scale = 0.85;  // 模型缩放比例, 可在 load 前设置
    this._dragX = 0;
    this._dragY = 0;
    this._faceTargetX = 0;
    this._faceTargetY = 0;
    this._faceX = 0;
    this._faceY = 0;
    this._faceVX = 0;
    this._faceVY = 0;
    this._lastTime = 0;
    this._canvas = null;
    this._modelJson = null;
    this._baseDir = '';

    // 姿态控制 (Param: 0=站立, 1=坐下)
    this._poseValue = 1.0;
    this._poseTarget = 1.0;
    this._poseSpeed = 4.0;    // 过渡速度 (越大越快)
    this._poseCallback = null;
  }

  Live2DCubism4Model.prototype.getModelMatrix = function () { return this._modelMatrix; };
  Live2DCubism4Model.prototype.setAlpha = function (a) { this._alpha = a; };
  Live2DCubism4Model.prototype.getAlpha = function () { return this._alpha; };
  Live2DCubism4Model.prototype.setScale = function (s) { this._scale = s; };
  Live2DCubism4Model.prototype.isInitialized = function () { return this._isInitialized; };
  Live2DCubism4Model.prototype.setDrag = function (x, y) { this._dragX = x; this._dragY = y; };
  Live2DCubism4Model.prototype.setFaceTarget = function (x, y) { this._faceTargetX = x; this._faceTargetY = y; };

  // 姿态控制: 直接设置 Param 参数, 不经过表情系统
  // pose: 0=站立, 1=坐下
  // duration: 过渡时间(秒), 0表示立即切换
  // callback: 过渡完成回调
  Live2DCubism4Model.prototype.setPose = function (pose, duration, callback) {
    duration = (typeof duration === 'number' && duration >= 0) ? duration : 0;
    this._poseTarget = Math.max(0, Math.min(1, pose));
    this._poseCallback = callback || null;
    if (duration <= 0) {
      this._poseValue = this._poseTarget;
      if (this._poseCallback) { var cb = this._poseCallback; this._poseCallback = null; cb(); }
    }
  };

  Live2DCubism4Model.prototype.getPose = function () { return this._poseValue; };

  Live2DCubism4Model.prototype.isPoseAnimating = function () {
    return Math.abs(this._poseValue - this._poseTarget) > 0.005;
  };

  Live2DCubism4Model.prototype.load = function (canvas, modelJsonPath, callback) {
    var self = this;
    this._canvas = canvas;
    this._baseDir = modelJsonPath.substring(0, modelJsonPath.lastIndexOf('/') + 1);

    fetch(modelJsonPath)
      .then(function (r) { return r.json(); })
      .then(function (modelJson) {
        self._modelJson = modelJson;

        var mocPath = modelJson.FileReferences.Moc;
        if (!mocPath.startsWith('/') && !mocPath.startsWith('http')) {
          mocPath = self._baseDir + mocPath;
        }

        return fetch(mocPath).then(function (r) { return r.arrayBuffer(); });
      })
      .then(function (arrayBuffer) {
        var moc = Live2DCubismCore.Moc.fromArrayBuffer(arrayBuffer);
        if (!moc) throw new Error('无法解析 .moc3 文件');

        var coreModel = Live2DCubismCore.Model.fromMoc(moc);
        if (!coreModel) throw new Error('无法创建模型');

        self._moc = moc;
        self._model = new CubismModel(coreModel, moc);

        // 创建 WebGL 上下文
        var gl = canvas.getContext('webgl', {
          alpha: true, premultipliedAlpha: true, antialias: true
        }) || canvas.getContext('experimental-webgl', {
          alpha: true, premultipliedAlpha: true, antialias: true
        });

        if (!gl) throw new Error('无法获取 WebGL 上下文');

        self._renderer = new CubismRenderer_WebGL();
        self._renderer.initialize(gl);

        // 加载纹理
        return self._loadTextures(self._modelJson);
      })
      .then(function () {
        // 加载表情
        var expPromises = [];
        if (self._modelJson.FileReferences && self._modelJson.FileReferences.Expressions) {
          for (var i = 0; i < self._modelJson.FileReferences.Expressions.length; i++) {
            var expDef = self._modelJson.FileReferences.Expressions[i];
            var expPath = expDef.File;
            if (!expPath.startsWith('/') && !expPath.startsWith('http')) {
              expPath = self._baseDir + expPath;
            }
            (function (name, path) {
              expPromises.push(
                fetch(path).then(function (r) { return r.json(); })
                  .then(function (expJson) {
                    self._expressions[name] = CubismExpressionMotion.create(expJson);
                  })
                  .catch(function () { console.warn('表情加载失败: ' + path); })
              );
            })(expDef.Name, expPath);
          }
        }
        return Promise.all(expPromises);
      })
      .then(function () {
        self._setupModelMatrix();
        self._isInitialized = true;
        self._lastTime = Date.now();
        self._model.saveParameters();

        console.log('✅ Live2D Cubism 4 模型就绪');
        console.log('   参数:' + self._model.getParameterCount() + ' 可绘制:' + self._model.getDrawableCount());
        console.log('   画布:' + self._model.getCanvasWidth() + 'x' + self._model.getCanvasHeight());
        console.log('   表情:' + (Object.keys(self._expressions).join(', ') || '无'));

        if (callback) callback(self);
      })
      .catch(function (error) {
        console.error('❌ Live2D 模型加载失败:', error);
        if (callback) callback(null);
      });
  };

  Live2DCubism4Model.prototype._loadTextures = function (modelJson) {
    var self = this;
    var textures = modelJson.FileReferences.Textures || [];
    var promises = [];

    for (var i = 0; i < textures.length; i++) {
      var texturePath = textures[i];
      if (!texturePath.startsWith('/') && !texturePath.startsWith('http')) {
        texturePath = self._baseDir + texturePath;
      }

      (function (index, path) {
        promises.push(
          new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function () {
              try {
                self._renderer.loadTexture(index, img);
                resolve();
              } catch (e) { reject(e); }
            };
            img.onerror = function () {
              reject(new Error('纹理加载失败: ' + path));
            };
            img.src = path;
          })
        );
      })(i, texturePath);
    }

    return Promise.all(promises);
  };

  Live2DCubism4Model.prototype._setupModelMatrix = function () {
    var ppu = this._model._canvasInfo.PixelsPerUnit || 1;
    var modelWidth = this._model.getCanvasWidth();
    var modelHeight = this._model.getCanvasHeight();

    // Cubism Core 返回的顶点坐标是模型空间 (Y-up, 原点在画布中心)
    // 转换公式: clip = model * PixelsPerUnit * 2 / CanvasSize
    //
    // 不翻转 Y 轴, 因为模型空间和 Clip 空间都是 Y-up
    var sx = 2.0 * ppu / modelWidth;
    var sy = 2.0 * ppu / modelHeight;

    this._modelMatrix.identity();

    // 计算顶点的实际范围以确定居中偏移
    var modelMinX = Infinity, modelMaxX = -Infinity;
    var modelMinY = Infinity, modelMaxY = -Infinity;
    var drawableCount = this._model.getDrawableCount();
    for (var i = 0; i < drawableCount; i++) {
      var verts = this._model.getDrawableVertexPositions(i);
      if (!verts) continue;
      for (var j = 0; j < verts.length / 2; j++) {
        var vx = verts[j * 2];
        var vy = verts[j * 2 + 1];
        if (vx < modelMinX) modelMinX = vx;
        if (vx > modelMaxX) modelMaxX = vx;
        if (vy < modelMinY) modelMinY = vy;
        if (vy > modelMaxY) modelMaxY = vy;
      }
    }

    // 模型包围盒在模型空间中的中心
    var modelCenterX = (modelMinX + modelMaxX) / 2;
    var modelCenterY = (modelMinY + modelMaxY) / 2;

    // 模型包围盒在模型空间中的尺寸
    var modelRangeX = modelMaxX - modelMinX;
    var modelRangeY = modelMaxY - modelMinY;

    // 计算让模型填满画面的缩放比例 (取较小轴, 保持等比)
    // 乘以用户配置的 scale 比例 (0~1, 1=填满画布)
    var userScale = this._scale;
    if (typeof userScale !== 'number' || userScale <= 0 || userScale > 1) userScale = 0.85;
    var fillScale = Math.min(2.0 / modelRangeX, 2.0 / modelRangeY) * userScale;

    // 最终矩阵 = 缩放 * ppu映射 * 居中偏移
    // 让模型包围盒中心对齐 clip 空间中心
    this._modelMatrix.scale(sx * fillScale, sy * fillScale);
    this._modelMatrix._tr[12] = -modelCenterX * sx * fillScale;  // translateX
    this._modelMatrix._tr[13] = -modelCenterY * sy * fillScale;  // translateY

    console.log('📐 Live2D 模型矩阵:', {
      modelCanvas: modelWidth + 'x' + modelHeight,
      PixelsPerUnit: ppu,
      vertexRange: 'X[' + modelMinX.toFixed(3) + ',' + modelMaxX.toFixed(3) + '] Y[' + modelMinY.toFixed(3) + ',' + modelMaxY.toFixed(3) + ']',
      scale: fillScale.toFixed(2) + 'x'
    });
  };

  Live2DCubism4Model.prototype.update = function () {
    if (!this._isInitialized || !this._model) return;

    var now = Date.now();
    var deltaSeconds = (now - this._lastTime) / 1000;
    if (deltaSeconds > 0.1) deltaSeconds = 0.1;
    this._lastTime = now;

    this._model.loadParameters();

    // 拖拽/鼠标参数
    this._model.addParameterValueById('ParamAngleX', 30 * this._dragX, 1);
    this._model.addParameterValueById('ParamAngleY', 30 * this._dragY, 1);
    this._model.addParameterValueById('ParamAngleZ', this._dragX * this._dragY * -30, 1);
    this._model.addParameterValueById('ParamBodyAngleX', 10 * this._dragX, 1);
    this._model.addParameterValueById('ParamBodyAngleY', 10 * this._dragY, 1);
    this._model.addParameterValueById('ParamBodyAngleZ', this._dragX * this._dragY * -10, 1);
    this._model.addParameterValueById('ParamEyeBallX', this._dragX, 1);
    this._model.addParameterValueById('ParamEyeBallY', this._dragY, 1);

    // 呼吸
    var breathCycle = now / 1000;
    this._model.addParameterValueById('ParamBreath', 0.5 + 0.5 * Math.sin(breathCycle / 3.2345), 1);

    // 姿态渐变 (0=站立, 1=坐下)
    if (Math.abs(this._poseValue - this._poseTarget) > 0.001) {
      var t = Math.min(1, deltaSeconds * this._poseSpeed);
      this._poseValue += (this._poseTarget - this._poseValue) * t;
      if (Math.abs(this._poseValue - this._poseTarget) < 0.002) {
        this._poseValue = this._poseTarget;
        if (this._poseCallback) { var cb = this._poseCallback; this._poseCallback = null; cb(); }
      }
    }
    // 直接用 Overwrite 设置 Param, 不经过表达式的 Add 混合
    this._model.setParameterValueById('Param', this._poseValue);

    // 眨眼
    this._eyeBlink.update(this._model);

    // 表情 (仍然保留, 用于脸颊泛红等附加效果)
    if (this._currentExpression && !this._currentExpression.isFinished()) {
      this._currentExpression.update(this._model);
    }

    this._model.update();
    this._renderer.setModelMatrix(this._modelMatrix.getArray());
  };

  Live2DCubism4Model.prototype.draw = function () {
    if (!this._isInitialized || !this._renderer || !this._model) return;
    this._renderer.beginFrame();
    this._renderer.drawModel(this._model, this._alpha);
  };

  Live2DCubism4Model.prototype.setExpression = function (name) {
    if (this._expressions[name]) {
      if (this._currentExpression && !this._currentExpression.isFinished()) {
        this._currentExpression.stop();
      }
      this._currentExpression = this._expressions[name];
      this._currentExpression.start();
    }
  };

  Live2DCubism4Model.prototype.setRandomExpression = function () {
    var keys = Object.keys(this._expressions);
    if (keys.length > 0) {
      this.setExpression(keys[Math.floor(Math.random() * keys.length)]);
    }
  };

  Live2DCubism4Model.prototype.release = function () {
    if (this._renderer) { this._renderer.release(); this._renderer = null; }
    if (this._model) { this._model.release(); this._model = null; }
    this._isInitialized = false;
  };

  // ============================================================
  // 全局 API
  // ============================================================
  var _instances = {};

  function initLive2DCubism4(canvasId, modelJsonPath, options) {
    options = options || {};
    var canvas = document.getElementById(canvasId);
    if (!canvas) { console.error('❌ canvas 未找到: ' + canvasId); return; }

    if (_instances[canvasId]) { _instances[canvasId].release(); }

    waitForCore(15000).then(function () {
      var model = new Live2DCubism4Model();
      _instances[canvasId] = model;

      // 应用用户配置的缩放比例 (0~1)
      if (typeof options.scale === 'number') {
        model.setScale(options.scale);
      }

      model.load(canvas, modelJsonPath, function (loadedModel) {
        if (!loadedModel) { console.error('❌ 模型加载失败'); return; }

        console.log('🚀 Live2D 模型加载成功!');

        if (!window._live2dCubism4Running) window._live2dCubism4Running = {};
        window._live2dCubism4Running[canvasId] = true;

        function renderLoop() {
          try {
            if (!model.isInitialized()) { requestAnimationFrame(renderLoop); return; }

            var gl = model._renderer._gl;
            if (gl) {
              gl.viewport(0, 0, canvas.width, canvas.height);
              gl.clearColor(0.0, 0.0, 0.0, 0.0);
              gl.clear(gl.COLOR_BUFFER_BIT);
            }

            model.update();
            model.draw();
          } catch(e) {
            console.error('Live2D render loop error:', e);
          }

          if (window._live2dCubism4Running[canvasId] !== false) {
            requestAnimationFrame(renderLoop);
          }
        }

        requestAnimationFrame(renderLoop);
      });
    }).catch(function (e) { console.error('❌ 初始化失败:', e); });
  }

  function getLive2DModel(canvasId) { return _instances[canvasId] || null; }

  function stopLive2D(canvasId) {
    if (window._live2dCubism4Running) window._live2dCubism4Running[canvasId] = false;
    if (_instances[canvasId]) { _instances[canvasId].release(); delete _instances[canvasId]; }
  }

  global.initLive2DCubism4 = initLive2DCubism4;
  global.getLive2DModel = getLive2DModel;
  global.stopLive2D = stopLive2D;
  global.Live2DCubism4Model = Live2DCubism4Model;

})(window);
