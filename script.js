const canvas = document.getElementById("scene");
const context = canvas.getContext("2d");

const initialAntCount = 5;
const ants = [];
const crumbs = [];
let nextAntId = 0;

const hole = {
  ratioX: 0.78,
  ratioY: 0.24,
  x: 0,
  y: 0,
  radiusX: 26,
  radiusY: 18,
};

const world = {
  width: 0,
  height: 0,
  lastTime: 0,
};

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

function createAnt(options = {}) {
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
  };

  nextAntId += 1;
  return ant;
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

function addCrumb(x, y) {
  const distanceToHole = Math.hypot(x - hole.x, y - hole.y);

  if (distanceToHole < hole.radiusX + 10) {
    return;
  }

  crumbs.push({
    id: `${Date.now()}-${Math.random()}`,
    x,
    y,
    radius: 7,
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
      .slice(0, 3);
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
      const nearby = freeAnts.filter((entry) => entry.distance < 68).slice(0, 3);

      if (nearby.length >= 2) {
        crumb.carriers = nearby.map((entry) => entry.ant.id);
      }
    } else if (crumb.carriers.length < 3) {
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
      .filter((entry) => entry.committedCount < 3)
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

function updateCrumbs(deltaTime) {
  for (let index = crumbs.length - 1; index >= 0; index -= 1) {
    const crumb = crumbs[index];

    if (crumb.carriers.length >= 2) {
      const heading = normalize(hole.x - crumb.x, hole.y - crumb.y);
      const carrySpeed = 22 + crumb.carriers.length * 8;

      crumb.x += heading.x * carrySpeed * deltaTime;
      crumb.y += heading.y * carrySpeed * deltaTime;
    }

    if (Math.hypot(crumb.x - hole.x, crumb.y - hole.y) < hole.radiusX * 0.6) {
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

function drawHole() {
  context.save();
  context.translate(hole.x, hole.y);

  context.fillStyle = "#000000";
  context.beginPath();
  context.ellipse(0, 0, hole.radiusX, hole.radiusY, 0, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.22;
  context.beginPath();
  context.ellipse(0, 3, hole.radiusX * 0.8, hole.radiusY * 0.45, 0, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawCrumb(crumb) {
  context.save();
  context.translate(crumb.x, crumb.y);

  context.fillStyle = "#cf9b57";
  context.beginPath();
  context.arc(0, 0, crumb.radius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#a86c2f";
  context.beginPath();
  context.arc(-2, -1, crumb.radius * 0.28, 0, Math.PI * 2);
  context.arc(2, 1, crumb.radius * 0.22, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawAnt(ant) {
  context.save();
  context.translate(ant.x, ant.y);
  context.rotate(ant.direction);

  context.strokeStyle = "#000000";
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

  context.fillStyle = "#000000";

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

function draw() {
  context.clearRect(0, 0, world.width, world.height);

  drawHole();
  crumbs.forEach(drawCrumb);
  ants.forEach(drawAnt);
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

  draw();
  requestAnimationFrame(step);
}

canvas.addEventListener("pointerdown", (event) => {
  const rectangle = canvas.getBoundingClientRect();
  addCrumb(event.clientX - rectangle.left, event.clientY - rectangle.top);
});

window.addEventListener("resize", resize);

initialize();
