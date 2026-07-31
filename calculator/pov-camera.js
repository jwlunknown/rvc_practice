/* RVC Bag Lab POV camera controls and enhanced perspective renderer */
(() => {
  const CAMERA_MARKER = 'RVC_POV_CAMERA_V3';
  if (window[CAMERA_MARKER]) return;
  window[CAMERA_MARKER] = true;

  const camera = {
    zoom: 1,
    yaw: 0,
    pitch: 0,
  };

  const radians = (degreesValue) => (degreesValue * Math.PI) / 180;

  function drawPolygon(ctx, points, fill, stroke, width = 1) {
    if (!points.length || points.some((point) => !point)) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function drawProjectedPath(ctx, points, project, stroke, width, alpha = 1) {
    const projected = points.map(project).filter(Boolean);
    if (projected.length < 2) return projected;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    projected.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    return projected;
  }

  renderPov = function renderAdjustablePov(state, fraction) {
    const canvas = $('povCanvas');
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || 1100);
    const height = width * 9 / 16;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, color('--panel-2'));
    sky.addColorStop(0.55, color('--bg'));
    sky.addColorStop(1, color('--grass'));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const yaw = radians(camera.yaw);
    const eyeRadius = 2.15;
    const baseEyeHeight = Math.max(5.25, state.y0 + 1.25);
    const eye = {
      x: state.releaseX - eyeRadius * Math.cos(yaw),
      y: baseEyeHeight + (camera.pitch / 20) * 2.5,
      z: state.releaseZ + eyeRadius * Math.sin(yaw),
    };
    const look = {
      x: 29.4,
      y: 0.9,
      z: state.zTarget,
    };

    const forward = vnorm(vsub(look, eye));
    const right = vnorm(vcross(forward, { x: 0, y: 1, z: 0 }));
    const up = vcross(right, forward);
    const fieldOfView = 68;
    const focal = ((width / 2) / Math.tan(radians(fieldOfView) / 2)) * camera.zoom;

    const project = (point) => {
      const relative = vsub(point, eye);
      const cameraX = vdot(relative, right);
      const cameraY = vdot(relative, up);
      const cameraZ = vdot(relative, forward);
      if (cameraZ <= 0.12) return null;
      return {
        x: width / 2 + (focal * cameraX) / cameraZ,
        y: height * 0.52 - (focal * cameraY) / cameraZ,
        z: cameraZ,
      };
    };

    const line3 = (a, b, stroke, lineWidth = 1, dash = []) => {
      const pointA = project(a);
      const pointB = project(b);
      if (!pointA || !pointB) return;
      ctx.save();
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(pointA.x, pointA.y);
      ctx.lineTo(pointB.x, pointB.y);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.restore();
    };

    for (let z = -5; z <= 5; z += 1) {
      line3({ x: -2, y: 0, z }, { x: 35, y: 0, z }, color('--grid'), 1);
    }
    for (let x = 0; x <= 35; x += 3) {
      line3({ x, y: 0, z: -5 }, { x, y: 0, z: 5 }, color('--grid'), 1);
    }
    line3(
      { x: 0, y: 0.02, z: -5 },
      { x: 0, y: 0.02, z: 5 },
      color('--danger'),
      3,
      [10, 7],
    );

    const boardCorners = [
      { x: 27, y: BOARD_FRONT_HEIGHT, z: -1 },
      { x: 27, y: BOARD_FRONT_HEIGHT, z: 1 },
      { x: 31, y: 1, z: 1 },
      { x: 31, y: 1, z: -1 },
    ].map(project);
    drawPolygon(ctx, boardCorners, color('--court'), color('--text'), 2);

    const holePoints = [];
    for (let index = 0; index <= 48; index += 1) {
      const angle = (index / 48) * Math.PI * 2;
      const depth = HOLE_DEPTH + 0.25 * Math.cos(angle);
      const z = 0.25 * Math.sin(angle);
      holePoints.push(project({ x: 27 + depth, y: boardHeight(depth), z }));
    }
    drawPolygon(ctx, holePoints, color('--panel'), color('--text'), 1.5);

    const trajectory = samples(state, 180).out;
    drawProjectedPath(ctx, trajectory, project, color('--accent'), 11, 0.14);
    drawProjectedPath(ctx, trajectory, project, color('--accent'), 4, 0.92);

    for (let index = 1; index < 10; index += 1) {
      const sample = sampleAt((state.T * index) / 10, state);
      const point = project(sample);
      if (!point) continue;
      ctx.save();
      ctx.fillStyle = color('--accent-4');
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const release = project({ x: state.releaseX, y: state.y0, z: state.releaseZ });
    const impact = project({ x: state.impactX, y: state.impactY, z: state.zTarget });
    const apex = project(state.apex);

    if (release && impact) {
      ctx.save();
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.moveTo(release.x, release.y);
      ctx.lineTo(impact.x, impact.y);
      ctx.strokeStyle = color('--accent-2');
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = color('--accent-3');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(impact.x - 18, impact.y);
      ctx.lineTo(impact.x + 18, impact.y);
      ctx.moveTo(impact.x, impact.y - 18);
      ctx.lineTo(impact.x, impact.y + 18);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = color('--accent-4');
      ctx.beginPath();
      ctx.arc(release.x, release.y, 8, 0, Math.PI * 2);
      ctx.fill();

      const armStart = {
        x: controls.throwHand.value === 'right' ? width * 0.92 : width * 0.08,
        y: height * 0.92,
      };
      ctx.save();
      ctx.strokeStyle = color('--muted');
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(14, width * 0.018);
      ctx.beginPath();
      ctx.moveTo(armStart.x, armStart.y);
      ctx.quadraticCurveTo(
        (armStart.x + release.x) / 2,
        release.y + 45,
        release.x,
        release.y,
      );
      ctx.stroke();
      ctx.fillStyle = color('--text');
      ctx.beginPath();
      ctx.ellipse(
        release.x,
        release.y,
        16,
        10,
        controls.throwHand.value === 'right' ? -0.35 : 0.35,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    if (apex) {
      ctx.save();
      ctx.fillStyle = color('--danger');
      ctx.beginPath();
      ctx.arc(apex.x, apex.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${Math.max(11, width * 0.012)}px system-ui`;
      ctx.fillStyle = color('--text');
      ctx.fillText(`apex ${state.apex.y.toFixed(2)} ft`, apex.x + 9, apex.y - 8);
      ctx.restore();
    }

    const bagPoint = project(sampleAt(state.T * clamp(fraction, 0, 1), state));
    if (bagPoint) {
      const radius = clamp(150 / bagPoint.z, 6, 16);
      ctx.save();
      ctx.fillStyle = color('--accent-3');
      ctx.beginPath();
      ctx.arc(bagPoint.x, bagPoint.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color('--panel');
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = color('--muted');
    ctx.font = `${Math.max(12, width * 0.013)}px system-ui`;
    const playback = +$('playbackSpeed').value || 1;
    ctx.fillText(
      `POV · ${controls.throwHand.value}-hand · zoom ${camera.zoom.toFixed(2)}× · angle ${Math.round(camera.yaw)}° · height ${Math.round(camera.pitch)}° · ${playback.toFixed(2)}× playback`,
      16,
      height - 18,
    );
    ctx.restore();
  };

  function setupCameraControls() {
    const view = document.querySelector('.view.pov');
    const canvas = $('povCanvas');
    if (!view || !canvas || $('povZoom')) return;

    const style = document.createElement('style');
    style.id = 'povCameraStyles';
    style.textContent = `
      .pov-camera-controls{margin:0 0 9px;padding:9px 10px;border:1px solid var(--border);border-radius:11px;background:var(--panel)}
      .pov-camera-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
      .pov-camera-head span{color:var(--muted);font-size:.74rem}
      .pov-camera-grid{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr)) auto;gap:9px;align-items:end}
      .pov-camera-grid label{display:grid;gap:4px;color:var(--muted);font-size:.78rem}
      .pov-camera-grid label>span{display:flex;justify-content:space-between;gap:8px}
      .pov-camera-grid output{color:var(--accent);font-weight:750;font-variant-numeric:tabular-nums}
      .pov-camera-grid input{width:100%}
      #povCanvas{cursor:grab;touch-action:none}
      body.camera-dragging #povCanvas{cursor:grabbing}
      @media(max-width:900px){.pov-camera-grid{grid-template-columns:repeat(2,minmax(130px,1fr))}.pov-camera-head{display:block}.pov-camera-head span{display:block;margin-top:2px}}
      @media(max-width:520px){.pov-camera-grid{grid-template-columns:1fr}.pov-camera-grid .action-button{width:100%}}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('section');
    panel.className = 'pov-camera-controls';
    panel.setAttribute('aria-label', 'Player POV camera controls');
    panel.innerHTML = `
      <div class="pov-camera-head">
        <strong>POV camera</strong>
        <span>Drag the view to orbit · scroll to zoom</span>
      </div>
      <div class="pov-camera-grid">
        <label><span>Zoom <output id="povZoomValue">1.00×</output></span><input id="povZoom" type="range" min="0.55" max="2.20" step="0.05" value="1"></label>
        <label><span>Side angle <output id="povYawValue">0°</output></span><input id="povYaw" type="range" min="-55" max="55" step="1" value="0"></label>
        <label><span>View height <output id="povPitchValue">0°</output></span><input id="povPitch" type="range" min="-20" max="20" step="1" value="0"></label>
        <button id="resetPovCamera" class="action-button" type="button">Reset camera</button>
      </div>`;
    view.insertBefore(panel, canvas);

    const zoom = $('povZoom');
    const yaw = $('povYaw');
    const pitch = $('povPitch');

    const sync = () => {
      zoom.value = camera.zoom;
      yaw.value = camera.yaw;
      pitch.value = camera.pitch;
      $('povZoomValue').textContent = `${camera.zoom.toFixed(2)}×`;
      $('povYawValue').textContent = `${Math.round(camera.yaw)}°`;
      $('povPitchValue').textContent = `${Math.round(camera.pitch)}°`;
      if (current) renderPov(current, currentFraction);
    };

    zoom.addEventListener('input', () => {
      camera.zoom = +zoom.value;
      sync();
    });
    yaw.addEventListener('input', () => {
      camera.yaw = +yaw.value;
      sync();
    });
    pitch.addEventListener('input', () => {
      camera.pitch = +pitch.value;
      sync();
    });
    $('resetPovCamera').addEventListener('click', () => {
      camera.zoom = 1;
      camera.yaw = 0;
      camera.pitch = 0;
      sync();
    });

    let drag = null;
    canvas.addEventListener('pointerdown', (event) => {
      drag = {
        x: event.clientX,
        y: event.clientY,
        yaw: camera.yaw,
        pitch: camera.pitch,
      };
      canvas.setPointerCapture?.(event.pointerId);
      document.body.classList.add('camera-dragging');
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drag) return;
      camera.yaw = clamp(drag.yaw + (event.clientX - drag.x) * 0.16, -55, 55);
      camera.pitch = clamp(drag.pitch - (event.clientY - drag.y) * 0.1, -20, 20);
      sync();
    });
    const stopDrag = () => {
      drag = null;
      document.body.classList.remove('camera-dragging');
    };
    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);
    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        camera.zoom = clamp(
          camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08),
          0.55,
          2.2,
        );
        sync();
      },
      { passive: false },
    );

    sync();
  }

  setupCameraControls();
})();