export function errorName(gl: WebGL2RenderingContext, error?: number): string {
    if (undefined === error) {
        error = gl.getError();
    }
    switch (error) {
        case gl.NO_ERROR: return 'No error';
        case gl.INVALID_ENUM: return 'Invalid Enum';
        case gl.INVALID_VALUE: return 'Invalid Value';
        case gl.INVALID_OPERATION: return 'Invalid Operation';
        case gl.INVALID_FRAMEBUFFER_OPERATION: return 'Invalid Framebuffer Operation';
        case gl.OUT_OF_MEMORY: return 'Out of Memory';
        case gl.CONTEXT_LOST_WEBGL: return 'Lost context';
        default: return 'Unknown Error';
    }
}

