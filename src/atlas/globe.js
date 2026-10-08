import * as THREE from 'three';
import { drawMap, sampleLandPoints } from './geo.js';
import { latLonToVector, rotationToFace } from './cities.js';

const COLORS = {
  starlight: new THREE.Color('#e4e8ff'),
  violet: new THREE.Color('#9d8cf0'),
  gold: new THREE.Color('#f2c46d'),
  atmosphere: new THREE.Color('#5d52c4'),
};
const HOME = { lat: 37.5, lon: -99, distance: 5.4 };
const INTRO_SECONDS = 3.8;
const vec = (lat, lon, r = 1) => { const v = latLonToVector(lat, lon, r); return new THREE.Vector3(v.x, v.y, v.z); };

export function createGlobe({ container, geography, cities, records, tier, reducedMotion, onFrame, onIntroEnd }) {
  const renderer = new THREE.WebGLRenderer({ antialias: tier.name !== 'low', alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'globe-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(0, 0, HOME.distance);

  // Decorative background stars. They live outside the globe group and are never hit-tested.
  const starCount = tier.stars;
  const starPositions = new Float32Array(starCount * 3);
  const starSeeds = new Float32Array(starCount);
  for (let i = 0; i < starCount; i += 1) {
    const direction = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 50);
    starPositions.set([direction.x, direction.y, direction.z], i * 3);
    starSeeds[i] = Math.random();
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('seed', new THREE.BufferAttribute(starSeeds, 1));
  const starMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, pixelRatio: { value: renderer.getPixelRatio() }, twinkle: { value: reducedMotion ? 0 : 1 } },
    vertexShader: `attribute float seed; uniform float time; uniform float pixelRatio; uniform float twinkle; varying float vAlpha; varying float vWarm;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv;
        float base = mix(.25,1.,pow(seed,3.)); vAlpha = base * (1. - twinkle*.35*(.5+.5*sin(time*(.4+seed*1.3)+seed*40.)));
        vWarm = step(.93, seed); gl_PointSize = (0.9 + 2.2*pow(seed,4.)) * pixelRatio; }`,
    fragmentShader: `varying float vAlpha; varying float vWarm; void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard;
      vec3 c = mix(vec3(.86,.89,1.), vec3(1.,.86,.62), vWarm); gl_FragColor = vec4(c, vAlpha * smoothstep(.5,.0,d)); }`,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // The globe: map texture + assembled star-particle land + city markers + constellation.
  const globe = new THREE.Group();
  scene.add(globe);

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = tier.texture; mapCanvas.height = tier.texture / 2;
  drawMap(mapCanvas, geography);
  const texture = new THREE.CanvasTexture(mapCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const sphereMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), sphereMaterial);
  sphere.renderOrder = 0;
  globe.add(sphere);

  const landPoints = sampleLandPoints(geography, tier.particles);
  const landCount = landPoints.length;
  const targets = new Float32Array(landCount * 3);
  const starts = new Float32Array(landCount * 3);
  const delays = new Float32Array(landCount);
  landPoints.forEach(([lat, lon], i) => {
    const target = vec(lat, lon, 1.006);
    targets.set([target.x, target.y, target.z], i * 3);
    // Start scattered in a wide shell, roughly along the same direction, so the assembly reads as stars falling into place.
    const start = target.clone().normalize().multiplyScalar(2.5 + Math.random() * 6).add(new THREE.Vector3().randomDirection().multiplyScalar(2.5));
    starts.set([start.x, start.y, start.z], i * 3);
    delays[i] = Math.random();
  });
  const landGeometry = new THREE.BufferGeometry();
  landGeometry.setAttribute('position', new THREE.BufferAttribute(targets, 3));
  landGeometry.setAttribute('start', new THREE.BufferAttribute(starts, 3));
  landGeometry.setAttribute('delay', new THREE.BufferAttribute(delays, 1));
  const landMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { progress: { value: reducedMotion ? 1 : 0 }, pixelRatio: { value: renderer.getPixelRatio() }, settled: { value: 0.55 } },
    vertexShader: `attribute vec3 start; attribute float delay; uniform float progress; uniform float pixelRatio; uniform float settled; varying float vAlpha;
      float ease(float t){ return t<.5 ? 4.*t*t*t : 1.-pow(-2.*t+2.,3.)/2.; }
      void main(){ float t = ease(clamp((progress - delay*.45)/.55, 0., 1.)); vec3 p = mix(start, position, t);
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        vec3 center = (modelViewMatrix * vec4(0.,0.,0.,1.)).xyz; float facing = dot(normalize(mv.xyz-center), normalize(-mv.xyz));
        // In flight: bright loose stars. Settled: dimmer, and faded on the far hemisphere.
        vAlpha = mix(.85, smoothstep(-.05,.35,facing) * settled, t);
        gl_PointSize = mix(3.2, 1.7, t) * pixelRatio * (4.4 / -mv.z); }`,
    fragmentShader: `varying float vAlpha; void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard;
      gl_FragColor = vec4(vec3(.87,.9,1.), vAlpha * smoothstep(.5,.1,d)); }`,
  });
  const land = new THREE.Points(landGeometry, landMaterial);
  land.renderOrder = 1;
  globe.add(land);

  // Atmosphere: a soft violet rim, independent of globe rotation.
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { color: { value: COLORS.atmosphere }, strength: { value: 0 } },
    vertexShader: 'varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    // Back faces: facing is 0 at the outer silhouette and grows toward the globe's limb.
    fragmentShader: 'uniform vec3 color; uniform float strength; varying vec3 vNormal; void main(){ float facing = -dot(vNormal, vec3(0.,0.,1.)); float i = pow(smoothstep(0., .6, facing), 2.2); gl_FragColor = vec4(color, i*strength); }',
  }));
  scene.add(atmosphere);

  // Orbital rings: twelve divisions, after the twelve palaces of a Zi Wei Dou Shu chart.
  const orbits = new THREE.Group();
  orbits.rotation.set(1.18, 0, 0.32);
  scene.add(orbits);
  const ringMaterial = new THREE.LineBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0, depthWrite: false });
  const circle = (radius, segments = 256) => new THREE.BufferGeometry().setFromPoints(Array.from({ length: segments }, (_, i) => { const a = (i / segments) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0); }));
  orbits.add(new THREE.LineLoop(circle(1.42), ringMaterial));
  orbits.add(new THREE.LineLoop(circle(1.47), ringMaterial));
  const ticks = [];
  for (let i = 0; i < 72; i += 1) {
    const a = (i / 72) * Math.PI * 2;
    const outer = i % 6 === 0 ? 1.56 : 1.49;
    ticks.push(new THREE.Vector3(Math.cos(a) * 1.42, Math.sin(a) * 1.42, 0), new THREE.Vector3(Math.cos(a) * outer, Math.sin(a) * outer, 0));
  }
  orbits.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), ringMaterial));
  const outerOrbit = new THREE.Group();
  outerOrbit.rotation.set(1.42, 0.28, -0.5);
  scene.add(outerOrbit);
  const dotMaterial = new THREE.PointsMaterial({ color: COLORS.starlight, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
  outerOrbit.add(new THREE.Points(circle(1.86, 180), dotMaterial));

  // City markers (visual only — the clickable targets are DOM buttons positioned over them).
  const cityVectors = cities.map(city => vec(city.lat, city.lon, 1.012));
  const markerGeometry = new THREE.BufferGeometry().setFromPoints(cityVectors);
  const markerColors = new Float32Array(cities.length * 3);
  const markerSizes = new Float32Array(cities.length);
  markerGeometry.setAttribute('color', new THREE.BufferAttribute(markerColors, 3));
  markerGeometry.setAttribute('size', new THREE.BufferAttribute(markerSizes, 1));
  const markerMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { pixelRatio: { value: renderer.getPixelRatio() }, opacity: { value: 0 }, time: { value: 0 } },
    vertexShader: `attribute vec3 color; attribute float size; uniform float pixelRatio; uniform float time; varying vec3 vColor; varying float vFacing;
      void main(){ vColor = color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        vec3 center = (modelViewMatrix*vec4(0.,0.,0.,1.)).xyz; vFacing = smoothstep(.0,.25,dot(normalize(mv.xyz-center), normalize(-mv.xyz)));
        gl_PointSize = size * pixelRatio * (4.4 / -mv.z); }`,
    fragmentShader: `uniform float opacity; varying vec3 vColor; varying float vFacing; void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard;
      float core = smoothstep(.16,.05,d); float halo = smoothstep(.5,.0,d)*.55; gl_FragColor = vec4(vColor, (core + halo*halo) * opacity * vFacing); }`,
  });
  const markers = new THREE.Points(markerGeometry, markerMaterial);
  markers.renderOrder = 3;
  globe.add(markers);

  const routeMaterial = new THREE.LineBasicMaterial({ color: COLORS.gold, transparent: true, opacity: 0, depthWrite: false });
  let route;
  const tmp = new THREE.Vector3();

  let selectedId = null;
  let hoveredId = null;
  function refreshMarkers() {
    cities.forEach((city, i) => {
      const status = records.getStatus(city.id);
      const color = status === 'visited' ? COLORS.gold : status === 'wishlist' ? COLORS.violet : COLORS.starlight;
      markerColors.set([color.r, color.g, color.b], i * 3);
      const emphasis = city.id === selectedId ? 1.6 : city.id === hoveredId ? 1.3 : 1;
      markerSizes[i] = (status === 'visited' ? 30 : status === 'wishlist' ? 22 : 18) * emphasis;
    });
    markerGeometry.attributes.color.needsUpdate = true;
    markerGeometry.attributes.size.needsUpdate = true;
  }

  function refreshStatuses() {
    refreshMarkers();
    // Constellation: visited cities joined in the order they were first visited.
    if (route) { globe.remove(route); route.geometry.dispose(); }
    const ids = records.visitedRoute();
    const points = [];
    for (let i = 1; i < ids.length; i += 1) {
      const a = cityVectors[cities.findIndex(c => c.id === ids[i - 1])].clone().normalize();
      const b = cityVectors[cities.findIndex(c => c.id === ids[i])].clone().normalize();
      const angle = a.angleTo(b);
      for (let s = 0; s <= 48; s += 1) {
        const t = s / 48;
        const p = new THREE.Vector3().copy(a).multiplyScalar(Math.sin((1 - t) * angle)).addScaledVector(b, Math.sin(t * angle)).divideScalar(Math.sin(angle) || 1);
        points.push(p.normalize().multiplyScalar(1.012 + Math.sin(Math.PI * t) * angle * 0.12));
      }
      points.push(new THREE.Vector3(NaN, NaN, NaN)); // break between segments
    }
    const segmentPoints = [];
    for (let i = 1; i < points.length; i += 1) if (!Number.isNaN(points[i].x) && !Number.isNaN(points[i - 1].x)) segmentPoints.push(points[i - 1], points[i]);
    route = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segmentPoints), routeMaterial);
    route.renderOrder = 2;
    globe.add(route);
  }
  refreshStatuses();

  // View state, eased toward targets every frame.
  const home = rotationToFace(HOME.lat, HOME.lon);
  const view = { rx: home.x, ry: home.y - 0.9, distance: HOME.distance + 1.2, offsetX: 0, offsetY: 0 };
  const target = { rx: home.x, ry: home.y, distance: HOME.distance, offsetX: 0, offsetY: 0 };
  if (reducedMotion) Object.assign(view, target);
  let velocity = 0;
  let lastMove = 0;
  let lastInteraction = -Infinity;
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  let introElapsed = 0;
  let introDone = reducedMotion;
  let elapsed = 0;

  function finishIntro() {
    if (introDone) return;
    introDone = true;
    landMaterial.uniforms.progress.value = 1;
    onIntroEnd?.();
  }

  // Pointer and touch: drag to rotate, pinch or ctrl+wheel to zoom.
  const canvas = renderer.domElement;
  const pointers = new Map();
  let pinchStart = 0;
  let pinchDistance = 0;
  const clampLat = value => Math.max(-1.25, Math.min(1.25, value));
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    velocity = 0;
    lastInteraction = performance.now();
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); pinchDistance = target.distance; }
  });
  canvas.addEventListener('pointermove', event => {
    const rect = canvas.getBoundingClientRect();
    parallax.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 0.06;
    parallax.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 0.04;
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastInteraction = performance.now();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      zoomTo(pinchDistance * (pinchStart / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))));
      return;
    }
    const speed = 2.6 / rect.height * (target.distance / HOME.distance);
    const dx = (event.clientX - previous.x) * speed;
    target.ry += dx;
    target.rx = clampLat(target.rx + (event.clientY - previous.y) * speed);
    velocity = Math.max(-0.04, Math.min(0.04, dx));
    lastMove = performance.now();
    if (reducedMotion) { view.ry = target.ry; view.rx = target.rx; }
  });
  // Only a pointer still moving at release carries inertia.
  const release = event => { pointers.delete(event.pointerId); if (reducedMotion || performance.now() - lastMove > 90) velocity = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { parallax.tx = 0; parallax.ty = 0; });
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey) return; // Plain wheel keeps scrolling the page.
    event.preventDefault();
    zoomTo(target.distance * (1 + event.deltaY * 0.01));
  }, { passive: false });

  function zoomTo(distance) {
    target.distance = Math.max(2.1, Math.min(7, distance));
    lastInteraction = performance.now();
    if (reducedMotion) view.distance = target.distance;
  }
  const shortest = (from, to) => from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

  // Resize and visibility.
  let width = 1, height = 1;
  const resize = () => {
    width = container.clientWidth || 1; height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  let onScreen = true;
  const intersection = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) schedule(); });
  intersection.observe(container);
  document.addEventListener('visibilitychange', schedule);

  // Frame loop.
  let frame = 0;
  let last = performance.now();
  const projected = cities.map(city => ({ id: city.id, x: 0, y: 0, facing: 0 }));
  const cameraWorld = new THREE.Vector3();
  function schedule() { if (!frame && onScreen && document.visibilityState === 'visible') { last = performance.now(); frame = requestAnimationFrame(render); } }
  function render(now) {
    frame = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 4);

    if (!introDone) {
      // Advances with rendered frames, so a page opened in a background tab still plays the intro when shown.
      introElapsed += dt;
      const p = Math.min(1, introElapsed / INTRO_SECONDS);
      landMaterial.uniforms.progress.value = p;
      if (p >= 1) finishIntro();
    }
    const progress = landMaterial.uniforms.progress.value;
    const reveal = THREE.MathUtils.smoothstep(progress, 0.62, 1);
    sphereMaterial.opacity = reveal;
    sphereMaterial.depthWrite = reveal > 0.3;
    atmosphereStrength(reveal);
    ringMaterial.opacity = 0.32 * reveal;
    dotMaterial.opacity = 0.35 * reveal;
    markerMaterial.uniforms.opacity.value = THREE.MathUtils.smoothstep(progress, 0.85, 1);
    routeMaterial.opacity = 0.75 * THREE.MathUtils.smoothstep(progress, 0.9, 1);

    // Ambient drift after a few idle seconds; inertia after a drag.
    const idle = now - lastInteraction > 6000 && !selectedId && !pointers.size;
    if (!reducedMotion) {
      if (!pointers.size && Math.abs(velocity) > 0.0001) { target.ry += velocity; velocity *= 0.9; }
      if (idle) target.ry += dt * 0.035;
      orbits.rotation.z += dt * 0.012;
      outerOrbit.rotation.z -= dt * 0.006;
      stars.rotation.y += dt * 0.003;
      parallax.x += (parallax.tx - parallax.x) * k * 0.5;
      parallax.y += (parallax.ty - parallax.y) * k * 0.5;
    }
    for (const key of ['rx', 'ry', 'distance', 'offsetX', 'offsetY']) view[key] += (target[key] - view[key]) * k;
    globe.rotation.set(view.rx, view.ry, 0, 'XYZ');
    // Portrait screens pull the camera back so the globe still fits the width.
    const distance = view.distance * Math.max(1, 0.74 / camera.aspect);
    camera.position.set(parallax.x * distance, -parallax.y * distance, distance);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(width, height, -view.offsetX * width, -view.offsetY * height, width, height);
    starMaterial.uniforms.time.value = elapsed;
    markerMaterial.uniforms.time.value = elapsed;
    renderer.render(scene, camera);

    // Project city markers for the DOM layer.
    globe.updateMatrixWorld();
    camera.getWorldPosition(cameraWorld);
    cityVectors.forEach((v, i) => {
      const world = tmp.copy(v).applyMatrix4(globe.matrixWorld);
      const facing = world.clone().normalize().dot(cameraWorld.clone().sub(world).normalize());
      world.project(camera);
      projected[i].x = (world.x * 0.5 + 0.5) * width;
      projected[i].y = (-world.y * 0.5 + 0.5) * height;
      projected[i].facing = markerMaterial.uniforms.opacity.value > 0.05 ? facing : -1;
    });
    onFrame(projected);
    schedule();
  }
  function atmosphereStrength(value) { atmosphere.material.uniforms.strength.value = 0.5 * value; }
  schedule();

  return {
    skipIntro: finishIntro,
    get introDone() { return introDone; },
    setFrame({ x = 0, y = 0 }) { target.offsetX = x; target.offsetY = y; if (reducedMotion) { view.offsetX = x; view.offsetY = y; } },
    zoomIn: () => zoomTo(target.distance * 0.8),
    zoomOut: () => zoomTo(target.distance * 1.25),
    rotate(dLon, dLat) { lastInteraction = performance.now(); target.ry += dLon; target.rx = clampLat(target.rx + dLat); if (reducedMotion) { view.ry = target.ry; view.rx = target.rx; } },
    reset() {
      lastInteraction = performance.now();
      Object.assign(target, { rx: home.x, ry: shortest(view.ry, home.y), distance: HOME.distance });
      velocity = 0;
      if (reducedMotion) Object.assign(view, { rx: target.rx, ry: target.ry, distance: target.distance });
    },
    focusCity(id) {
      const city = cities.find(c => c.id === id);
      if (!city) return;
      lastInteraction = performance.now();
      const face = rotationToFace(city.lat, city.lon);
      target.rx = clampLat(face.x);
      target.ry = shortest(view.ry, face.y);
      target.distance = Math.min(target.distance, 4);
      velocity = 0;
      if (reducedMotion) Object.assign(view, { rx: target.rx, ry: target.ry, distance: target.distance });
    },
    setSelected(id) { selectedId = id; refreshMarkers(); },
    setHovered(id) { hoveredId = id; refreshMarkers(); },
    refreshStatuses,
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      renderer.dispose();
      canvas.remove();
    },
  };
}
