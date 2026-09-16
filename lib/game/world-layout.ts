import type { WorldAreaId } from './types';

export type WorldPoint = [number, number, number];
export interface TownBuilding {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  facing: number;
  color: string;
  accent: string;
  sign: string;
  caption: string;
}
export interface WorldObstacle {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  height: number;
}

// The existing NPC coordinates and campaign area IDs remain valid in the plaza.
export const TOWN_BUILDINGS: TownBuilding[] = [
  {
    x: -7,
    z: -15,
    width: 4.2,
    depth: 4,
    height: 6.2,
    facing: 0,
    color: '#eec6a7',
    accent: '#e5564e',
    sign: 'らーめん',
    caption: 'RAMEN HOUSE',
  },
  {
    x: -2.2,
    z: -15.4,
    width: 4.3,
    depth: 4,
    height: 8.8,
    facing: 0,
    color: '#83c4c7',
    accent: '#277594',
    sign: 'カード',
    caption: 'BATTLE CARD CLUB',
  },
  {
    x: 2.7,
    z: -15.1,
    width: 4.3,
    depth: 4,
    height: 6.7,
    facing: 0,
    color: '#f2dc91',
    accent: '#c64b61',
    sign: '喫茶',
    caption: 'KOMOREBI CAFE',
  },
  {
    x: 7.4,
    z: -15.4,
    width: 4.1,
    depth: 4,
    height: 9.4,
    facing: 0,
    color: '#c0bbd4',
    accent: '#606bad',
    sign: 'ホテル',
    caption: 'HOSHI INN',
  },
  {
    x: -15,
    z: -7.4,
    width: 4.2,
    depth: 4,
    height: 7.4,
    facing: Math.PI / 2,
    color: '#b2cdb7',
    accent: '#407c70',
    sign: '本屋',
    caption: 'MIDORI BOOKS',
  },
  {
    x: -15.2,
    z: -2.5,
    width: 4.3,
    depth: 4,
    height: 5.5,
    facing: Math.PI / 2,
    color: '#ebd7bd',
    accent: '#d77645',
    sign: 'パン',
    caption: 'MORNING BAKERY',
  },
  {
    x: -15.1,
    z: 2.4,
    width: 4.2,
    depth: 4,
    height: 8.1,
    facing: Math.PI / 2,
    color: '#e9b5b0',
    accent: '#a75167',
    sign: '花屋',
    caption: 'SAKURA FLOWERS',
  },
  {
    x: -15.2,
    z: 7.3,
    width: 4.3,
    depth: 4,
    height: 6,
    facing: Math.PI / 2,
    color: '#aed0de',
    accent: '#507cb5',
    sign: '商店',
    caption: 'RANCH SUPPLY',
  },
  {
    x: 15,
    z: -7.3,
    width: 4.2,
    depth: 4,
    height: 8.2,
    facing: -Math.PI / 2,
    color: '#c2d9d7',
    accent: '#3f83a3',
    sign: 'ゲーム',
    caption: 'ARCADE 88',
  },
  {
    x: 15.2,
    z: -2.3,
    width: 4.3,
    depth: 4,
    height: 6.2,
    facing: -Math.PI / 2,
    color: '#edd69e',
    accent: '#c95847',
    sign: 'お茶',
    caption: 'TEA & TREATS',
  },
  {
    x: 15,
    z: 2.6,
    width: 4.2,
    depth: 4,
    height: 7.5,
    facing: -Math.PI / 2,
    color: '#b9c6df',
    accent: '#7b638e',
    sign: '音楽',
    caption: 'SUNSET RECORDS',
  },
  {
    x: 15.2,
    z: 7.5,
    width: 4.3,
    depth: 4,
    height: 5.3,
    facing: -Math.PI / 2,
    color: '#d7dfb7',
    accent: '#6c8c54',
    sign: '食堂',
    caption: 'BREEDER KITCHEN',
  },
  {
    x: -7.4,
    z: 15,
    width: 4.4,
    depth: 3.8,
    height: 4.6,
    facing: Math.PI,
    color: '#dec5b5',
    accent: '#94756a',
    sign: '工房',
    caption: 'CRAFT WORKSHOP',
  },
  {
    x: 7.4,
    z: 15,
    width: 4.4,
    depth: 3.8,
    height: 5.3,
    facing: Math.PI,
    color: '#c7d3c0',
    accent: '#667d70',
    sign: '旅館',
    caption: 'LITTLE LEAF INN',
  },
];

export const PLAZA_TREES: Array<[number, number, boolean]> = [
  [-7.4, -5.7, true],
  [7.6, -5.8, true],
  [-7.4, 5.7, false],
  [7.4, 5.7, true],
];
export const WORLD_BOUNDS = { minX: -12.4, maxX: 12.4, minZ: -12.3, maxZ: 8.3 };

export function worldObstacles(area: WorldAreaId): WorldObstacle[] {
  const buildings = TOWN_BUILDINGS.map((building) => ({
    x: building.x,
    z: building.z,
    halfX:
      (Math.abs(Math.cos(building.facing)) * building.width +
        Math.abs(Math.sin(building.facing)) * building.depth) /
        2 +
      0.3,
    halfZ:
      (Math.abs(Math.cos(building.facing)) * building.depth +
        Math.abs(Math.sin(building.facing)) * building.width) /
        2 +
      0.3,
    height: building.height + 0.35,
  }));
  return [
    ...buildings,
    ...PLAZA_TREES.map(([x, z]) => ({
      x,
      z,
      halfX: 0.72,
      halfZ: 0.72,
      height: 0.65,
    })),
    { x: -5.5, z: 4.5, halfX: 1.1, halfZ: 0.4, height: 1 },
    { x: 5.5, z: 4.5, halfX: 1.1, halfZ: 0.4, height: 1 },
    { x: -7.5, z: 0, halfX: 0.65, halfZ: 0.55, height: 2.1 },
    { x: 7.7, z: -1.7, halfX: 0.65, halfZ: 0.55, height: 2.1 },
    ...(area === 'festival'
      ? [
          { x: -3.1, z: -5.7, halfX: 0.27, halfZ: 0.27, height: 4.1 },
          { x: 3.1, z: -5.7, halfX: 0.27, halfZ: 0.27, height: 4.1 },
        ]
      : []),
  ];
}

const inside = (
  x: number,
  z: number,
  obstacle: WorldObstacle,
  radius: number,
) =>
  Math.abs(x - obstacle.x) < obstacle.halfX + radius &&
  Math.abs(z - obstacle.z) < obstacle.halfZ + radius;

/** Slide along obstacles; use short movement steps to prevent tunnelling. */
export function moveWorldPosition(
  position: WorldPoint,
  dx: number,
  dz: number,
  obstacles: WorldObstacle[],
): WorldPoint {
  let [x, , z] = position;
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.15),
  );
  for (let index = 0; index < steps; index += 1) {
    const nextX = Math.max(
      WORLD_BOUNDS.minX,
      Math.min(WORLD_BOUNDS.maxX, x + dx / steps),
    );
    if (!obstacles.some((item) => inside(nextX, z, item, 0.28))) x = nextX;
    const nextZ = Math.max(
      WORLD_BOUNDS.minZ,
      Math.min(WORLD_BOUNDS.maxZ, z + dz / steps),
    );
    if (!obstacles.some((item) => inside(x, nextZ, item, 0.28))) z = nextZ;
  }
  return [x, 0, z];
}

export function safeWorldPosition(
  position: WorldPoint,
  area: WorldAreaId,
): WorldPoint {
  const obstacles = worldObstacles(area);
  const [x, , z] = position;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    x < WORLD_BOUNDS.minX ||
    x > WORLD_BOUNDS.maxX ||
    z < WORLD_BOUNDS.minZ ||
    z > WORLD_BOUNDS.maxZ ||
    obstacles.some((item) => inside(x, z, item, 0.3))
  )
    return [0, 0, 4.7];
  return [x, 0, z];
}
