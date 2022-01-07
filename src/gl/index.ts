import { World } from '../world';
import { Player } from '../player';
import { Shapes } from '../shapes-loader';
import { render } from '../render';
import { Rasterizer } from './rasterize';
import { errorName } from './error-name';
import { getShaderProgram } from './shaders';
import { ShapeTextures } from './shape-textures';

function createGeometry(gl: WebGL2RenderingContext): Geometry {
    const positions = gl.createBuffer();
    if (!positions) {
        throw new Error(`createGeometry blew up: ${errorName(gl, gl.getError())}`);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positions);
    const coordinates = [
        -1.0, 1.0,
        1.0, 1.0,
        -1.0, -1.0,
        1.0, -1.0,
    ];
    coordinates.forEach((x, i) => coordinates[i] = x * 0.7);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordinates), gl.STATIC_DRAW);
    return { positions };
}

interface Geometry {
    positions: WebGLBuffer;
}

let geometry: Geometry | null = null;

function getGeometry(gl: WebGL2RenderingContext): Geometry {
    if (!geometry) {
        geometry = createGeometry(gl);
    }
    return geometry;
}

let shapeTextures: null | ShapeTextures = null;

function getShapeTextures(gl: WebGL2RenderingContext, shapeLoader: Shapes) {
    if (shapeTextures) {
        return shapeTextures;
    } else {
        shapeTextures = new ShapeTextures(gl, shapeLoader);
        return shapeTextures;
    }
}

export function glRender(
    gl: WebGL2RenderingContext,
    player: Player,
    world: World,
    shapes: Shapes,
    seconds: number
): void {
    // const shaderInfo = getShaderProgram(gl);
    // const geometry = getGeometry(gl);

    gl.clearColor(0.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.DEPTH_TEST);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // const nVertexComponents = 2;
    // const type = gl.FLOAT;
    // const normalize = false;
    // const stride = 0;
    // const offset = 0;

    // gl.bindBuffer(gl.ARRAY_BUFFER, geometry.positions);
    // gl.vertexAttribPointer(
    //     shaderInfo.vertexPosition,
    //     nVertexComponents,
    //     type,
    //     normalize,
    //     stride,
    //     offset);
    // gl.enableVertexAttribArray(shaderInfo.vertexPosition);
    // gl.useProgram(shaderInfo.program);

    // const drawOffset = 0;
    // const drawVertexCount = 4;
    //gl.drawArrays(gl.TRIANGLE_STRIP, drawOffset, drawVertexCount);

    //const rasterizer = new Rasterizer(canvas.width, canvas.height, pixels, player);
    const rasterizer = new Rasterizer(player, gl, getShapeTextures(gl, shapes));

    render({ rasterizer, player, world, seconds });
    rasterizer.flush(true);
}
