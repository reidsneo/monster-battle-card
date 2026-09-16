'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import {
  Component,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChibiCharacter } from './chibi-character';

export const NPC_COLORS: Record<string, string> = {
  mina: '#629d8b',
  kiro: '#5b93bd',
  bram: '#c67a51',
  lyra: '#9b7ead',
  rook: '#ad655c',
  veyra: '#4c629b',
};
const portraits = new Map<string, string>();

class PortraitBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function PortraitCapture({ capture }: { capture: (url: string) => void }) {
  const done = useRef(false);
  useFrame(({ gl, scene, camera }) => {
    if (done.current) return;
    gl.render(scene, camera);
    done.current = true;
    const url = gl.domElement.toDataURL('image/png');
    queueMicrotask(() => capture(url));
  }, 1);
  return null;
}

/** Render the actual roaming mesh once, then release its renderer and reuse the snapshot. */
export function ChibiPortrait({
  variant = 'player',
  color,
  fallback,
  name,
}: {
  variant?: string;
  color: string;
  fallback: string;
  name: string;
}) {
  const cacheKey = `${variant}-${color}`;
  const [snapshot, setSnapshot] = useState(() => portraits.get(cacheKey));
  const capture = useCallback(
    (url: string) => {
      portraits.set(cacheKey, url);
      setSnapshot(url);
    },
    [cacheKey],
  );
  return (
    <span className="chibi-portrait">
      <img src={snapshot ?? fallback} alt={`${name} portrait`} />
      {!snapshot && (
        <span className="portrait-renderer" aria-hidden="true">
          <PortraitBoundary>
            <Canvas
              orthographic
              camera={{ position: [0, 1.27, 5], zoom: 190, near: 0.1, far: 12 }}
              dpr={1}
              frameloop="always"
              gl={{ alpha: true, antialias: true }}
              onCreated={({ camera }) => camera.lookAt(0, 1.27, 0)}
            >
              <ambientLight intensity={1.4} />
              <directionalLight
                position={[-3, 5, 5]}
                intensity={2.5}
                color="#fff0df"
              />
              <group rotation={[0, -0.12, 0]}>
                <ChibiCharacter variant={variant} color={color} reducedMotion />
              </group>
              <PortraitCapture capture={capture} />
            </Canvas>
          </PortraitBoundary>
        </span>
      )}
    </span>
  );
}
