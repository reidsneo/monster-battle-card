import { describe, expect, it } from 'vitest';
import { NPCS, createCampaign } from './campaign';
import {
  moveWorldPosition,
  safeWorldPosition,
  worldObstacles,
  WORLD_BOUNDS,
} from './world-layout';

describe('town movement and campaign compatibility', () => {
  it('keeps every existing rival and the journey spawn reachable', () => {
    const campaign = createCampaign();
    expect(safeWorldPosition(campaign.position, campaign.areaId)).toEqual(
      campaign.position,
    );
    for (const npc of Object.values(NPCS)) {
      expect(safeWorldPosition(npc.position, npc.areaId), npc.id).toEqual(
        npc.position,
      );
    }
  });

  it('slides along a building and cannot tunnel through it in a large step', () => {
    const obstacles = [{ x: 2, z: 0, halfX: 0.5, halfZ: 2, height: 5 }];
    const stopped = moveWorldPosition([0, 0, 0], 5, 0, obstacles);
    expect(stopped[0]).toBeLessThan(1.23);
    const sliding = moveWorldPosition([1.2, 0, 0], 1, 1, obstacles);
    expect(sliding[0]).toBeCloseTo(1.2);
    expect(sliding[2]).toBeCloseTo(1);
  });

  it('clamps exploration and moves incompatible old positions to the plaza', () => {
    expect(moveWorldPosition([0, 0, 0], 0, 30, [])).toEqual([
      0,
      0,
      WORLD_BOUNDS.maxZ,
    ]);
    expect(safeWorldPosition([-7.4, 0, -5.7], 'ranch')).toEqual([0, 0, 4.7]);
    expect(safeWorldPosition([NaN, 0, 0], 'festival')).toEqual([0, 0, 4.7]);
    expect(worldObstacles('festival').length).toBeGreaterThan(
      worldObstacles('ranch').length,
    );
  });
});
