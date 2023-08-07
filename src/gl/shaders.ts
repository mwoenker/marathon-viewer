import { errorName } from './error-name';

const vertexShaderText = `
  attribute vec4 position;
  attribute vec2 tex_coord_attr;
  attribute lowp float light_attr;
  attribute lowp vec4 tint_color_attr;

  varying mediump vec2 tex_coord;
  varying lowp float light;
  varying lowp vec4 tint_color;
  
  void main() {
    gl_Position = position[2] * vec4(
      (2.0 * position[0]) - 1.0,
      1.0 - (2.0 * position[1]),
      -1.0 + (2.0 * position[2] / 100.0 / 1024.0),
      1.0
    );
    tex_coord = tex_coord_attr;
    light = light_attr;
    tint_color = tint_color_attr;
  }
`;

const fragmentShaderText = `
  varying mediump vec2 tex_coord;
  varying lowp float light;
  varying lowp vec4 tint_color;

  uniform int render_type;
  uniform sampler2D tex_sampler;
  uniform mediump float time;

  mediump float random(mediump vec2 pos) {
    mediump vec2 permuted = pos * (1.0 + time);
    return fract(sin(dot(permuted ,vec2(12.9898,78.233))) * 43758.5453);
  }

  lowp vec4 texture() {
    lowp float z = gl_FragCoord[2];
    lowp float dist = z;
    lowp float dist_brightness = 0.3 * clamp(1.0 - (dist * 20.0), 0.0, 1.0);
    lowp vec4 tex_color = texture2D(tex_sampler, tex_coord);
    lowp vec3 frag_color = (light + dist_brightness) * vec3(tex_color);
    lowp vec3 tinted_color = mix(frag_color, tint_color.xyz, tint_color.w);
    return vec4(tinted_color, tex_color[3]);
  }

  void main() {
    if (render_type == 1) {
      gl_FragColor = texture();
    } else if (render_type == 2) {
      mediump float r = random(gl_FragCoord.xy);
      mediump float g = random(r * gl_FragCoord.xy);
      mediump float b = random(g * gl_FragCoord.xy);
      gl_FragColor = vec4(r, g, b, 1);
    }
  }
`;

function compileShader(gl: WebGL2RenderingContext, shaderType: number, programText: string) {
    const shader = gl.createShader(shaderType);

    if (!shader) {
        throw new Error(`createShader blew up: ${errorName(gl, gl.getError())}`);
    }

    gl.shaderSource(shader, programText);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader failed to compile: ${log}`);
    }

    return shader;
}

function createShaderProgram(gl: WebGL2RenderingContext, vertexProgram: string, fragmentProgram: string) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexProgram);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentProgram);

    const program = gl.createProgram();

    if (!program) {
        throw new Error(`createShader blew up: ${errorName(gl, gl.getError())}`);
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`Unable to create shader program: ${gl.getProgramInfoLog(program)}`);
    }

    return {
        vertexShader,
        fragmentShader,
        program
    };
}

function attribLocation(gl: WebGL2RenderingContext, program: WebGLProgram, name: string) {
    const result = gl.getAttribLocation(program, name);
    if (result === -1) {
        throw new Error(`gl.getAttribLocation failed for '${name}': ${errorName(gl)}`);
    }
    return result;
}

function uniformLocation(gl: WebGL2RenderingContext, program: WebGLProgram, name: string) {
    const result = gl.getUniformLocation(program, name);
    if (!result) {
        throw new Error(`gl.getUniformLocation failed for '${name}': ${errorName(gl)}`);
    }
    return result;
}

export const floatBytes = 4;

export const positionNumCoords = 3;
export const texNumCoords = 2;
export const lightNumCoords = 1;
export const tintColorNumCoords = 4;

export const positionBytes = floatBytes * positionNumCoords;
export const texCoordBytes = floatBytes * texNumCoords;
export const lightBytes = floatBytes * lightNumCoords;
export const tintColorBytes = floatBytes * tintColorNumCoords;

export class Shader {
    gl: WebGL2RenderingContext
    program: WebGLProgram
    fragmentShader: WebGLShader
    vertexShader: WebGLShader
    vertexPosition: number
    texCoord: number
    light: number
    tintColor: number
    renderType: WebGLUniformLocation
    time: WebGLUniformLocation
    textureSampler: WebGLUniformLocation
    stride: number
    vertexOffset: number
    texCoordOffset: number
    lightOffset: number
    tintColorOffset: number;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;

        const { program, vertexShader, fragmentShader } = createShaderProgram(
            gl, vertexShaderText, fragmentShaderText);
        this.program = program;
        this.vertexShader = vertexShader;
        this.fragmentShader = fragmentShader;
        this.vertexPosition = attribLocation(gl, this.program, 'position');
        this.texCoord = attribLocation(gl, this.program, 'tex_coord_attr');
        this.light = attribLocation(gl, this.program, 'light_attr');
        this.tintColor = attribLocation(gl, this.program, 'tint_color_attr');

        this.renderType = uniformLocation(gl, this.program, 'render_type');
        this.textureSampler = uniformLocation(gl, this.program, 'tex_sampler');
        this.time = uniformLocation(gl, this.program, 'time');
        this.stride = positionBytes + texCoordBytes + lightBytes + tintColorBytes;

        this.vertexOffset = 0;
        this.texCoordOffset = this.vertexOffset + positionBytes;
        this.lightOffset = this.texCoordOffset + texCoordBytes;
        this.tintColorOffset = this.lightOffset + lightBytes;
    }

    dispose(): void {
        this.gl.deleteProgram(this.program);
        this.gl.deleteShader(this.vertexShader);
        this.gl.deleteShader(this.fragmentShader);
    }
}
