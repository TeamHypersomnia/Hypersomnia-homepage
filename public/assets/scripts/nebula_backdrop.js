(function () {
  const MAX_LIGHTS = 16;
  const MAX_LAYERS = 6;
  const FLICKER_STEP_SECS = 1 / 60;
  const LIGHT_BAND_STEP = 85;
  const LIGHT_BAND_LEVELS = 3;
  const FIRST_VIEW_MILLIS_STORAGE_KEY = "nebulaBackdropFirstViewMillis";

  const VERTEX_SHADER = `
    attribute vec2 corner;

    void main() {
      gl_Position = vec4(corner, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER = `
    precision highp float;

    uniform vec2 viewLeftTop;
    uniform float viewHeightPixels;
    uniform float worldUnitsPerPixel;

    uniform vec3 ambient;
    uniform int lightCount;
    uniform vec4 lightPosReachCutoff[${MAX_LIGHTS}];
    uniform vec4 lightColor[${MAX_LIGHTS}];
    uniform vec3 lightAttenuation[${MAX_LIGHTS}];

    uniform int layerCount;
    uniform sampler2D layerTexture[${MAX_LAYERS}];
    uniform vec2 layerPos[${MAX_LAYERS}];
    uniform vec2 layerCosSin[${MAX_LAYERS}];
    uniform vec2 layerTileSize[${MAX_LAYERS}];
    uniform vec4 layerColor[${MAX_LAYERS}];

    float legacyLightAmount(float distance, vec4 posReachCutoff, vec3 attenuation, float alpha) {
      float maxDistance = posReachCutoff.z;
      float cutoffDistance = posReachCutoff.w;

      if (distance > maxDistance) {
        return 0.0;
      }

      float amount = 1.0 / (attenuation.x + attenuation.y * distance + attenuation.z * distance * distance);

      if (distance > cutoffDistance) {
        float cutoffAmount = (distance - cutoffDistance) / (maxDistance - cutoffDistance);
        amount *= 0.5 * (1.0 - cutoffAmount * cutoffAmount);
      }

      return min(alpha, amount);
    }

    vec3 lightAt(vec2 world) {
      vec3 light = ambient;

      for (int i = 0; i < ${MAX_LIGHTS}; ++i) {
        if (i >= lightCount) {
          break;
        }

        float distance = length(world - lightPosReachCutoff[i].xy);
        light += lightColor[i].rgb * legacyLightAmount(distance, lightPosReachCutoff[i], lightAttenuation[i], lightColor[i].a);
      }

      return min(light, vec3(1.0));
    }

    float bandedBrightening(vec3 light) {
      float strongest = max(max(light.r, light.g), light.b);
      float band = min(floor(floor(strongest * 255.0 + 0.5) / ${LIGHT_BAND_STEP}.0), ${LIGHT_BAND_LEVELS}.0);

      return (band + ${LIGHT_BAND_LEVELS}.0) / ${LIGHT_BAND_LEVELS}.0;
    }

    vec4 sampleLayer(sampler2D tex, vec2 world, vec2 pos, vec2 cosSin, vec2 tileSize) {
      vec2 offset = world - pos;
      vec2 local = vec2(
        offset.x * cosSin.x + offset.y * cosSin.y,
        -offset.x * cosSin.y + offset.y * cosSin.x
      );

      return texture2D(tex, fract(local / tileSize));
    }

    vec3 blendLayer(vec3 below, vec4 texel, vec4 color, vec3 brightenedLight) {
      vec3 lit = min(texel.rgb, texel.rgb * color.rgb * brightenedLight);
      return mix(below, lit, texel.a * color.a);
    }

    void main() {
      vec2 pixel = vec2(gl_FragCoord.x, viewHeightPixels - gl_FragCoord.y);
      vec2 world = viewLeftTop + pixel * worldUnitsPerPixel;

      vec3 light = lightAt(world);
      vec3 brightenedLight = light * bandedBrightening(light);

      vec3 result = vec3(0.0);

      ${Array.from({ length: MAX_LAYERS }, (_, i) => `
      if (${i} < layerCount) {
        result = blendLayer(
          result,
          sampleLayer(layerTexture[${i}], world, layerPos[${i}], layerCosSin[${i}], layerTileSize[${i}]),
          layerColor[${i}],
          brightenedLight
        );
      }`).join("")}

      gl_FragColor = vec4(result, 1.0);
    }
  `;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  function createProgram(gl) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }

    return program;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function createNearestRepeatTexture(gl, image) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  function createFlickerLikeGame(light) {
    const magnitude = light.vibration;
    const changeSpeed = light.vibration * 2;
    let value = 0;
    let pendingSecs = 0;

    return {
      advance(deltaSecs) {
        if (magnitude <= 0) {
          return;
        }

        pendingSecs += deltaSecs;

        while (pendingSecs >= FLICKER_STEP_SECS) {
          pendingSecs -= FLICKER_STEP_SECS;
          value += FLICKER_STEP_SECS * (Math.random() * 2 - 1) * changeSpeed;
          value = Math.min(Math.max(value, -magnitude / 2), magnitude / 2);
        }
      },
      intensity() {
        return Math.max(1 - Math.abs(value), 0.0001);
      },
    };
  }

  function packPerLight(visibleLights, componentsPerLight, componentsOf) {
    const packed = new Float32Array(MAX_LIGHTS * componentsPerLight);
    visibleLights.forEach((entry, slot) => packed.set(componentsOf(entry), slot * componentsPerLight));
    return packed;
  }

  function lightReachesView(light, viewLeftTop, viewSize) {
    const nearestX = Math.min(Math.max(light.pos[0], viewLeftTop[0]), viewLeftTop[0] + viewSize[0]);
    const nearestY = Math.min(Math.max(light.pos[1], viewLeftTop[1]), viewLeftTop[1] + viewSize[1]);
    return Math.hypot(light.pos[0] - nearestX, light.pos[1] - nearestY) < light.max_distance;
  }

  function distanceToViewCenter(light, viewLeftTop, viewSize) {
    return Math.hypot(
      light.pos[0] - (viewLeftTop[0] + viewSize[0] / 2),
      light.pos[1] - (viewLeftTop[1] + viewSize[1] / 2)
    );
  }

  function secondsSinceFirstViewInThisTab() {
    const nowMillis = Date.now();

    try {
      const firstViewMillis = parseFloat(sessionStorage.getItem(FIRST_VIEW_MILLIS_STORAGE_KEY));

      if (Number.isFinite(firstViewMillis)) {
        return (nowMillis - firstViewMillis) / 1000;
      }

      sessionStorage.setItem(FIRST_VIEW_MILLIS_STORAGE_KEY, String(nowMillis));
    } catch {
      return 0;
    }

    return 0;
  }

  function revealBackdropThroughBands(bandsSelector) {
    if (!bandsSelector) {
      return;
    }

    document.querySelectorAll(bandsSelector).forEach((band) => {
      const art = band.parentElement;

      const measureBandWithinArt = () => {
        const artTop = art.getBoundingClientRect().top;
        const bandRect = band.getBoundingClientRect();
        art.style.setProperty("--nebula-band-top", `${bandRect.top - artTop}px`);
        art.style.setProperty("--nebula-band-bottom", `${bandRect.bottom - artTop}px`);
      };

      measureBandWithinArt();

      const observer = new ResizeObserver(measureBandWithinArt);
      observer.observe(art);
      observer.observe(band);
    });
  }

  async function mountNebulaBackdrop(container) {
    const assetsUrl = container.dataset.nebulaBackdrop;
    const startSeconds = container.dataset.startSeconds !== undefined
      ? parseFloat(container.dataset.startSeconds)
      : secondsSinceFirstViewInThisTab();
    const frozen = container.hasAttribute("data-frozen") || matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canvas = document.createElement("canvas");
    canvas.className = "nebula-backdrop-canvas";
    canvas.setAttribute("aria-hidden", "true");

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: frozen });

    if (!gl) {
      return;
    }

    const backdrop = await (await fetch(assetsUrl + "backdrop.json")).json();
    const layers = backdrop.layers.slice(0, MAX_LAYERS);
    const images = await Promise.all(layers.map((layer) => loadImage(assetsUrl + layer.texture)));

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    if (images.some((image) => Math.max(image.width, image.height) > maxTextureSize)) {
      return;
    }

    const program = createProgram(gl);
    gl.useProgram(program);

    const uniform = (name) => gl.getUniformLocation(program, name);

    const cornerBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const cornerAttribute = gl.getAttribLocation(program, "corner");
    gl.enableVertexAttribArray(cornerAttribute);
    gl.vertexAttribPointer(cornerAttribute, 2, gl.FLOAT, false, 0, 0);

    images.forEach((image, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      createNearestRepeatTexture(gl, image);
      gl.uniform1i(uniform(`layerTexture[${i}]`), i);
    });

    gl.uniform1i(uniform("layerCount"), layers.length);
    gl.uniform2fv(uniform("layerPos"), layers.flatMap((layer) => layer.pos));
    gl.uniform2fv(uniform("layerTileSize"), layers.flatMap((layer) => layer.tile_size));
    gl.uniform4fv(uniform("layerColor"), layers.flatMap((layer) => layer.color));
    gl.uniform3fv(uniform("ambient"), backdrop.ambient.slice(0, 3));

    const flickers = backdrop.lights.map(createFlickerLikeGame);

    container.prepend(canvas);
    canvas.addEventListener("webglcontextlost", () => canvas.remove());

    let viewLeftTop = [0, 0];
    let viewSize = [0, 0];
    let visibleLights = [];

    const resize = () => {
      const width = Math.max(1, Math.round(container.clientWidth));
      const height = Math.max(1, Math.round(container.clientHeight));

      if (canvas.width === width && canvas.height === height) {
        return;
      }

      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);

      viewSize = [width, height];
      viewLeftTop = [backdrop.camera[0] - width / 2, backdrop.camera[1] - height / 2];
      visibleLights = backdrop.lights
        .map((light, index) => ({ light, index }))
        .filter(({ light }) => lightReachesView(light, viewLeftTop, viewSize))
        .sort((a, b) => distanceToViewCenter(a.light, viewLeftTop, viewSize) - distanceToViewCenter(b.light, viewLeftTop, viewSize))
        .slice(0, MAX_LIGHTS);

      gl.uniform2fv(uniform("viewLeftTop"), viewLeftTop);
      gl.uniform1f(uniform("viewHeightPixels"), height);
      gl.uniform1f(uniform("worldUnitsPerPixel"), 1);
      gl.uniform1i(uniform("lightCount"), visibleLights.length);
      gl.uniform4fv(uniform("lightPosReachCutoff"), packPerLight(visibleLights, 4, ({ light }) => [
        ...light.pos,
        light.max_distance,
        light.cutoff_distance,
      ]));
      gl.uniform4fv(uniform("lightColor"), packPerLight(visibleLights, 4, ({ light }) => light.color));
    };

    const attenuations = new Float32Array(MAX_LIGHTS * 3);
    const cosSins = new Float32Array(MAX_LAYERS * 2);

    const draw = (seconds) => {
      resize();

      visibleLights.forEach(({ light, index }, slot) => {
        const flickerIntensity = flickers[index].intensity();

        for (let term = 0; term < 3; ++term) {
          attenuations[slot * 3 + term] = light.attenuation[term] / flickerIntensity;
        }
      });

      layers.forEach((layer, i) => {
        const radians = ((seconds * layer.degrees_per_sec) % 360) * Math.PI / 180;
        cosSins[i * 2] = Math.cos(radians);
        cosSins[i * 2 + 1] = Math.sin(radians);
      });

      gl.uniform3fv(uniform("lightAttenuation"), attenuations);
      gl.uniform2fv(uniform("layerCosSin"), cosSins);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    draw(startSeconds);
    revealBackdropThroughBands(container.dataset.revealThrough);
    container.dataset.nebulaBackdropReady = "";

    if (frozen) {
      new ResizeObserver(() => draw(startSeconds)).observe(container);
      return;
    }

    let lastMillis = null;
    let elapsedSecs = 0;

    const tick = (millis) => {
      if (!canvas.isConnected) {
        return;
      }

      const deltaSecs = lastMillis === null ? 0 : Math.min((millis - lastMillis) / 1000, 0.25);
      lastMillis = millis;

      elapsedSecs += deltaSecs;
      flickers.forEach((flicker) => flicker.advance(deltaSecs));
      draw(startSeconds + elapsedSecs);

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  if (!CSS.supports("selector(:has(*))")) {
    return;
  }

  document.querySelectorAll("[data-nebula-backdrop]").forEach((container) => {
    mountNebulaBackdrop(container).catch(() => {});
  });
})();
