# marathon-viewer

Fly around a marathon level. Collision detection is basic and annoying, and mostly works to keep you out of
walls. However it doesn't try to keep you out of ceilings and floors, which is more or less by design so you
can fly through doors, etc. You start in a arbitrary position in the map, 0.6 world units above the floor in
polygon 1. In some maps this will be out of bounds. If this happens you can open the javascript console and
type `teleport(n)` to teleport yourself to polygon `n`

Dumb control scheme: arrow keys for forward/back/turn left/turn right. `z` and `x` for strafe left and right.
`d` and `c` move you up and down.

You can click on walls/ceilings/floors to reassign their texture to a hardcoded texture.

No build system (yet). Serve this whole directory using a web server that can understand byte range requests.
i.e., the `http-server` npm package like so:

Assumes a map file and shapes file will also be served (not included). The paths to these files is hardcoded
in `index.js`.

```
http-server . -p 8000
```
