# Journey town and characters

The journey uses original procedural Three.js meshes. No files from the linked commercial packs are bundled and no remote model or font downloads are needed at runtime.

Visual references supplied for this update:

- [Low Poly Tokyo Japan City by CGmano](https://sketchfab.com/3d-models/low-poly-tokyo-japan-city-007a177acb394a8c8e0f7d26fc388775): compact facades, layered shop signage, awnings, utility cables, street trees and small vehicles.
- [Chibi Heroes Pack + Basemesh by QUBITS](https://sketchfab.com/3d-models/chibi-heroes-pack-basemesh-0e78d3ca416149e7b805c177d60748cd): oversized heads, expressive eyes, compact limbs and readable costume silhouettes.

The local character rig has hip, knee, shoulder, elbow and head pivots. Locomotion drives the walk cycle; NPC dialogue drives hand gestures, mouth movement and nodding. Idle characters breathe and blink. Breeder outfit palettes and NPC identities remain distinct.

Both campaign areas retain their stable IDs and NPC positions. Shared collision geometry blocks buildings, planters, benches, vending machines and festival gate pillars. Legacy positions inside new scenery recover to the plaza. Traffic follows a local closed path, keeps its spacing and yields near the player. Pedestrians, curtains, lanterns, tree crowns and petals animate without network assets. Reduced-motion settings stop background traffic, walkers and petals and simplify character and camera motion.

Repeated facade pieces, street tiles, road markings and vehicles use instanced boxes. Card imagery and the battle engine are unaffected. Scene geometry is owned and disposed by React Three Fiber; locally generated shop-sign textures are explicitly disposed on unmount.

## Sakura Duel Court

The duel uses the same original shopfronts, sakura trees and lanterns around a woven blue-slate, lacquer-and-gold tournament dais. Monster Life plates and public pile labels are projected from their actual 3D positions, including during camera movement. Card art, deck backs, hidden information, and combat rules remain unchanged.

HUD and dialogue portraits are locally rendered snapshots of the roaming character mesh, including its outfit palette. The small temporary renderers are released after capture; the snapshots are cached for the session. Existing portraits remain the fallback if a portrait renderer is unavailable. No new image generation or external downloads are used.

`buildDuelCues` consumes every new structured public event, not only the last event in a reducer batch. Direction, ordered card reveals, guard responses, calculation, impact and result phases share one input-locking presentation queue. Space or the Next Beat button advances one cue after 300 ms. Speed, reduced motion, cinematic camera, particle density and sound toggles are available in Pause. Reduced motion removes camera motion, particles, shake and animated cut-ins.

SFX are original Web Audio synthesis: filtered noise sweeps, layered low-frequency impacts, paper flicks, guard harmonics and recovery arpeggios. Audio starts only after a user gesture, passes through a quiet master gain and compressor, obeys mute/pause, and releases its context on navigation. No music or third-party sound files are bundled.
