const G = 32.174;
const MPH_TO_FPS = 1.46667;
const BOARD_FRONT_HEIGHT = 3.5 / 12;
const BOARD_BACK_HEIGHT = 1.0;
const HOLE_DEPTH = 3.25;
const HOLE_Y =
  BOARD_FRONT_HEIGHT +
  (BOARD_BACK_HEIGHT - BOARD_FRONT_HEIGHT) * (HOLE_DEPTH / 4.0);

const $ = (id) => document.getElementById(id);

const controls = {
  throwSide: $("throwSide"),
  boxPosition: $("boxPosition"),
  handReach: $("handReach"),
  releaseHeight: $("releaseHeight"),
  targetDepth: $("targetDepth"),
  targetZ: $("targetZ"),
  flightTime: $("flightTime"),
  dragCalibration: $("dragCalibration"),
  headWind: $("headWind"),
  crossWind: $("crossWind"),
  temperature: $("temperature"),
  humidity: $("humidity"),
  elevation: $("elevation"),
  bagWeight: $("bagWeight"),
  showIdeal: $("showIdeal"),
};

const valueEls = {
  boxPosition: $("boxPositionValue"),
  handReach: $("handReachValue"),
  releaseHeight: $("releaseHeightValue"),
  targetDepth: $("targetDepthValue"),
  targetZ: $("targetZValue"),
  flightTime: $("flightTimeValue"),
  dragCalibration: $("dragCalibrationValue"),
  headWind: $("headWindValue"),
  crossWind: $("crossWindValue"),
};

const metrics = {
  x: $("metricX"),
  vx0: $("metricVx0"),
  vx1: $("metricVx1"),
  peak: $("metricPeak"),
  launch: $("metricLaunch"),
  azimuth: $("metricAzimuth"),
};

let current = null;
let animationFrame = null;
let animationStarted = null;
let playing = false;
let activeImpactDrag = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function airDensity(tempF, humidityPct, elevationFt) {
  const tempC = ((tempF - 32) * 5) / 9;
  const tempK = tempC + 273.15;
  const heightM = elevationFt * 0.3048;
  const pressure =
    101325 * Math.pow(Math.max(0.1, 1 - 2.25577e-5 * heightM), 5.25588);
  const saturation =
    610.94 * Math.exp((17.625 * tempC) / (tempC + 243.04));
  const vapor = (clamp(humidityPct, 0, 100) / 100) * saturation;
  const dry = Math.max(0, pressure - vapor);
  return dry / (287.058 * tempK) + vapor / (461.495 * tempK);
}

function solveInitialHorizontal(displacement, time, drag, wind) {
  if (Math.abs(drag) < 1e-8) return displacement / time;
  return (
    wind +
    ((displacement - wind * time) * drag) / (1 - Math.exp(-drag * time))
  );
}

function horizontalPosition(start, velocity0, wind, time, drag) {
  if (Math.abs(drag) < 1e-8) return start + velocity0 * time;
  return (
    start +
    wind * time +
    ((velocity0 - wind) / drag) * (1 - Math.exp(-drag * time))
  );
}

function horizontalVelocity(velocity0, wind, time, drag) {
  if (Math.abs(drag) < 1e-8) return velocity0;
  return wind + (velocity0 - wind) * Math.exp(-drag * time);
}

function boardHeight(depth) {
  return (
    BOARD_FRONT_HEIGHT +
    (BOARD_BACK_HEIGHT - BOARD_FRONT_HEIGHT) * (depth / 4.0)
  );
}

function calculate() {
  const side = +controls.throwSide.value;
  const boxPosition = +controls.boxPosition.value;
  const reach = +controls.handReach.value;
  const y0 = +controls.releaseHeight.value;
  const depth = +controls.targetDepth.value;
  const zTarget = +controls.targetZ.value;
  const T = +controls.flightTime.value;
  const dragCalibration = +controls.dragCalibration.value;
  const headWindMph = +controls.headWind.value;
  const crossWindMph = +controls.crossWind.value;
  const temp = +controls.temperature.value;
  const humidity = +controls.humidity.value;
  const elevation = +controls.elevation.value;
  const weightOz = +controls.bagWeight.value;

  const density = airDensity(temp, humidity, elevation);
  const densityRatio = density / 1.225;
  const massFactor = 16 / Math.max(1, weightOz);
  const k = dragCalibration * densityRatio * massFactor;

  const releaseZ = side * (1 + boxPosition);
  const releaseX = reach;
  const impactX = 27 + depth;
  const impactY = boardHeight(depth);
  const xDisplacement = impactX - releaseX;
  const zDisplacement = zTarget - releaseZ;
  const windX = headWindMph * MPH_TO_FPS;
  const windZ = crossWindMph * MPH_TO_FPS;

  const vx0 = solveInitialHorizontal(xDisplacement, T, k, windX);
  const vz0 = solveInitialHorizontal(zDisplacement, T, k, windZ);
  const vy0 = (impactY - y0 + 0.5 * G * T * T) / T;
  const vxImpact = horizontalVelocity(vx0, windX, T, k);
  const vzImpact = horizontalVelocity(vz0, windZ, T, k);
  const vyImpact = vy0 - G * T;

  const horizontal0 = Math.hypot(vx0, vz0);
  const horizontalImpact = Math.hypot(vxImpact, vzImpact);
  const launchAngle = (Math.atan2(vy0, horizontal0) * 180) / Math.PI;
  const azimuth = (Math.atan2(vz0, vx0) * 180) / Math.PI;
  const impactAngle =
    (Math.atan2(Math.max(0, -vyImpact), horizontalImpact) * 180) / Math.PI;
  const apexTime = clamp(vy0 / G, 0, T);
  const apex = sampleAt(apexTime, {
    releaseX,
    releaseZ,
    y0,
    vx0,
    vy0,
    vz0,
    windX,
    windZ,
    k,
  });

  return {
    side,
    boxPosition,
    reach,
    y0,
    depth,
    zTarget,
    T,
    dragCalibration,
    density,
    densityRatio,
    k,
    releaseZ,
    releaseX,
    impactX,
    impactY,
    xDisplacement,
    zDisplacement,
    windX,
    windZ,
    headWindMph,
    crossWindMph,
    vx0,
    vz0,
    vy0,
    vxImpact,
    vzImpact,
    vyImpact,
    horizontal0,
    horizontalImpact,
    launchAngle,
    azimuth,
    impactAngle,
    apex,
  };
}

function sampleAt(t, state) {
  return {
    t,
    x: horizontalPosition(
      state.releaseX,
      state.vx0,
      state.windX,
      t,
      state.k,
    ),
    y: state.y0 + state.vy0 * t - 0.5 * G * t * t,
    z: horizontalPosition(
      state.releaseZ,
      state.vz0,
      state.windZ,
      t,
      state.k,
    ),
    vx: horizontalVelocity(state.vx0, state.windX, t, state.k),
    vy: state.vy0 - G * t,
    vz: horizontalVelocity(state.vz0, state.windZ, t, state.k),
  };
}

function idealSampleAt(t, state) {
  return {
    t,
    x:
      state.releaseX +
      (state.impactX - state.releaseX) * (t / state.T),
    y: state.y0 + state.vy0 * t - 0.5 * G * t * t,
    z:
      state.releaseZ +
      (state.zTarget - state.releaseZ) * (t / state.T),
  };
}

function samples(state, count = 160) {
  const out = [];
  const ideal = [];
  for (let i = 0; i <= count; i += 1) {
    const t = (state.T * i) / count;
    out.push(sampleAt(t, state));
    ideal.push(idealSampleAt(t, state));
  }
  return { out, ideal };
}

function pathFrom(points, map) {
  return points
    .map((point, index) => {
      const mapped = map(point);
      return `${index ? "L" : "M"} ${mapped.x.toFixed(2)} ${mapped.y.toFixed(2)}`;
    })
    .join(" ");
}

function svgEl(tag, attrs = {}, text = "") {
  const element = document.createElementNS(
    "http://www.w3.org/2000/svg",
    tag,
  );
  Object.entries(attrs).forEach(([key, value]) =>
    element.setAttribute(key, value),
  );
  if (text) element.textContent = text;
  return element;
}

function setupStaticSvgs() {
  const topBoards = $("topBoards");
  const topBoxes = $("topBoxes");
  const topGrid = $("topGrid");

  topBoards.append(
    svgEl("rect", {
      x: 120,
      y: 180,
      width: 90,
      height: 70,
      rx: 6,
      fill: "var(--panel-2)",
      stroke: "var(--text)",
      "stroke-width": 3,
    }),
    svgEl("circle", {
      cx: 138,
      cy: 215,
      r: 7,
      fill: "var(--panel)",
      stroke: "var(--text)",
      "stroke-width": 2,
    }),
    svgEl("rect", {
      x: 790,
      y: 180,
      width: 90,
      height: 70,
      rx: 6,
      fill: "var(--panel-2)",
      stroke: "var(--text)",
      "stroke-width": 3,
    }),
    svgEl("circle", {
      cx: 863,
      cy: 215,
      r: 7,
      fill: "var(--panel)",
      stroke: "var(--text)",
      "stroke-width": 2,
    }),
  );

  [
    [120, 75],
    [120, 250],
    [790, 75],
    [790, 250],
  ].forEach(([x, y]) =>
    topBoxes.appendChild(
      svgEl("rect", {
        x,
        y,
        width: 90,
        height: 105,
        rx: 7,
        fill: "var(--panel-2)",
        opacity: 0.55,
        stroke: "var(--border)",
        "stroke-width": 2,
      }),
    ),
  );

  topGrid.append(
    svgEl("line", {
      x1: 210,
      y1: 55,
      x2: 210,
      y2: 375,
      stroke: "var(--danger)",
      "stroke-width": 3,
      "stroke-dasharray": "8 6",
    }),
    svgEl("line", {
      x1: 790,
      y1: 55,
      x2: 790,
      y2: 375,
      stroke: "var(--danger)",
      "stroke-width": 3,
      "stroke-dasharray": "8 6",
    }),
    svgEl(
      "text",
      { x: 210, y: 40, "text-anchor": "middle", class: "small-label" },
      "throwing foul line",
    ),
    svgEl(
      "text",
      { x: 790, y: 40, "text-anchor": "middle", class: "small-label" },
      "target front",
    ),
  );

  const sideGrid = $("sideGrid");
  const sideMapX = (x) => 65 + ((x + 3) / 35) * 890;
  const sideMapY = (y) => 435 - (y / 12) * 400;

  for (let x = -2; x <= 32; x += 2) {
    sideGrid.append(
      svgEl("line", {
        x1: sideMapX(x),
        y1: 35,
        x2: sideMapX(x),
        y2: 435,
        stroke: "var(--grid)",
        "stroke-width": 1,
      }),
      svgEl(
        "text",
        {
          x: sideMapX(x),
          y: 457,
          "text-anchor": "middle",
          class: "small-label",
        },
        String(x),
      ),
    );
  }

  for (let y = 0; y <= 12; y += 2) {
    sideGrid.append(
      svgEl("line", {
        x1: 65,
        y1: sideMapY(y),
        x2: 955,
        y2: sideMapY(y),
        stroke: "var(--grid)",
        "stroke-width": 1,
      }),
      svgEl(
        "text",
        {
          x: 55,
          y: sideMapY(y) + 4,
          "text-anchor": "end",
          class: "small-label",
        },
        String(y),
      ),
    );
  }

  const endGrid = $("endGrid");
  const endMapZ = (z) => 340 + (z / 5) * 280;
  const endMapY = (y) => 375 - (y / 12) * 350;

  for (let z = -5; z <= 5; z += 1) {
    endGrid.append(
      svgEl("line", {
        x1: endMapZ(z),
        y1: 25,
        x2: endMapZ(z),
        y2: 375,
        stroke: "var(--grid)",
        "stroke-width": 1,
      }),
      svgEl(
        "text",
        {
          x: endMapZ(z),
          y: 397,
          "text-anchor": "middle",
          class: "small-label",
        },
        String(z),
      ),
    );
  }

  for (let y = 0; y <= 12; y += 2) {
    endGrid.append(
      svgEl("line", {
        x1: 60,
        y1: endMapY(y),
        x2: 640,
        y2: endMapY(y),
        stroke: "var(--grid)",
        "stroke-width": 1,
      }),
      svgEl(
        "text",
        {
          x: 50,
          y: endMapY(y) + 4,
          "text-anchor": "end",
          class: "small-label",
        },
        String(y),
      ),
    );
  }

  const endBoard = $("endBoard");
  const zLeft = endMapZ(-1);
  const zRight = endMapZ(1);
  const yFront = endMapY(BOARD_FRONT_HEIGHT);
  const yBack = endMapY(1.0);

  endBoard.append(
    svgEl("rect", {
      x: zLeft,
      y: yBack,
      width: zRight - zLeft,
      height: yFront - yBack,
      fill: "var(--court)",
      stroke: "var(--text)",
      "stroke-width": 2,
      opacity: 0.75,
    }),
    svgEl("ellipse", {
      cx: endMapZ(0),
      cy: endMapY(HOLE_Y),
      rx: 15,
      ry: 7,
      fill: "var(--panel)",
      stroke: "var(--text)",
      "stroke-width": 2,
    }),
    svgEl(
      "text",
      {
        x: 340,
        y: yBack - 10,
        "text-anchor": "middle",
        class: "small-label",
      },
      "target board projection",
    ),
  );
}

function updateSideBoard() {
  const group = $("sideBoard");
  group.textContent = "";

  const mapX = (x) => 65 + ((x + 3) / 35) * 890;
  const mapY = (y) => 435 - (y / 12) * 400;
  const x1 = mapX(27);
  const x2 = mapX(31);
  const y1 = mapY(BOARD_FRONT_HEIGHT);
  const y2 = mapY(1.0);

  group.append(
    svgEl("polygon", {
      points: `${x1},${y1} ${x2},${y2} ${x2},${y2 + 12} ${x1},${y1 + 12}`,
      fill: "var(--court)",
      stroke: "var(--text)",
      "stroke-width": 2,
    }),
    svgEl("line", {
      x1: x1 + 12,
      y1: y1 + 12,
      x2: x1 + 12,
      y2: 435,
      stroke: "var(--text)",
      "stroke-width": 3,
    }),
    svgEl("line", {
      x1: x2 - 12,
      y1: y2 + 12,
      x2: x2 - 12,
      y2: 435,
      stroke: "var(--text)",
      "stroke-width": 3,
    }),
    svgEl("ellipse", {
      cx: mapX(27 + HOLE_DEPTH),
      cy: mapY(HOLE_Y),
      rx: 9,
      ry: 4,
      fill: "var(--panel)",
      stroke: "var(--text)",
      "stroke-width": 2,
    }),
    svgEl(
      "text",
      {
        x: (x1 + x2) / 2,
        y: y2 - 14,
        "text-anchor": "middle",
        class: "small-label",
      },
      "board",
    ),
  );
}

function setGradient(id, point1, point2) {
  const gradient = $(id);
  gradient.setAttribute("x1", point1.x);
  gradient.setAttribute("y1", point1.y);
  gradient.setAttribute("x2", point2.x);
  gradient.setAttribute("y2", point2.y);
}

function setCircle(id, point) {
  const element = $(id);
  if (!element) return;
  element.setAttribute("cx", point.x);
  element.setAttribute("cy", point.y);
}

function setTextPosition(id, x, y) {
  const element = $(id);
  element.setAttribute("x", x);
  element.setAttribute("y", y);
}

function render(state) {
  current = state;
  const sampled = samples(state);

  valueEls.boxPosition.textContent = `${state.boxPosition.toFixed(2)} ft`;
  valueEls.handReach.textContent = `${state.reach.toFixed(2)} ft`;
  valueEls.releaseHeight.textContent = `${state.y0.toFixed(2)} ft`;
  valueEls.targetDepth.textContent = `${state.depth.toFixed(2)} ft`;
  valueEls.targetZ.textContent = `${state.zTarget.toFixed(2)} ft`;
  valueEls.flightTime.textContent = `${state.T.toFixed(2)} s`;
  valueEls.dragCalibration.textContent =
    `${state.dragCalibration.toFixed(3)} s⁻¹`;
  valueEls.headWind.textContent = `${state.headWindMph.toFixed(1)} mph`;
  valueEls.crossWind.textContent = `${state.crossWindMph.toFixed(1)} mph`;

  metrics.x.textContent = `${state.xDisplacement.toFixed(2)} ft`;
  metrics.vx0.textContent = `${state.vx0.toFixed(1)} ft/s`;
  metrics.vx1.textContent = `${state.vxImpact.toFixed(1)} ft/s`;
  metrics.peak.textContent = `${state.apex.y.toFixed(2)} ft`;
  metrics.launch.textContent = `${state.launchAngle.toFixed(1)}°`;
  metrics.azimuth.textContent = `${state.azimuth.toFixed(1)}°`;

  const loss = state.vx0
    ? (100 * (state.vx0 - state.vxImpact)) / state.vx0
    : 0;
  const windBits = [];

  if (Math.abs(state.headWindMph) > 0.1) {
    windBits.push(
      `${state.headWindMph > 0 ? "tailwind" : "headwind"} ${Math.abs(
        state.headWindMph,
      ).toFixed(1)} mph`,
    );
  }

  if (Math.abs(state.crossWindMph) > 0.1) {
    windBits.push(
      `${state.crossWindMph > 0 ? "rightward" : "leftward"} crosswind ${Math.abs(
        state.crossWindMph,
      ).toFixed(1)} mph`,
    );
  }

  const windText = windBits.length
    ? ` With ${windBits.join(
        " and ",
      )}, the horizontal path bends because drag nudges the bag velocity toward the moving air.`
    : "";

  $("xExplanation").innerHTML =
    state.k < 1e-8
      ? `With drag at zero, <strong>Vx remains ${state.vx0.toFixed(
          1,
        )} ft/s</strong> throughout the flight. In this idealized limit, wind does not bend the path because there is no aerodynamic coupling.`
      : `In this simplified drag model, Vx falls from <strong>${state.vx0.toFixed(
          1,
        )}</strong> to <strong>${state.vxImpact.toFixed(
          1,
        )} ft/s</strong> (${loss.toFixed(1)}% loss).${windText}`;

  renderTop(state, sampled);
  renderSide(state, sampled);
  renderEnd(state, sampled);
  updateSideBoard();
  setAnimationTime(Math.min(+$("timeScrubber").value, 1));
}

function renderTop(state, sampled) {
  const mapX = (x) => 210 + (x / 31) * 670;
  const mapZ = (z) => 215 + z * 34;
  const path = pathFrom(sampled.out, (point) => ({
    x: mapX(point.x),
    y: mapZ(point.z),
  }));

  $("topPath").setAttribute("d", path);
  $("topPathGlow").setAttribute("d", path);
  $("topCenterReference").setAttribute(
    "d",
    `M ${mapX(state.releaseX)} ${mapZ(0)} L ${mapX(state.impactX)} ${mapZ(0)}`,
  );

  const release = {
    x: mapX(state.releaseX),
    y: mapZ(state.releaseZ),
  };
  const impact = {
    x: mapX(state.impactX),
    y: mapZ(state.zTarget),
  };

  setGradient("topGrad", release, impact);
  setCircle("topRelease", release);
  setCircle("topImpact", impact);
  setCircle("topImpactHit", impact);
  setTextPosition("topReleaseText", release.x + 12, release.y - 10);
  setTextPosition("topImpactText", impact.x - 58, impact.y - 10);
}

function renderSide(state, sampled) {
  const mapX = (x) => 65 + ((x + 3) / 35) * 890;
  const mapY = (y) => 435 - (y / 12) * 400;
  const path = pathFrom(sampled.out, (point) => ({
    x: mapX(point.x),
    y: mapY(point.y),
  }));

  $("sidePath").setAttribute("d", path);
  $("sidePathGlow").setAttribute("d", path);
  $("sideIdealPath").setAttribute(
    "d",
    pathFrom(sampled.ideal, (point) => ({
      x: mapX(point.x),
      y: mapY(point.y),
    })),
  );
  $("sideIdealPath").style.display =
    controls.showIdeal.checked && state.k > 1e-8 ? "" : "none";

  const release = {
    x: mapX(state.releaseX),
    y: mapY(state.y0),
  };
  const impact = {
    x: mapX(state.impactX),
    y: mapY(state.impactY),
  };
  const apex = {
    x: mapX(state.apex.x),
    y: mapY(state.apex.y),
  };

  setGradient("sideGrad", release, impact);
  setCircle("sideRelease", release);
  setCircle("sideImpact", impact);
  setCircle("sideImpactHit", impact);
  setCircle("sideApex", apex);

  const arrows = $("velocityArrows");
  arrows.textContent = "";

  const point = sampleAt(state.T * 0.52, state);
  const px = mapX(point.x);
  const py = mapY(point.y);
  const vxLength = clamp(Math.abs(point.vx) * 3.1, 35, 125);
  const vyLength = clamp(Math.abs(point.vy) * 2.4, 18, 100);
  const vyDirection = point.vy >= 0 ? -1 : 1;
  const vxDirection = point.vx >= 0 ? 1 : -1;

  arrows.append(
    svgEl("line", {
      x1: px,
      y1: py,
      x2: px + vxDirection * vxLength,
      y2: py,
      stroke: "var(--accent-2)",
      "stroke-width": 4,
    }),
    svgEl("polygon", {
      points: `${px + vxDirection * vxLength},${py} ${
        px + vxDirection * (vxLength - 12)
      },${py - 7} ${px + vxDirection * (vxLength - 12)},${py + 7}`,
      fill: "var(--accent-2)",
    }),
    svgEl(
      "text",
      {
        x: px + (vxDirection * vxLength) / 2,
        y: py - 9,
        "text-anchor": "middle",
        class: "small-label",
      },
      `Vx ${point.vx.toFixed(1)}`,
    ),
    svgEl("line", {
      x1: px,
      y1: py,
      x2: px,
      y2: py + vyDirection * vyLength,
      stroke: "var(--accent-4)",
      "stroke-width": 4,
    }),
    svgEl("polygon", {
      points: `${px},${py + vyDirection * vyLength} ${px - 7},${
        py + vyDirection * (vyLength - 12)
      } ${px + 7},${py + vyDirection * (vyLength - 12)}`,
      fill: "var(--accent-4)",
    }),
    svgEl(
      "text",
      {
        x: px + 12,
        y: py + (vyDirection * vyLength) / 2,
        class: "small-label",
      },
      `Vy ${point.vy.toFixed(1)}`,
    ),
  );
}

function renderEnd(state, sampled) {
  const mapZ = (z) => 340 + (z / 5) * 280;
  const mapY = (y) => 375 - (y / 12) * 350;
  const path = pathFrom(sampled.out, (point) => ({
    x: mapZ(point.z),
    y: mapY(point.y),
  }));

  $("endPath").setAttribute("d", path);
  $("endPathGlow").setAttribute("d", path);

  const release = {
    x: mapZ(state.releaseZ),
    y: mapY(state.y0),
  };
  const impact = {
    x: mapZ(state.zTarget),
    y: mapY(state.impactY),
  };

  setGradient("endGrad", release, impact);
  setCircle("endRelease", release);
  setCircle("endImpact", impact);
  setCircle("endImpactHit", impact);
}

function setAnimationTime(fraction) {
  if (!current) return;

  const safeFraction = clamp(fraction, 0, 1);
  $("timeScrubber").value = safeFraction;

  const t = current.T * safeFraction;
  const point = sampleAt(t, current);
  $("timeReadout").textContent = `${t.toFixed(2)} s`;

  const topMapX = (x) => 210 + (x / 31) * 670;
  const topMapZ = (z) => 215 + z * 34;
  setCircle("topBag", {
    x: topMapX(point.x),
    y: topMapZ(point.z),
  });

  const sideMapX = (x) => 65 + ((x + 3) / 35) * 890;
  const sideMapY = (y) => 435 - (y / 12) * 400;
  setCircle("sideBag", {
    x: sideMapX(point.x),
    y: sideMapY(point.y),
  });

  const endMapZ = (z) => 340 + (z / 5) * 280;
  const endMapY = (y) => 375 - (y / 12) * 350;
  setCircle("endBag", {
    x: endMapZ(point.z),
    y: endMapY(point.y),
  });
}

function animate(timestamp) {
  if (!playing || !current) return;

  if (animationStarted === null) animationStarted = timestamp;

  const durationMs = current.T * 1000;
  const elapsed = timestamp - animationStarted;
  const fraction = elapsed / durationMs;

  if (fraction >= 1) {
    setAnimationTime(1);
    playing = false;
    animationStarted = null;
    $("playButton").textContent = "▶ Animate";
    return;
  }

  setAnimationTime(fraction);
  animationFrame = requestAnimationFrame(animate);
}

function togglePlay() {
  if (playing) {
    playing = false;
    cancelAnimationFrame(animationFrame);
    $("playButton").textContent = "▶ Animate";
    return;
  }

  if (+$("timeScrubber").value >= 0.999) setAnimationTime(0);

  playing = true;
  animationStarted =
    performance.now() - +$("timeScrubber").value * current.T * 1000;
  $("playButton").textContent = "❚❚ Pause";
  animationFrame = requestAnimationFrame(animate);
}

function reset() {
  controls.throwSide.value = "1";
  controls.boxPosition.value = "1.5";
  controls.handReach.value = "1.5";
  controls.releaseHeight.value = "4.2";
  controls.targetDepth.value = "2.75";
  controls.targetZ.value = "0";
  controls.flightTime.value = "1.25";
  controls.dragCalibration.value = "0.055";
  controls.headWind.value = "0";
  controls.crossWind.value = "0";
  controls.temperature.value = "77";
  controls.humidity.value = "24";
  controls.elevation.value = "1300";
  controls.bagWeight.value = "16";
  controls.showIdeal.checked = true;
  setAnimationTime(0);
  render(calculate());
}

function selectView(view) {
  const views = $("views");
  document
    .querySelectorAll(".view-button")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.view === view),
    );
  document
    .querySelectorAll(".view")
    .forEach((panel) =>
      panel.classList.toggle(
        "selected",
        view === "all" || panel.dataset.panel === view,
      ),
    );
  views.classList.toggle("single", view !== "all");
}

function snapToRange(control, value) {
  const min = Number(control.min);
  const max = Number(control.max);
  const step = Number(control.step) || 0;
  const bounded = clamp(value, min, max);
  if (!step) return bounded;
  const snapped = min + Math.round((bounded - min) / step) * step;
  return clamp(snapped, min, max);
}

function updateImpactControls(depth, zTarget) {
  if (Number.isFinite(depth)) {
    controls.targetDepth.value = String(
      snapToRange(controls.targetDepth, depth),
    );
  }
  if (Number.isFinite(zTarget)) {
    controls.targetZ.value = String(snapToRange(controls.targetZ, zTarget));
  }
  render(calculate());
}

function pointerInSvg(svg, event) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(matrix.inverse());
}

function updateImpactFromPointer(view, svg, event) {
  const point = pointerInSvg(svg, event);
  if (!point) return;

  let depth = Number.NaN;
  let zTarget = Number.NaN;

  if (view === "top") {
    const impactX = ((point.x - 210) / 670) * 31;
    depth = impactX - 27;
    zTarget = (point.y - 215) / 34;
  } else if (view === "side") {
    const impactX = ((point.x - 65) / 890) * 35 - 3;
    depth = impactX - 27;
  } else if (view === "end") {
    zTarget = ((point.x - 340) / 280) * 5;
  }

  updateImpactControls(depth, zTarget);
}

function setImpactActive(visiblePoint, hitTarget, active) {
  visiblePoint.setAttribute("r", active ? "12" : "8");
  visiblePoint.setAttribute("stroke-width", active ? "4" : "3");
  hitTarget.style.cursor = active ? "grabbing" : "grab";
}

function makeImpactDraggable(svgId, visibleId, view, label) {
  const svg = $(svgId);
  const visiblePoint = $(visibleId);
  const hitTarget = svgEl("circle", {
    id: `${visibleId}Hit`,
    r: 24,
    fill: "transparent",
    stroke: "transparent",
    "stroke-width": 1,
    "pointer-events": "all",
    role: "slider",
    "aria-label": label,
  });

  hitTarget.style.cursor = "grab";
  hitTarget.style.touchAction = "none";
  visiblePoint.style.pointerEvents = "none";
  svg.appendChild(hitTarget);

  hitTarget.appendChild(
    svgEl("title", {}, "Drag this orange point to move the target impact"),
  );

  hitTarget.addEventListener("pointerenter", () => {
    if (!activeImpactDrag) setImpactActive(visiblePoint, hitTarget, true);
  });

  hitTarget.addEventListener("pointerleave", () => {
    if (!activeImpactDrag) setImpactActive(visiblePoint, hitTarget, false);
  });

  hitTarget.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    if (playing) togglePlay();

    activeImpactDrag = {
      pointerId: event.pointerId,
      view,
      svg,
      hitTarget,
      visiblePoint,
    };

    hitTarget.setPointerCapture(event.pointerId);
    setImpactActive(visiblePoint, hitTarget, true);
    updateImpactFromPointer(view, svg, event);
  });

  hitTarget.addEventListener("pointermove", (event) => {
    if (
      !activeImpactDrag ||
      activeImpactDrag.hitTarget !== hitTarget ||
      activeImpactDrag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    updateImpactFromPointer(view, svg, event);
  });

  const finishDrag = (event) => {
    if (
      !activeImpactDrag ||
      activeImpactDrag.hitTarget !== hitTarget ||
      activeImpactDrag.pointerId !== event.pointerId
    ) {
      return;
    }

    if (hitTarget.hasPointerCapture(event.pointerId)) {
      hitTarget.releasePointerCapture(event.pointerId);
    }

    activeImpactDrag = null;
    setImpactActive(visiblePoint, hitTarget, false);
  };

  hitTarget.addEventListener("pointerup", finishDrag);
  hitTarget.addEventListener("pointercancel", finishDrag);
}

function setupDraggableImpacts() {
  makeImpactDraggable(
    "topSvg",
    "topImpact",
    "top",
    "Target impact point. Drag across the board to change landing depth and left-right target.",
  );
  makeImpactDraggable(
    "sideSvg",
    "sideImpact",
    "side",
    "Target impact point. Drag along the board to change landing depth.",
  );
  makeImpactDraggable(
    "endSvg",
    "endImpact",
    "end",
    "Target impact point. Drag left or right to change the target position.",
  );

  const hints = {
    top: "Forward distance and inside/outside alignment · drag the orange point",
    side: "The parabolic arc and changing velocity components · drag the orange point along the board",
    end: "Looking downcourt toward the target board · drag the orange point left/right",
  };

  Object.entries(hints).forEach(([view, text]) => {
    const description = document.querySelector(
      `[data-panel="${view}"] .view-desc`,
    );
    if (description) description.textContent = text;
  });
}

setupStaticSvgs();
setupDraggableImpacts();
updateSideBoard();

Object.values(controls).forEach((control) => {
  control.addEventListener("input", () => render(calculate()));
  control.addEventListener("change", () => render(calculate()));
});

document
  .querySelectorAll(".view-button")
  .forEach((button) =>
    button.addEventListener("click", () => selectView(button.dataset.view)),
  );

$("timeScrubber").addEventListener("input", (event) => {
  if (playing) togglePlay();
  setAnimationTime(+event.target.value);
});

$("playButton").addEventListener("click", togglePlay);
$("resetButton").addEventListener("click", reset);

render(calculate());
