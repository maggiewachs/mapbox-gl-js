// @flow

import {mat4} from 'gl-matrix';

import {
    Uniform1i,
    Uniform1f,
    Uniform2f,
    UniformColor,
    UniformMatrix4f,
    Uniform4f
} from '../uniform_binding.js';
import EXTENT from '../../style-spec/data/extent.js';
import MercatorCoordinate from '../../geo/mercator_coordinate.js';
import {cartesianPositionToSpherical, degToRad} from '../../../src/util/util.js';

import type Context from '../../gl/context.js';
import type {UniformValues} from '../uniform_binding.js';
import type Tile from '../../source/tile.js';
import type Painter from '../painter.js';
import type HillshadeStyleLayer from '../../style/style_layer/hillshade_style_layer.js';
import type DEMData from '../../data/dem_data.js';
import type {OverscaledTileID} from '../../source/tile_id.js';

export type HillshadeUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image': Uniform1i,
    'u_latrange': Uniform2f,
    'u_light': Uniform2f,
    'u_shadow': UniformColor,
    'u_highlight': UniformColor,
    'u_emissive_strength': Uniform1f,
    'u_accent': UniformColor
|};

export type HillshadePrepareUniformsType = {|
    'u_matrix': UniformMatrix4f,
    'u_image': Uniform1i,
    'u_dimension': Uniform2f,
    'u_zoom': Uniform1f,
    'u_unpack': Uniform4f
|};

export type HillshadeDefinesType = 'TERRAIN_DEM_FLOAT_FORMAT';

const hillshadeUniforms = (context: Context): HillshadeUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_image': new Uniform1i(context),
    'u_latrange': new Uniform2f(context),
    'u_light': new Uniform2f(context),
    'u_shadow': new UniformColor(context),
    'u_highlight': new UniformColor(context),
    'u_emissive_strength': new Uniform1f(context),
    'u_accent': new UniformColor(context)
});

const hillshadePrepareUniforms = (context: Context): HillshadePrepareUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_image': new Uniform1i(context),
    'u_dimension': new Uniform2f(context),
    'u_zoom': new Uniform1f(context),
    'u_unpack': new Uniform4f(context)
});

const hillshadeUniformValues = (
    painter: Painter,
    tile: Tile,
    layer: HillshadeStyleLayer,
    matrix: ?Float32Array
): UniformValues<HillshadeUniformsType> => {
    const shadow = layer.paint.get("hillshade-shadow-color");
    const highlight = layer.paint.get("hillshade-highlight-color");
    const accent = layer.paint.get("hillshade-accent-color");
    const emissiveStrength = layer.paint.get("hillshade-emissive-strength");

    let azimuthal = degToRad(layer.paint.get('hillshade-illumination-direction'));
    // modify azimuthal angle by map rotation if light is anchored at the viewport
    if (layer.paint.get('hillshade-illumination-anchor') === 'viewport') {
        azimuthal -= painter.transform.angle;
    } else if (painter.style && painter.style.enable3dLights()) {
        // hillshade-illumination-anchor = map & 3d lights enabled
        if (painter.style.directionalLight) {
            const direction = painter.style.directionalLight.properties.get('direction');
            const spherical = cartesianPositionToSpherical(direction.x, direction.y, direction.z);
            azimuthal = degToRad(spherical[1]);
        }
    }
    const align = !painter.options.moving;
    return {
        'u_matrix': matrix ? matrix : painter.transform.calculateProjMatrix(tile.tileID.toUnwrapped(), align),
        'u_image': 0,
        'u_latrange': getTileLatRange(painter, tile.tileID),
        'u_light': [layer.paint.get('hillshade-exaggeration'), azimuthal],
        'u_shadow': shadow,
        'u_highlight': highlight,
        'u_emissive_strength': emissiveStrength,
        'u_accent': accent
    };
};

const hillshadeUniformPrepareValues = (
    tileID: OverscaledTileID, dem: DEMData
): UniformValues<HillshadePrepareUniformsType> => {

    const stride = dem.stride;
    const matrix = mat4.create();
    // Flip rendering at y axis.
    mat4.ortho(matrix, 0, EXTENT, -EXTENT, 0, 0, 1);
    mat4.translate(matrix, matrix, [0, -EXTENT, 0]);

    return {
        'u_matrix': matrix,
        'u_image': 1,
        'u_dimension': [stride, stride],
        'u_zoom': tileID.overscaledZ,
        'u_unpack': dem.unpackVector
    };
};

function getTileLatRange(painter: Painter, tileID: OverscaledTileID) {
    // for scaling the magnitude of a points slope by its latitude
    const tilesAtZoom = Math.pow(2, tileID.canonical.z);
    const y = tileID.canonical.y;
    return [
        new MercatorCoordinate(0, y / tilesAtZoom).toLngLat().lat,
        new MercatorCoordinate(0, (y + 1) / tilesAtZoom).toLngLat().lat];
}

export {
    hillshadeUniforms,
    hillshadePrepareUniforms,
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
};
