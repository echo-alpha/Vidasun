const canvas = document.getElementById("scene");
const context = canvas.getContext("2d");

const initialAntCount = 5;
const ants = [];
const crumbs = [];
const particles = [];
const ripples = [];
let nextAntId = 0;
let crumbsDelivered = 0;
let hintAlpha = 1.0;
let firstClickDone = false;

let groundTextureCanvas = null;
let trailCanvas = null;
let trailContext = null;
let trailFrame = 0;

const hole = {
  ratioX: 0.78,
  ratioY: 0.24,
  x: 0,
  y: 0,
  radiusX: 26,
  radiusY: 18,
  specks: [],
};

const world = {
  width: 0,
  height: 0,
  lastTime: 0,
};

const BACKGROUND_COLOR = "#f4e8d0";
const BACKGROUND_RGB = { r: 244, g: 232, b: 208 };

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(vectorX, vectorY) {
  const length = Math.hypot(vectorX, vectorY) || 1;
  return {
    x: vectorX / length,
    y: vectorY / length,
    length,
  };
}

function angleDifference(current, target) {
  let difference = target - current;

  while (difference > Math.PI) {
    difference -= Math.PI * 2;
  }

  while (difference < -Math.PI) {
    difference += Math.PI * 2;
  }

  return difference;
}

function generateAntColor() {
  const hue = Math.floor(randomBetween(0, 30));
  const saturation = Math.floor(randomBetween(20, 50));
  const lightness = Math.floor(randomBetween(8, 18));
  return {
    body: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    legs: `hsl(${hue}, ${saturation}%, ${lightness + 8}%)`,
  };
}

function createAnt(options = {}) {
  const colors = generateAntColor();
  const ant = {
    id: nextAntId,
    x:
      options.x === undefined ? randomBetween(40, world.width - 40) : options.x,
    y:
      options.y === undefined ? randomBetween(40, world.height - 40) : options.y,
    direction:
      options.direction === undefined
        ? randomBetween(0, Math.PI * 2)
        : options.direction,
    speed: randomBetween(42, 58),
    wanderClock: randomBetween(0, Math.PI * 2),
    targetCrumbId: null,
    carryingCrumbId: null,
    anchorOffset: 0,
    color: colors.body,
    legColor: colors.legs,
  };

  nextAntId += 1;
  return ant;
}

function generateGroundTexture() {
  const pixelRatio = window.devicePixelRatio || 1;
  groundTextureCanvas = document.createElement("canvas");
  groundTextureCanvas.width = Math.floor(world.width * pixelRatio);
  groundTextureCanvas.height = Math.floor(world.height * pixelRatio);

  const gtx = groundTextureCanvas.getContext("2d");
  gtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  gtx.fillStyle = BACKGROUND_COLOR;
  gtx.fillRect(0, 0, world.width, world.height);

  const speckColors = ["#e0d0b8", "#d8c8a8", "#f0e0c8", "#d0c0a0"];
  const count = Math.floor(world.width * world.height * 0.003);

  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * world.width;
    const y = Math.random() * world.height;
    const r = randomBetween(0.5, 1.5);

    gtx.globalAlpha = randomBetween(0.15, 0.4);
    gtx.fillStyle = speckColors[Math.floor(Math.random() * speckColors.length)];
    gtx.beginPath();
    gtx.arc(x, y, r, 0, Math.PI * 2);
    gtx.fill();
  }

  for (let i = 0; i < count * 0.05; i += 1) {
    const x = Math.random() * world.width;
    const y = Math.random() * world.height;
    gtx.globalAlpha = randomBetween(0.04, 0.08);
    gtx.fillStyle = "#c8b898";
    gtx.beginPath();
    gtx.arc(x, y, randomBetween(3, 6), 0, Math.PI * 2);
    gtx.fill();
  }

  gtx.globalAlpha = 1;
}

function initTrailCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;
  trailCanvas = document.createElement("canvas");
  trailCanvas.width = Math.floor(world.width * pixelRatio);
  trailCanvas.height = Math.floor(world.height * pixelRatio);
  trailContext = trailCanvas.getContext("2d");
  trailContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  trailContext.fillStyle = BACKGROUND_COLOR;
  trailContext.fillRect(0, 0, world.width, world.height);
}

function generateHoleSpecks() {
  hole.specks = [];
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + (i * 2.39996);
    const dist = randomBetween(hole.radiusX * 1.2, hole.radiusX * 2.8);
    hole.specks.push({
      offsetX: Math.cos(angle) * dist,
      offsetY: Math.sin(angle) * dist * 0.7,
      radius: randomBetween(1, 2.5),
      alpha: randomBetween(0.1, 0.25),
    });
  }
}

function resize() {
  const pixelRatio = window.devicePixelRatio || 1;
  world.width = window.innerWidth;
  world.height = window.innerHeight;

  canvas.width = Math.floor(world.width * pixelRatio);
  canvas.height = Math.floor(world.height * pixelRatio);
  canvas.style.width = `${world.width}px`;
  canvas.style.height = `${world.height}px`;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  hole.x = world.width * hole.ratioX;
  hole.y = world.height * hole.ratioY;

  crumbs.forEach((crumb) => {
    crumb.x = clamp(crumb.x, crumb.radius + 8, world.width - crumb.radius - 8);
    crumb.y = clamp(crumb.y, crumb.radius + 8, world.height - crumb.radius - 8);
  });

  ants.forEach((ant) => {
    ant.x = clamp(ant.x, 20, world.width - 20);
    ant.y = clamp(ant.y, 20, world.height - 20);
  });

  generateGroundTexture();
  initTrailCanvas();
  generateHoleSpecks();
}

function initialize() {
  hole.ratioX = randomBetween(0.18, 0.82);
  hole.ratioY = randomBetween(0.18, 0.82);
  resize();

  for (let index = 0; index < initialAntCount; index += 1) {
    ants.push(createAnt());
  }

  requestAnimationFrame(step);
}

function emitRipple(x, y) {
  ripples.push({
    x,
    y,
    radius: 0,
    maxRadius: 40,
    life: 0.5,
    maxLife: 0.5,
  });
}

function addCrumb(x, y) {
  emitRipple(x, y);

  const distanceToHole = Math.hypot(x - hole.x, y - hole.y);

  if (distanceToHole < hole.radiusX + 10) {
    return;
  }

  const roll = Math.random();
  let radius, requiredCarriers, maxCarriers;

  if (roll < 0.45) {
    radius = 5;
    requiredCarriers = 1;
    maxCarriers = 2;
  } else if (roll < 0.85) {
    radius = 7;
    requiredCarriers = 2;
    maxCarriers = 3;
  } else {
    radius = 10;
    requiredCarriers = 3;
    maxCarriers = 3;
  }

  crumbs.push({
    id: `${Date.now()}-${Math.random()}`,
    x,
    y,
    radius,
    requiredCarriers,
    maxCarriers,
    carriers: [],
  });
}

function assignWork() {
  ants.forEach((ant) => {
    ant.carryingCrumbId = null;
    ant.targetCrumbId = null;
  });

  const antById = new Map(ants.map((ant) => [ant.id, ant]));
  const claimedAntIds = new Set();
  const committedAntCounts = new Map();

  crumbs.forEach((crumb) => {
    crumb.carriers = crumb.carriers
      .filter((carrierId) => antById.has(carrierId))
      .slice(0, crumb.maxCarriers);
    committedAntCounts.set(crumb.id, crumb.carriers.length);
  });

  crumbs.forEach((crumb) => {
    const freeAnts = ants
      .filter((ant) => !claimedAntIds.has(ant.id))
      .map((ant) => ({
        ant,
        distance: Math.hypot(ant.x - crumb.x, ant.y - crumb.y),
      }))
      .sort((left, right) => left.distance - right.distance);

    if (crumb.carriers.length === 0) {
      const nearby = freeAnts.filter((entry) => entry.distance < 68).slice(0, crumb.maxCarriers);

      if (nearby.length >= crumb.requiredCarriers) {
        crumb.carriers = nearby.map((entry) => entry.ant.id);
      }
    } else if (crumb.carriers.length < crumb.maxCarriers) {
      const existing = new Set(crumb.carriers);
      const helper = freeAnts.find(
        (entry) => entry.distance < 54 && !existing.has(entry.ant.id)
      );

      if (helper) {
        crumb.carriers.push(helper.ant.id);
      }
    }

    crumb.carriers.forEach((carrierId, carrierIndex) => {
      claimedAntIds.add(carrierId);
      const ant = antById.get(carrierId);

      if (ant) {
        ant.carryingCrumbId = crumb.id;
        ant.anchorOffset = carrierIndex;
      }
    });

    committedAntCounts.set(crumb.id, crumb.carriers.length);
  });

  ants.forEach((ant) => {
    if (ant.carryingCrumbId) {
      return;
    }

    const availableCrumbs = crumbs
      .map((crumb) => ({
        crumb,
        committedCount: committedAntCounts.get(crumb.id) || 0,
        distance: Math.hypot(ant.x - crumb.x, ant.y - crumb.y),
      }))
      .filter((entry) => entry.committedCount < entry.crumb.maxCarriers)
      .sort((left, right) => {
        if (left.committedCount !== right.committedCount) {
          return left.committedCount - right.committedCount;
        }

        return left.distance - right.distance;
      });

    if (availableCrumbs[0]) {
      ant.targetCrumbId = availableCrumbs[0].crumb.id;
      committedAntCounts.set(
        availableCrumbs[0].crumb.id,
        availableCrumbs[0].committedCount + 1
      );
    }
  });
}

function emitDeliveryParticles(x, y) {
  const count = Math.floor(randomBetween(12, 18));
  const colors = ["#cf9b57", "#a86c2f", "#e8c87a", "#8b6914", "#d4a84b"];

  for (let i = 0; i < count; i += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(40, 120);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: randomBetween(1.5, 3.5),
      life: randomBetween(0.5, 1.0),
      maxLife: 0,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
  }
}

function updateCrumbs(deltaTime) {
  for (let index = crumbs.length - 1; index >= 0; index -= 1) {
    const crumb = crumbs[index];

    if (crumb.carriers.length >= crumb.requiredCarriers) {
      const heading = normalize(hole.x - crumb.x, hole.y - crumb.y);
      const carrySpeed = (22 + crumb.carriers.length * 8) * (7 / crumb.radius);

      crumb.x += heading.x * carrySpeed * deltaTime;
      crumb.y += heading.y * carrySpeed * deltaTime;
    }

    if (Math.hypot(crumb.x - hole.x, crumb.y - hole.y) < hole.radiusX * 0.6) {
      emitDeliveryParticles(crumb.x, crumb.y);
      crumbsDelivered += 1;
      crumbs.splice(index, 1);
      ants.push(
        createAnt({
          x: hole.x + randomBetween(-4, 4),
          y: hole.y + randomBetween(-4, 4),
          direction: randomBetween(0, Math.PI * 2),
        })
      );
    }
  }
}

function updateAnt(ant, deltaTime, elapsedTime) {
  let targetDirection = ant.direction;
  let desiredSpeed = ant.speed;

  if (ant.carryingCrumbId) {
    const crumb = crumbs.find((entry) => entry.id === ant.carryingCrumbId);

    if (crumb) {
      const slotCount = Math.max(crumb.carriers.length, 2);
      const angle =
        (Math.PI * 2 * ant.anchorOffset) / slotCount +
        elapsedTime * 0.5 +
        ant.id * 0.4;
      const anchorX = crumb.x + Math.cos(angle) * (crumb.radius + 8);
      const anchorY = crumb.y + Math.sin(angle) * (crumb.radius + 6);
      const heading = normalize(anchorX - ant.x, anchorY - ant.y);

      targetDirection = Math.atan2(heading.y, heading.x);
      desiredSpeed = 58;
    }
  } else if (ant.targetCrumbId) {
    const crumb = crumbs.find((entry) => entry.id === ant.targetCrumbId);

    if (crumb) {
      const heading = normalize(crumb.x - ant.x, crumb.y - ant.y);
      const wobble = Math.sin(elapsedTime * 5 + ant.id * 1.7) * 0.18;

      targetDirection = Math.atan2(heading.y, heading.x) + wobble;
      desiredSpeed = 64;
    }
  } else {
    ant.wanderClock += deltaTime * randomBetween(0.9, 1.4);
    targetDirection =
      ant.direction +
      Math.sin(ant.wanderClock + ant.id * 0.7) * 0.05 +
      Math.cos(elapsedTime * 0.8 + ant.id) * 0.02;
    desiredSpeed = ant.speed;
  }

  const edgePadding = 40;

  if (ant.x < edgePadding) {
    targetDirection = 0;
  } else if (ant.x > world.width - edgePadding) {
    targetDirection = Math.PI;
  }

  if (ant.y < edgePadding) {
    targetDirection = Math.PI / 2;
  } else if (ant.y > world.height - edgePadding) {
    targetDirection = -Math.PI / 2;
  }

  const turnRate = 3.8;
  ant.direction += angleDifference(ant.direction, targetDirection) * turnRate * deltaTime;

  ant.x += Math.cos(ant.direction) * desiredSpeed * deltaTime;
  ant.y += Math.sin(ant.direction) * desiredSpeed * deltaTime;

  ant.x = clamp(ant.x, 10, world.width - 10);
  ant.y = clamp(ant.y, 10, world.height - 10);
}

function updateTrails() {
  trailContext.fillStyle = `rgba(${BACKGROUND_RGB.r}, ${BACKGROUND_RGB.g}, ${BACKGROUND_RGB.b}, 0.04)`;
  trailContext.fillRect(0, 0, world.width, world.height);

  trailFrame += 1;
  if (trailFrame % 3 === 0) {
    ants.forEach((ant) => {
      if (ant.carryingCrumbId) {
        trailContext.fillStyle = "rgba(130, 105, 75, 0.07)";
      } else if (ant.targetCrumbId) {
        trailContext.fillStyle = "rgba(120, 110, 80, 0.04)";
      } else {
        trailContext.fillStyle = "rgba(140, 125, 100, 0.02)";
      }
      trailContext.beginPath();
      trailContext.arc(ant.x, ant.y, 1.5, 0, Math.PI * 2);
      trailContext.fill();
    });
  }
}

function updateParticles(deltaTime) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * deltaTime;
    p.y += p.vy * deltaTime;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= deltaTime;

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function updateRipples(deltaTime) {
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const r = ripples[i];
    r.life -= deltaTime;
    const progress = 1 - r.life / r.maxLife;
    r.radius = r.maxRadius * progress;

    if (r.life <= 0) {
      ripples.splice(i, 1);
    }
  }
}

function drawHole() {
  context.save();
  context.translate(hole.x, hole.y);

  context.fillStyle = "#c4a870";
  context.globalAlpha = 0.1;
  context.beginPath();
  context.ellipse(0, 2, hole.radiusX * 2.2, hole.radiusY * 2.2, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#b09060";
  context.globalAlpha = 0.15;
  context.beginPath();
  context.ellipse(0, 1, hole.radiusX * 1.7, hole.radiusY * 1.7, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#9a7a50";
  context.globalAlpha = 0.22;
  context.beginPath();
  context.ellipse(0, 0, hole.radiusX * 1.3, hole.radiusY * 1.3, 0, 0, Math.PI * 2);
  context.fill();

  hole.specks.forEach((speck) => {
    context.globalAlpha = speck.alpha;
    context.fillStyle = "#a08860";
    context.beginPath();
    context.arc(speck.offsetX, speck.offsetY, speck.radius, 0, Math.PI * 2);
    context.fill();
  });

  context.globalAlpha = 1;

  context.fillStyle = "#1a1008";
  context.beginPath();
  context.ellipse(0, 0, hole.radiusX, hole.radiusY, 0, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.22;
  context.fillStyle = "#000000";
  context.beginPath();
  context.ellipse(0, 3, hole.radiusX * 0.8, hole.radiusY * 0.45, 0, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawCrumb(crumb) {
  context.save();
  context.translate(crumb.x, crumb.y);

  const scale = crumb.radius / 7;

  context.fillStyle = "#cf9b57";
  context.beginPath();
  context.arc(0, 0, crumb.radius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#a86c2f";
  context.beginPath();
  context.arc(-2 * scale, -1 * scale, crumb.radius * 0.28, 0, Math.PI * 2);
  context.arc(2 * scale, 1 * scale, crumb.radius * 0.22, 0, Math.PI * 2);
  context.fill();

  if (crumb.radius >= 10) {
    context.fillStyle = "#8a5a1f";
    context.beginPath();
    context.arc(1 * scale, -2 * scale, crumb.radius * 0.18, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawAnt(ant) {
  context.save();
  context.translate(ant.x, ant.y);
  context.rotate(ant.direction);

  context.strokeStyle = ant.legColor;
  context.lineWidth = 1.2;
  context.lineCap = "round";

  for (const side of [-1, 1]) {
    for (const legX of [-5, 0, 5]) {
      context.beginPath();
      context.moveTo(legX, 0);
      context.lineTo(legX + 5, side * 5);
      context.stroke();
    }
  }

  context.beginPath();
  context.moveTo(7, -1);
  context.lineTo(11, -4);
  context.moveTo(7, 1);
  context.lineTo(11, 4);
  context.stroke();

  context.fillStyle = ant.color;

  context.beginPath();
  context.ellipse(-5.5, 0, 3.5, 2.8, 0, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.ellipse(0.5, 0, 4.2, 3.2, 0, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.ellipse(7.5, 0, 2.8, 2.2, 0, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawRipples() {
  ripples.forEach((r) => {
    const alpha = (r.life / r.maxLife) * 0.5;
    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = "#a08050";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
}

function drawParticles() {
  particles.forEach((p) => {
    context.save();
    context.globalAlpha = p.life / p.maxLife;
    context.fillStyle = p.color;
    context.beginPath();
    context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawHUD() {
  context.save();
  context.globalAlpha = 0.55;
  context.font = "13px monospace";
  context.fillStyle = "#5a4a3a";
  context.textAlign = "right";
  context.fillText(`ants: ${ants.length}`, world.width - 20, 28);
  context.fillText(`delivered: ${crumbsDelivered}`, world.width - 20, 46);
  context.restore();
}

function drawHint() {
  if (hintAlpha <= 0) {
    return;
  }

  context.save();
  context.globalAlpha = hintAlpha;
  context.font = "16px sans-serif";
  context.fillStyle = "#8a7a6a";
  context.textAlign = "center";
  context.fillText("click anywhere to drop crumbs", world.width / 2, world.height - 50);
  context.restore();
}

function draw() {
  context.drawImage(groundTextureCanvas, 0, 0, world.width, world.height);
  context.drawImage(trailCanvas, 0, 0, world.width, world.height);

  drawRipples();
  drawHole();
  crumbs.forEach(drawCrumb);
  ants.forEach(drawAnt);
  drawParticles();
  drawHUD();
  drawHint();
}

function step(timestamp) {
  if (!world.lastTime) {
    world.lastTime = timestamp;
  }

  const deltaTime = Math.min((timestamp - world.lastTime) / 1000, 0.033);
  const elapsedTime = timestamp / 1000;
  world.lastTime = timestamp;

  assignWork();
  updateCrumbs(deltaTime);

  ants.forEach((ant) => {
    updateAnt(ant, deltaTime, elapsedTime);
  });

  updateTrails();
  updateParticles(deltaTime);
  updateRipples(deltaTime);

  if (firstClickDone && hintAlpha > 0) {
    hintAlpha -= deltaTime * 0.8;
    if (hintAlpha < 0) {
      hintAlpha = 0;
    }
  }

  draw();
  requestAnimationFrame(step);
}

canvas.addEventListener("pointerdown", (event) => {
  firstClickDone = true;
  const rectangle = canvas.getBoundingClientRect();
  addCrumb(event.clientX - rectangle.left, event.clientY - rectangle.top);
});

window.addEventListener("resize", resize);

initialize();
