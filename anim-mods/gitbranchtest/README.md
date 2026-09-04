V11.00.18 — Arm Ring Editing Foundation

Rebuild the 9-ring arm workflow around Blender-like edit operations. Add reliable ring/loop selection for shoulderSocket, deltoidOuter, bicepPeak, preElbow, elbowUpper, elbowApex, elbowLower, elbowToForearm, and bracerSocket. Add one-click semantic selections for Deltoid / Bicep / Elbow / Forearm, whole-ring translate/scale, Shift multi-ring selection, and proper component-only gizmos. This version should also support ring insertion/removal so we can add or subtract topology rows without rebuilding the arm manually.

V11.00.19 — Arm Anatomy Parameter Pass

Focus almost entirely on ring diameter, depth, eccentricity, and bicep/deltoid shaping, rather than final silhouette. Push shoulderSocket deeper under the future pauldron, expand deltoidOuter outward/downward, keep bicepPeak broad, and make preElbow taper more moderately. Add parameters such as width, depth, verticalScale, radialBias, and perhaps outerBulge per ring. This establishes the anatomical volume language before posing or armor.

V11.00.20 — Weighted Ring Manipulation + Relax

Add manual interactive falloff similar to Blender proportional editing. Moving/scaling a ring influences neighboring rings with adjustable radius and curve. For example, manipulating elbowApex might influence elbowUpper, elbowLower, preElbow, and elbowToForearm with decreasing weights. Add Relax Selected, loop smoothing, and even-spacing so hand edits do not leave jagged topology. This version should make sculpting the elbow and forearm much faster.

V11.00.21 — Blender-Style Face/Edge Construction

Expand Edit Mode beyond manipulation. Selected compatible vertices or edges + F should create a face, matching the Blender mental model. Support closing an open edge boundary, filling selected loops where valid, creating triangles/quads, and rejecting non-manifold/invalid fills rather than silently making broken geometry. Also add edge creation between two selected vertices and basic dissolve/delete operations. This becomes the first genuinely useful manual topology-repair version.

V11.00.22 — Shoulder Pauldrons

Use image 1 as the authority, not image 2. Build the broad layered pauldrons over the finished anatomical shoulder instead of reshaping the arm around armor. Give each pauldron a clean shoulder anchor, controlled clearance from the deltoid, layered outer plates/cloth sections, and independent transform/fit parameters. The shoulder socket should remain slightly buried beneath this structure so the character reads as broad and armored without exposing a mechanical arm joint.

V11.00.23 — Hood / Cape Connection + Cloth Parameters

Connect hood → upper back → shoulder cape cleanly. This is also where I would introduce the first parameterized cloth system, but not a full node editor yet. Useful parameters would be drop, flare, stiffness, foldDepth, segmentCount, shoulderSpread, backLength, and edgeCurl. Once that system is proven, a later node editor can expose those same parameters visually rather than inventing a separate cloth architecture.

V11.00.24 — Cloth Skirt Panels + Legs + Boots

Build the lower-body hierarchy from the first concept image. Start with discrete front/side/back skirt panels instead of one continuous shell. Then adjust the legs to the stockier heroic RTS proportions and enlarge the boots into strong planted forms. The priority is readable low-poly masses at game-camera distance: separated skirt panels, visible knees, short sturdy lower legs, and oversized boots.

V11.00.25 — Arm Pose + Rifle Relationship

Now use the new ring tools to match the second reference's cross-body pose. Work shoulder → bicep → elbow → forearm while keeping the anatomy profile from V19/V20 intact. The elbow should become compressed and broad rather than pointed; the forearm should flare again after the elbow; wrist and bracer socket should line up with the rifle grip. This is the version where we should finally judge the arm visually against the rifleman reference rather than judging topology in isolation.

V11.00.26 — Torso Silhouette + Hands / Rifle Sockets

Only after shoulders, cape, skirt, legs, and boots exist should we finalize the torso silhouette. Broaden the upper chest, compress the waist, and clean the transitions into the shoulder sockets. Then revisit the hands: right-hand trigger socket, left-hand barrel-support socket, wrist orientation, palm scale, finger-block placement, and rifle attachment points. This keeps us from designing hands around a torso/arm pose that later changes.
V11.00.27 — Arm Profile Saving + Final Proportion Pass
Convert the successful manual edits into reusable data. Add a RiflemanArmProfile containing ring centers, widths, depths, local rotations, falloff values, and pose offsets. Include Save Arm Profile / Load Arm Profile / Mirror Profile / Reset to Generated. Then do the final whole-character comparison against image 1: hood height, shoulder width, cape spread, chest-to-waist ratio, arm mass, skirt length, knee position, boot size, rifle placement, and overall RTS readability.

The important dependency chain is:

Arm editing tools
   ↓
Arm anatomy parameters
   ↓
Weighted sculpt / relax
   ↓
Topology creation tools
   ↓
Arm pose
   ↓
Pauldron fit
   ↓
Hood + cape
   ↓
Skirt / legs / boots
   ↓
Torso + hands / rifle
   ↓
Saved profile + final proportions

ClothProfile {
  segmentCount,
  width,
  length,
  flare,
  stiffness,
  foldDepth,
  edgeCurl,
  anchorPoints,
  symmetry
}


The intended dock stack is:
ENTITY / TRANSFORM
ARM RINGS
ARM ANATOMY
RIG TEST
ARM DEBUG
RUNTIME DEBUG

regression check

Before testing anatomy, confirm nothing from V18 broke.

Click right arm once.
Confirm arm entity selection.
Click right arm again.
Confirm Edit Mode.
Confirm black vertex points and black edges appear.
Alt-click a ring.
Confirm whole ring becomes yellow.
Drag XYZ.
Confirm selected ring moves.
