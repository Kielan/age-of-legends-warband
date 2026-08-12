PlatformerControls + imported Hero FBX
======================================

WHY THE ORIGINAL CAN APPEAR BLANK
- It starts with remote ES-module imports. If either CDN module is blocked/fails, none of the scene code executes.
- OrbitControls was imported even though it was unused, creating an unnecessary second startup dependency.
- Browser-loaded FBX/textures should be served over HTTP; do not double-click index.html with file://.

RUN ON WINDOWS
1. Extract this project folder.
2. Double-click start_server.bat.
3. Open http://localhost:8000/ in Chrome/Edge if it does not open automatically.

Or from a terminal in this folder:
    py -m http.server 8000

CONTROLS
A/D move
W or SPACE jump
S fast fall
J light attack
K heavy attack
L special
SHIFT dodge/burst
R reset

PLAYER ASSET
assets/Hero/brave.fbx is loaded with Three.js FBXLoader. Base-folder PNG textures from the supplied archive are included next to it so FBX texture references can resolve. The loader plays the first embedded animation clip if one is present.

NOTE
The supplied archive contains multiple alternate character variants. This demo intentionally includes only the base Hero/brave.fbx + its root-level texture set to keep the test project smaller.
