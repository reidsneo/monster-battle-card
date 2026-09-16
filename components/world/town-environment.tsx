'use client';

import { useFrame } from '@react-three/fiber';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import {
  PLAZA_TREES,
  TOWN_BUILDINGS,
  type TownBuilding,
  type WorldPoint,
} from '@/lib/game/world-layout';
import type { WorldAreaId } from '@/lib/game/types';

type Box = {
  position: WorldPoint;
  size: WorldPoint;
  color: string;
  rotation?: WorldPoint;
};
const box = (
  position: WorldPoint,
  size: WorldPoint,
  color: string,
  rotation?: WorldPoint,
): Box => ({ position, size, color, rotation });

/** Batch the many windows, tiles and facade details into instanced draws. */
function Boxes({ items, shadows = true }: { items: Box[]; shadows?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    items.forEach((item, index) => {
      dummy.position.set(...item.position);
      dummy.scale.set(...item.size);
      dummy.rotation.set(...(item.rotation ?? [0, 0, 0]));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
      mesh.current!.setColorAt(index, color.set(item.color));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, items.length]}
      castShadow={shadows}
      receiveShadow
    >
      <boxGeometry />
      <meshStandardMaterial roughness={0.86} />
    </instancedMesh>
  );
}

function ShopSign({
  text,
  caption,
  color,
  position,
  width = 3.3,
  height = 0.9,
}: {
  text: string;
  caption: string;
  color: string;
  position: WorldPoint;
  width?: number;
  height?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 224;
    const context = canvas.getContext('2d')!;
    context.fillStyle = color;
    context.fillRect(0, 0, 768, 224);
    context.strokeStyle = '#fff5d2';
    context.lineWidth = 5;
    context.strokeRect(12, 12, 744, 200);
    context.textAlign = 'center';
    context.fillStyle = '#fff8df';
    context.font = 'bold 98px sans-serif';
    context.fillText(text, 384, 121);
    context.font = 'bold 25px sans-serif';
    context.letterSpacing = '5px';
    context.fillText(caption, 384, 183);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [text, caption, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.7}
        emissive="#ffffff"
        emissiveMap={texture}
        emissiveIntensity={0.12}
      />
    </mesh>
  );
}

function ShopCurtain({
  color,
  z,
  reducedMotion,
}: {
  color: string;
  z: number;
  reducedMotion: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (root.current && !reducedMotion)
      root.current.rotation.x = Math.sin(clock.elapsedTime * 1.6 + z) * 0.065;
  });
  return (
    <group ref={root} position={[0, 1.85, z]}>
      {[-0.7, 0, 0.7].map((x) => (
        <mesh key={x} position={[x, -0.3, 0]}>
          <boxGeometry args={[0.65, 0.6, 0.025]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function Building({
  building: b,
  index,
  reducedMotion,
}: {
  building: TownBuilding;
  index: number;
  reducedMotion: boolean;
}) {
  const facade = useMemo(() => {
    const front = b.depth / 2;
    const items: Box[] = [
      box([0, b.height / 2, 0], [b.width, b.height, b.depth], b.color),
      box([0, 0.1, 0], [b.width + 0.15, 0.2, b.depth + 0.2], '#a6aab1'),
      box([0, b.height, 0], [b.width + 0.3, 0.2, b.depth + 0.3], '#ece5d8'),
      box([0, b.height + 0.2, -front], [b.width, 0.5, 0.12], b.accent),
      box([-b.width / 2, b.height + 0.2, 0], [0.12, 0.5, b.depth], b.accent),
      box([b.width / 2, b.height + 0.2, 0], [0.12, 0.5, b.depth], b.accent),
      box([0, 1.14, front + 0.03], [b.width - 0.45, 1.88, 0.12], '#345b70'),
      box([0, 1, front + 0.14], [0.1, 1.83, 0.08], '#f2dec1'),
      box([-0.67, 1, front + 0.14], [0.06, 1.83, 0.08], '#f2dec1'),
      box([0.67, 1, front + 0.14], [0.06, 1.83, 0.08], '#f2dec1'),
      box([0, 0.23, front + 0.16], [b.width - 0.3, 0.14, 0.24], '#f1d6ba'),
      box([0, 2.5, front + 0.08], [b.width - 0.25, 1.08, 0.2], b.accent),
    ];
    for (let floor = 3.7; floor < b.height - 0.6; floor += 1.6) {
      for (const x of [-1.08, 0, 1.08]) {
        items.push(
          box([x, floor, front + 0.065], [0.89, 1.06, 0.12], b.accent),
        );
        items.push(
          box(
            [x, floor, front + 0.14],
            [0.73, 0.88, 0.08],
            index % 3 === 0 ? '#f0d29a' : '#7095a7',
          ),
        );
        items.push(box([x, floor, front + 0.2], [0.04, 0.9, 0.045], '#e5ded0'));
        items.push(
          box([x, floor - 0.55, front + 0.2], [1, 0.08, 0.38], '#f2e2c7'),
        );
      }
      items.push(
        box([0, floor - 0.72, front + 0.03], [b.width, 0.09, 0.09], '#eee2c6'),
      );
    }
    // Air conditioners, a roof service hut and the side-mounted sign frame.
    items.push(box([0.75, b.height + 0.43, -0.7], [1.25, 0.7, 0.9], '#bbc0bb'));
    for (let i = 0; i < 5; i += 1)
      items.push(
        box(
          [0.3 + i * 0.22, b.height + 0.8, -0.7],
          [0.06, 0.06, 0.7],
          '#718084',
        ),
      );
    items.push(box([-1.2, b.height + 0.5, -0.6], [0.7, 0.85, 0.7], '#b5bac0'));
    items.push(
      box([-b.width / 2 - 0.27, 4.8, front], [0.46, 2.45, 0.45], b.accent),
    );
    for (let i = 0; i < 5; i += 1)
      items.push(
        box(
          [-b.width / 2 - 0.27, 3.9 + i * 0.42, front + 0.24],
          [0.25, 0.17, 0.035],
          '#ffe5b1',
        ),
      );
    for (let i = 0; i < 8; i += 1)
      items.push(
        box(
          [-1.6 + i * 0.46, 1.95, front + 0.5],
          [0.46, 0.1, 0.96],
          i % 2 ? '#fff0d3' : b.accent,
          [0.12, 0, 0],
        ),
      );
    return items;
  }, [b, index]);
  return (
    <group position={[b.x, 0, b.z]} rotation={[0, b.facing, 0]}>
      <Boxes items={facade} />
      <ShopSign
        text={b.sign}
        caption={b.caption}
        color={b.accent}
        position={[0, 2.5, b.depth / 2 + 0.19]}
        width={b.width - 0.35}
      />
      {index % 3 === 0 && (
        <ShopCurtain
          color={b.accent}
          z={b.depth / 2 + 0.3}
          reducedMotion={reducedMotion}
        />
      )}
    </group>
  );
}

export function TownTree({
  x,
  z,
  blossom,
  reducedMotion,
}: {
  x: number;
  z: number;
  blossom: boolean;
  reducedMotion: boolean;
}) {
  const crown = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crown.current && !reducedMotion)
      crown.current.rotation.z = Math.sin(clock.elapsedTime * 1.1 + x) * 0.03;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh receiveShadow position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.85, 0.9, 0.44, 8]} />
        <meshStandardMaterial color="#a1a89a" flatShading />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.75, 0.75, 0.08, 8]} />
        <meshStandardMaterial color="#536c4c" />
      </mesh>
      <mesh castShadow position={[0, 1.3, 0]} rotation={[0, 0, 0.07]}>
        <cylinderGeometry args={[0.12, 0.23, 2.2, 7]} />
        <meshStandardMaterial color="#81604f" flatShading />
      </mesh>
      <group ref={crown} position={[0, 2.1, 0]}>
        {[
          [0, 0.65, 0, 1.2],
          [-0.75, 0.3, 0.1, 0.9],
          [0.7, 0.45, 0.05, 0.95],
          [0.12, 0.2, -0.65, 0.85],
        ].map(([cx, cy, cz, scale], index) => (
          <mesh
            key={index}
            castShadow
            position={[cx, cy, cz]}
            scale={[scale, scale * 0.82, scale]}
          >
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial
              color={
                blossom
                  ? ['#efaebc', '#f7c8cc', '#e89caf', '#f4bbcc'][index]
                  : ['#639773', '#80b181', '#91b886', '#699d7a'][index]
              }
              flatShading
              roughness={1}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function Lantern({
  position,
  reducedMotion,
  phase = 0,
}: {
  position: WorldPoint;
  reducedMotion: boolean;
  phase?: number;
}) {
  const lantern = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (lantern.current && !reducedMotion)
      lantern.current.rotation.z =
        Math.sin(clock.elapsedTime * 1.8 + phase) * 0.08;
  });
  return (
    <group ref={lantern} position={position}>
      <mesh position={[0, -0.29, 0]}>
        <sphereGeometry args={[0.23, 8, 6]} />
        <meshStandardMaterial
          color={phase % 2 ? '#f4c47a' : '#e76c5b'}
          emissive="#ff9955"
          emissiveIntensity={0.3}
          flatShading
        />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.15, 5]} />
        <meshStandardMaterial color="#675456" />
      </mesh>
      <mesh position={[0, -0.54, 0]}>
        <boxGeometry args={[0.12, 0.06, 0.12]} />
        <meshStandardMaterial color="#654343" />
      </mesh>
    </group>
  );
}

function Wire({ points }: { points: WorldPoint[] }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point)),
      ),
    [points],
  );
  return (
    <mesh>
      <tubeGeometry args={[curve, 24, 0.019, 3, false]} />
      <meshStandardMaterial color="#4e5262" />
    </mesh>
  );
}

function StreetFurniture({
  festival,
  reducedMotion,
}: {
  festival: boolean;
  reducedMotion: boolean;
}) {
  const items = useMemo(() => {
    const parts: Box[] = [];
    for (const x of [-5.5, 5.5]) {
      for (const dx of [-0.85, 0.85])
        parts.push(box([x + dx, 0.3, 4.5], [0.09, 0.6, 0.6], '#536575'));
      for (let i = 0; i < 4; i += 1)
        parts.push(
          box([x, 0.57, 4.25 + i * 0.15], [2.2, 0.09, 0.12], '#b28863'),
        );
      parts.push(box([x, 0.94, 4.79], [2.2, 0.54, 0.1], '#b58b64'));
    }
    for (const [x, z, color] of [
      [-7.5, 0, '#d65c59'],
      [7.7, -1.7, '#4c91b0'],
    ] as const) {
      parts.push(box([x, 1.02, z], [1.12, 2.04, 0.85], color));
      parts.push(box([x - 0.13, 1.2, z + 0.44], [0.78, 1.24, 0.06], '#d4e9df'));
      for (let row = 0; row < 3; row += 1)
        for (let col = 0; col < 3; col += 1)
          parts.push(
            box(
              [x - 0.37 + col * 0.23, 0.79 + row * 0.35, z + 0.485],
              [0.12, 0.2, 0.08],
              ['#db785e', '#e3c460', '#6aa999'][col],
            ),
          );
      parts.push(box([x, 0.31, z + 0.455], [0.56, 0.2, 0.07], '#294452'));
      parts.push(box([x + 0.42, 0.9, z + 0.46], [0.11, 0.27, 0.08], '#294452'));
    }
    for (const x of [-8.2, 8.2])
      for (const z of [-8.2, 7.8]) {
        parts.push(box([x, 3.4, z], [0.13, 6.8, 0.13], '#737e85'));
        parts.push(box([x, 6.4, z], [1.1, 0.12, 0.13], '#626e7c'));
        parts.push(box([x, 3.6, z + 0.28], [0.65, 0.12, 0.12], '#626e7c'));
        parts.push(box([x, 3.35, z + 0.4], [0.35, 0.36, 0.35], '#f5cf83'));
      }
    if (festival) {
      for (const x of [-3.1, 3.1])
        parts.push(box([x, 1.9, -5.7], [0.35, 3.8, 0.35], '#c45b4c'));
      parts.push(box([0, 3.65, -5.7], [6.8, 0.3, 0.42], '#c85a4a'));
      parts.push(box([0, 3.96, -5.7], [7.4, 0.19, 0.55], '#334d5f'));
      parts.push(box([0, 3.14, -5.7], [6.45, 0.15, 0.26], '#d67257'));
    }
    return parts;
  }, [festival]);
  return (
    <>
      <Boxes items={items} />
      <Wire
        points={[
          [-8.2, 6.5, -8.2],
          [0, 6.1, -8.2],
          [8.2, 6.5, -8.2],
        ]}
      />
      <Wire
        points={[
          [-8.2, 6.65, -8.5],
          [0, 6.2, -8.5],
          [8.2, 6.65, -8.5],
        ]}
      />
      {[-8.2, 8.2].map((x) => (
        <Wire
          key={x}
          points={[
            [x, 6.5, -8.2],
            [x, 5.85, 0],
            [x, 6.5, 7.8],
          ]}
        />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <Lantern
          key={i}
          position={[-7.5 + i * 1.5, 6.15 + Math.abs(i - 5) * 0.065, -8.2]}
          reducedMotion={reducedMotion}
          phase={i}
        />
      ))}
      {festival && (
        <>
          <ShopSign
            position={[0, 3.22, -5.44]}
            text="祭"
            caption="BREEDER FESTIVAL"
            color="#394d6c"
            width={1.3}
            height={0.9}
          />
          <Wire
            points={[
              [-7.7, 6.2, 2],
              [0, 5.7, 2],
              [7.7, 6.2, 2],
            ]}
          />
          {Array.from({ length: 9 }, (_, i) => (
            <Lantern
              key={i}
              position={[-6.8 + i * 1.7, 5.7 + Math.abs(i - 4) * 0.1, 2]}
              reducedMotion={reducedMotion}
              phase={i}
            />
          ))}
        </>
      )}
    </>
  );
}

function Streets({ festival }: { festival: boolean }) {
  const items = useMemo(() => {
    const parts: Box[] = [
      box([0, -0.27, -2], [39, 0.5, 36], '#92a29c'),
      box([0, -0.06, 0], [17.4, 0.2, 17.4], festival ? '#d4bdb0' : '#d6d3c0'),
    ];
    for (const z of [-10.6, 10.6])
      parts.push(box([0, -0.08, z], [25.3, 0.18, 3.8], '#566573'));
    for (const x of [-10.6, 10.6])
      parts.push(box([x, -0.08, 0], [3.8, 0.18, 21.2], '#566573'));
    for (const z of [-8.72, 8.72])
      parts.push(box([0, 0.04, z], [17.6, 0.17, 0.18], '#e9e5d5'));
    for (const x of [-8.72, 8.72])
      parts.push(box([x, 0.04, 0], [0.18, 0.17, 17.6], '#e9e5d5'));
    for (let x = -7.5; x <= 7.5; x += 1.5)
      for (let z = -7.5; z <= 7.5; z += 1.5) {
        parts.push(
          box(
            [x, 0.048, z],
            [1.45, 0.014, 1.45],
            Math.round((x + z) / 1.5) % 3
              ? festival
                ? '#cfb8a6'
                : '#cdd0bf'
              : festival
                ? '#d8c4b4'
                : '#e0ddca',
          ),
        );
      }
    for (let i = -7; i <= 7; i += 2)
      for (const side of [-1, 1]) {
        parts.push(box([i, 0.02, side * 10.6], [0.8, 0.016, 0.065], '#e9e1bf'));
        parts.push(box([side * 10.6, 0.02, i], [0.065, 0.016, 0.8], '#e9e1bf'));
      }
    for (let i = 0; i < 7; i += 1)
      for (const side of [-1, 1]) {
        parts.push(
          box(
            [0, 0.031, side * (9.15 + i * 0.45)],
            [2.1, 0.02, 0.24],
            '#f3eeda',
          ),
        );
        parts.push(
          box(
            [side * (9.15 + i * 0.45), 0.031, 0],
            [0.24, 0.02, 2.1],
            '#f3eeda',
          ),
        );
      }
    // Distant apartment silhouettes keep the streets from ending at the plaza.
    for (let i = 0; i < 9; i += 1)
      parts.push(
        box(
          [-19 + i * 4.6, 4 + (i % 3), -21],
          [4, 8 + (i % 3) * 2, 4],
          ['#aebfc7', '#bfc9d0', '#b8c0c9'][i % 3],
        ),
      );
    return parts;
  }, [festival]);
  return <Boxes items={items} shadows={false} />;
}

function Vehicle({
  color,
  bus,
  speed,
}: {
  color: string;
  bus?: boolean;
  speed: RefObject<number>;
}) {
  const wheels = useRef<Array<THREE.Mesh | null>>([]);
  const items = useMemo(
    () => [
      box([0, 0.47, 0], [1.2, 0.5, bus ? 3.1 : 2.2], color),
      box(
        [0, bus ? 1 : 0.9, bus ? -0.1 : -0.12],
        [1.07, bus ? 0.78 : 0.5, bus ? 2.9 : 1.28],
        color,
      ),
      box([0, 0.89, bus ? 1.375 : 0.54], [0.92, 0.38, 0.055], '#365c75'),
      box([0, 0.92, bus ? -1.57 : -0.79], [0.92, 0.33, 0.05], '#365c75'),
      box([0, 0.27, 0], [1.14, 0.12, bus ? 3.15 : 2.2], '#344754'),
      ...[-1, 1].flatMap((side) => [
        box(
          [side * 0.547, 0.94, -0.12],
          [0.045, 0.33, bus ? 2.3 : 1.08],
          '#426c7c',
        ),
        box(
          [side * 0.39, 0.49, bus ? 1.58 : 1.12],
          [0.26, 0.17, 0.04],
          '#fff0bb',
        ),
        box(
          [side * 0.41, 0.48, bus ? -1.58 : -1.12],
          [0.17, 0.15, 0.04],
          '#e05b5c',
        ),
      ]),
    ],
    [bus, color],
  );
  useFrame((_, delta) => {
    wheels.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x += speed.current * Math.min(delta, 0.05) * 4;
    });
  });
  return (
    <group>
      <Boxes items={items} />
      {[-1, 1].flatMap((side, sideIndex) =>
        [-1, 1].map((end, endIndex) => (
          <group
            key={`${side}-${end}`}
            position={[side * 0.6, 0.27, end * (bus ? 1.06 : 0.7)]}
          >
            <mesh
              ref={(value) => {
                wheels.current[sideIndex * 2 + endIndex] = value;
              }}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.27, 0.27, 0.14, 10]} />
              <meshStandardMaterial color="#273640" roughness={1} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.12, 0.12, 0.155, 8]} />
              <meshStandardMaterial color="#b6bbc0" metalness={0.4} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
}

function Traffic({
  player,
  reducedMotion,
}: {
  player: RefObject<THREE.Vector3>;
  reducedMotion: boolean;
}) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const cars = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => ({
        distance: index / 5 + 0.02,
        speed: { current: 0 },
      })),
    [],
  );
  const track = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          [-8.8, 0, -10.6],
          [8.8, 0, -10.6],
          [10.6, 0, -8.8],
          [10.6, 0, 8.8],
          [8.8, 0, 10.6],
          [-8.8, 0, 10.6],
          [-10.6, 0, 8.8],
          [-10.6, 0, -8.8],
        ].map((point) => new THREE.Vector3(...point)),
        true,
        'catmullrom',
        0.05,
      ),
    [],
  );
  const length = useMemo(() => track.getLength(), [track]);
  const point = useMemo(() => new THREE.Vector3(), []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05);
    cars.forEach((car, index) => {
      const group = groups.current[index];
      if (!group) return;
      track.getPointAt(car.distance % 1, point);
      track.getTangentAt(car.distance % 1, forward);
      const ahead = cars.reduce(
        (gap, other) =>
          other === car
            ? gap
            : Math.min(gap, ((other.distance - car.distance + 1) % 1) * length),
        length,
      );
      const px = player.current.x - point.x,
        pz = player.current.z - point.z;
      const crossing =
        Math.hypot(px, pz) < 3.2 && px * forward.x + pz * forward.z > -0.6;
      const targetSpeed = reducedMotion || crossing || ahead < 4.7 ? 0 : 2.6;
      car.speed.current = THREE.MathUtils.damp(
        car.speed.current,
        targetSpeed,
        crossing ? 10 : 2,
        delta,
      );
      car.distance = (car.distance + (car.speed.current * delta) / length) % 1;
      group.position.copy(point);
      group.rotation.y = Math.atan2(forward.x, forward.z);
    });
  });
  return (
    <>
      {cars.map((car, index) => (
        <group
          key={index}
          ref={(value) => {
            groups.current[index] = value;
          }}
        >
          <Vehicle
            color={
              ['#e57660', '#76afb6', '#f3d69a', '#727aab', '#e8dfcf'][index]
            }
            bus={index === 2}
            speed={car.speed}
          />
        </group>
      ))}
    </>
  );
}

export function Petals({ reducedMotion }: { reducedMotion: boolean }) {
  const particles = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    if (!particles.current || reducedMotion) return;
    const time = clock.elapsedTime;
    for (let index = 0; index < 36; index += 1) {
      const seed = index * 17.37;
      dummy.position.set(
        ((seed + time * 0.38) % 19) - 9.5,
        5.7 - ((index * 0.67 + time * 0.32) % 5.5),
        ((seed * 0.73 + time * 0.16) % 17) - 8.5,
      );
      dummy.rotation.set(
        time + index,
        index + time * 0.6,
        Math.sin(time + index),
      );
      dummy.scale.set(0.08, 0.035, 0.055);
      dummy.updateMatrix();
      particles.current.setMatrixAt(index, dummy.matrix);
    }
    particles.current.instanceMatrix.needsUpdate = true;
  });
  if (reducedMotion) return null;
  return (
    <instancedMesh
      ref={particles}
      args={[undefined, undefined, 36]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#f8ced7" roughness={1} />
    </instancedMesh>
  );
}

export const TownEnvironment = memo(function TownEnvironment({
  area,
  player,
  reducedMotion,
}: {
  area: WorldAreaId;
  player: RefObject<THREE.Vector3>;
  reducedMotion: boolean;
}) {
  const festival = area === 'festival';
  return (
    <>
      <color attach="background" args={[festival ? '#d8b9b2' : '#b6d8e3']} />
      <fog attach="fog" args={[festival ? '#e0c2b3' : '#c1dbe0', 29, 61]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight
        args={[festival ? '#ffdac1' : '#fff0d2', '#8c9b9b', 1.65]}
      />
      <directionalLight
        castShadow
        position={[-8, 15, 9]}
        intensity={2.3}
        color={festival ? '#ffc69e' : '#fff0cd'}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-23}
        shadow-camera-right={23}
        shadow-camera-top={24}
        shadow-camera-bottom={-22}
        shadow-camera-far={65}
        shadow-normalBias={0.035}
      />
      <Streets festival={festival} />
      {TOWN_BUILDINGS.map((building, index) => (
        <Building
          key={index}
          building={building}
          index={index}
          reducedMotion={reducedMotion}
        />
      ))}
      {PLAZA_TREES.map(([x, z, blossom], index) => (
        <TownTree
          key={index}
          x={x}
          z={z}
          blossom={blossom}
          reducedMotion={reducedMotion}
        />
      ))}
      <StreetFurniture festival={festival} reducedMotion={reducedMotion} />
      <Traffic player={player} reducedMotion={reducedMotion} />
      <Petals reducedMotion={reducedMotion} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.064, -1]}>
        <ringGeometry args={[2.3, 2.4, 40]} />
        <meshStandardMaterial color={festival ? '#ad7d66' : '#9bad9c'} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.065, -1]}>
        <ringGeometry args={[0.75, 0.83, 4]} />
        <meshStandardMaterial color={festival ? '#ad7d66' : '#9bad9c'} />
      </mesh>
    </>
  );
});
