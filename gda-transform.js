/*
 * Surveyor's Toolbox — GDA94 to MGA2020 DXF transformer
 *
 * Conformal method: official GDA94 -> GDA2020 seven-parameter similarity transform
 * (ICSM GDA2020 Technical Manual v1.8 / EPSG:8048; identical to EPSG:8446).
 * CPD method: NTv2 GSB forward shift using the official ICSM grid supplied by the user.
 *
 * Only ASCII DXF model/paper-space ENTITIES are transformed. Block geometry is
 * intentionally retained in block-local coordinates; INSERT points are transformed.
 */
(function (root) {
  'use strict';

  const A = 6378137.0;
  const F = 1 / 298.257222101;
  const E2 = F * (2 - F);
  const EP2 = E2 / (1 - E2);
  const K0 = 0.9996;
  const DEG = Math.PI / 180;
  const ARCSEC_TO_RAD = DEG / 3600;
  const HELMERT = {
    tx: 0.06155,
    ty: -0.01087,
    tz: -0.04019,
    scalePpm: -0.009994,
    rx: -0.0394924 * ARCSEC_TO_RAD,
    ry: -0.0327221 * ARCSEC_TO_RAD,
    rz: -0.0328979 * ARCSEC_TO_RAD
  };

  function geodeticToCartesian(lonDeg, latDeg, h) {
    const lon = lonDeg * DEG;
    const lat = latDeg * DEG;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const n = A / Math.sqrt(1 - E2 * sinLat * sinLat);
    return [
      (n + h) * cosLat * Math.cos(lon),
      (n + h) * cosLat * Math.sin(lon),
      (n * (1 - E2) + h) * sinLat
    ];
  }

  function cartesianToGeodetic(x, y, z) {
    const b = A * Math.sqrt(1 - E2);
    const p = Math.hypot(x, y);
    if (!Number.isFinite(p) || p < 1e-8) throw new Error('Invalid geocentric coordinate encountered.');
    const theta = Math.atan2(z * A, p * b);
    const st = Math.sin(theta), ct = Math.cos(theta);
    const lat = Math.atan2(z + EP2 * b * st * st * st, p - E2 * A * ct * ct * ct);
    const lon = Math.atan2(y, x);
    const sl = Math.sin(lat);
    const n = A / Math.sqrt(1 - E2 * sl * sl);
    const h = p / Math.cos(lat) - n;
    return [lon / DEG, lat / DEG, h];
  }

  function helmertGda94ToGda2020(lon, lat) {
    const c = geodeticToCartesian(lon, lat, 0);
    const p = HELMERT;
    const scale = 1 + p.scalePpm * 1e-6;
    // Coordinate-frame rotation convention used in the Australian parameter set.
    const x = p.tx + scale * (c[0] + p.rz * c[1] - p.ry * c[2]);
    const y = p.ty + scale * (-p.rz * c[0] + c[1] + p.rx * c[2]);
    const z = p.tz + scale * (p.ry * c[0] - p.rx * c[1] + c[2]);
    return cartesianToGeodetic(x, y, z);
  }

  function utmToGeographic(easting, northing, zone) {
    const x = easting - 500000;
    const y = northing - 10000000;
    const m = y / K0;
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    const mu = m / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256));
    const phi1 = mu
      + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
      + (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
      + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu)
      + (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);
    const s = Math.sin(phi1), c = Math.cos(phi1), t = Math.tan(phi1);
    const n1 = A / Math.sqrt(1 - E2 * s * s);
    const r1 = A * (1 - E2) / Math.pow(1 - E2 * s * s, 1.5);
    const t1 = t * t;
    const c1 = EP2 * c * c;
    const d = x / (n1 * K0);
    const lat = phi1 - (n1 * t / r1) * (
      d * d / 2
      - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * Math.pow(d, 4) / 24
      + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * Math.pow(d, 6) / 720
    );
    const lon0 = (zone * 6 - 183) * DEG;
    const lon = lon0 + (
      d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6
      + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * Math.pow(d, 5) / 120
    ) / c;
    return [lon / DEG, lat / DEG];
  }

  function geographicToUtm(lonDeg, latDeg, zone) {
    const lat = latDeg * DEG;
    const lon = lonDeg * DEG;
    const lon0 = (zone * 6 - 183) * DEG;
    const s = Math.sin(lat), c = Math.cos(lat), t = Math.tan(lat);
    const n = A / Math.sqrt(1 - E2 * s * s);
    const t2 = t * t;
    const c2 = EP2 * c * c;
    const aa = c * (lon - lon0);
    const e4 = E2 * E2, e6 = e4 * E2;
    const meridian = A * (
      (1 - E2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat
      - (3 * E2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * lat)
      + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * lat)
      - (35 * e6 / 3072) * Math.sin(6 * lat)
    );
    const e = 500000 + K0 * n * (
      aa + (1 - t2 + c2) * Math.pow(aa, 3) / 6
      + (5 - 18 * t2 + t2 * t2 + 72 * c2 - 58 * EP2) * Math.pow(aa, 5) / 120
    );
    const north = 10000000 + K0 * (
      meridian + n * t * (
        aa * aa / 2 + (5 - t2 + 9 * c2 + 4 * c2 * c2) * Math.pow(aa, 4) / 24
        + (61 - 58 * t2 + t2 * t2 + 600 * c2 - 330 * EP2) * Math.pow(aa, 6) / 720
      )
    );
    return [e, north];
  }

  function checkAustralianExtent(lon, lat) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < 110 || lon > 160 || lat < -46 || lat > -8) {
      throw new Error('The drawing contains coordinates outside the supported Australian GDA94 area. Check the source zone and datum.');
    }
  }

  function parseNtv2(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength < 352) throw new Error('The NTv2 grid file is incomplete or invalid.');
    const view = new DataView(arrayBuffer);
    function readLabel(offset) {
      let s = '';
      for (let i = 0; i < 8; i++) s += String.fromCharCode(view.getUint8(offset + i));
      return s.replace(/[\0 ]+$/g, '').trim();
    }
    function intValue(offset, little) { return view.getInt32(offset + 8, little); }
    function doubleValue(offset, little) { return view.getFloat64(offset + 8, little); }
    const little = view.getInt32(8, true) === 11;
    if (!little && view.getInt32(8, false) !== 11) throw new Error('This file does not appear to be an NTv2 .gsb grid.');
    function readHeader(offset, count) {
      const values = {};
      for (let i = 0; i < count; i++) {
        const at = offset + i * 16;
        const label = readLabel(at);
        if (!label) continue;
        if (['NUM_OREC', 'NUM_SREC', 'NUM_FILE', 'GS_COUNT'].includes(label)) values[label] = intValue(at, little);
        else if (['S_LAT', 'N_LAT', 'E_LONG', 'W_LONG', 'LAT_INC', 'LONG_INC', 'MAJOR_F', 'MINOR_F', 'MAJOR_T', 'MINOR_T'].includes(label)) values[label] = doubleValue(at, little);
        else values[label] = readLabel(at + 0).length ? (() => {
          let s = '';
          for (let j = 0; j < 8; j++) s += String.fromCharCode(view.getUint8(at + 8 + j));
          return s.replace(/[\0 ]+$/g, '').trim();
        })() : '';
      }
      return values;
    }
    const overview = readHeader(0, 11);
    const numOrec = overview.NUM_OREC || 11;
    const numSrec = overview.NUM_SREC || 11;
    const subCount = overview.NUM_FILE;
    if (!Number.isInteger(subCount) || subCount < 1 || subCount > 100) throw new Error('The NTv2 grid has an invalid sub-grid count.');
    if (overview.GS_TYPE && !String(overview.GS_TYPE).toUpperCase().includes('SECOND')) throw new Error('Only NTv2 grids expressed in arc-seconds are supported.');
    let offset = numOrec * 16;
    const grids = [];
    for (let i = 0; i < subCount; i++) {
      if (offset + numSrec * 16 > arrayBuffer.byteLength) throw new Error('The NTv2 grid header is truncated.');
      const h = readHeader(offset, numSrec);
      offset += numSrec * 16;
      const rows = Math.round((h.N_LAT - h.S_LAT) / h.LAT_INC) + 1;
      const cols = Math.round((h.W_LONG - h.E_LONG) / h.LONG_INC) + 1;
      const expected = rows * cols;
      if (!Number.isFinite(expected) || rows < 2 || cols < 2 || expected !== h.GS_COUNT) throw new Error('The NTv2 grid has invalid dimensions or node count.');
      const bytes = expected * 16;
      if (offset + bytes > arrayBuffer.byteLength) throw new Error('The NTv2 grid data is truncated.');
      grids.push({
        name: h.SUB_NAME || ('Grid ' + (i + 1)),
        south: h.S_LAT, north: h.N_LAT, east: h.E_LONG, west: h.W_LONG,
        latInc: h.LAT_INC, lonInc: h.LONG_INC, rows, cols,
        dataOffset: offset, area: h.LAT_INC * h.LONG_INC
      });
      offset += bytes;
    }
    if (!grids.length) throw new Error('No NTv2 sub-grids were found.');
    const systemFrom = String(overview.SYSTEM_F || '').trim();
    const systemTo = String(overview.SYSTEM_T || '').trim();
    if (!/GDA\s*94/i.test(systemFrom) || !/GDA\s*2020/i.test(systemTo)) {
      throw new Error('The selected grid is not labelled as a GDA94 → GDA2020 NTv2 transformation. Use the official ICSM GDA94_GDA2020_conformal_and_distortion.gsb file.');
    }
    return { view, little, grids, bytes: arrayBuffer.byteLength, systemFrom, systemTo, gridType: overview.GS_TYPE || '' };
  }

  function interpolateNtv2(gridSet, lonDeg, latDeg) {
    const latSec = latDeg * 3600;
    const lonWestSec = -lonDeg * 3600;
    const candidates = gridSet.grids.filter(g =>
      latSec >= g.south - 1e-7 && latSec <= g.north + 1e-7 &&
      lonWestSec >= g.east - 1e-7 && lonWestSec <= g.west + 1e-7
    ).sort((a, b) => a.area - b.area);
    if (!candidates.length) throw new Error('The selected NTv2 grid does not cover one or more drawing coordinates. The point may be outside the grid area.');
    const g = candidates[0];
    let rowF = (latSec - g.south) / g.latInc;
    let colF = (lonWestSec - g.east) / g.lonInc;
    let row = Math.floor(rowF), col = Math.floor(colF);
    let fy = rowF - row, fx = colF - col;
    if (row >= g.rows - 1) { row = g.rows - 2; fy = 1; }
    if (col >= g.cols - 1) { col = g.cols - 2; fx = 1; }
    if (row < 0 || col < 0) throw new Error('The coordinate is outside the selected NTv2 sub-grid.');
    const base = g.dataOffset;
    function node(r, c, component) {
      const index = (r * g.cols + c) * 16;
      return gridSet.view.getFloat32(base + index + component * 4, gridSet.little);
    }
    function bilinear(component) {
      const v00 = node(row, col, component);
      const v10 = node(row, col + 1, component);
      const v01 = node(row + 1, col, component);
      const v11 = node(row + 1, col + 1, component);
      if ([v00, v10, v01, v11].some(v => !Number.isFinite(v) || v <= -998.5)) {
        throw new Error('The NTv2 grid contains an unmodelled cell at one or more drawing coordinates.');
      }
      return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }
    const latShift = bilinear(0);
    const lonShiftWest = bilinear(1);
    return [lonDeg - lonShiftWest / 3600, latDeg + latShift / 3600];
  }

  function transformPoint(easting, northing, sourceZone, targetZone, method, gridSet) {
    const geographic = utmToGeographic(easting, northing, sourceZone);
    checkAustralianExtent(geographic[0], geographic[1]);
    let shifted;
    if (method === 'cpd') {
      if (!gridSet) throw new Error('Load the official ICSM Conformal + Distortion (.gsb) grid before converting with CPD.');
      shifted = interpolateNtv2(gridSet, geographic[0], geographic[1]);
    } else {
      shifted = helmertGda94ToGda2020(geographic[0], geographic[1]);
    }
    checkAustralianExtent(shifted[0], shifted[1]);
    return geographicToUtm(shifted[0], shifted[1], targetZone);
  }

  const COORD_ENTITY_TYPES = new Set([
    'POINT', 'LINE', 'RAY', 'XLINE', 'CIRCLE', 'ARC', 'ELLIPSE', 'LWPOLYLINE', 'POLYLINE', 'VERTEX',
    'SPLINE', '3DFACE', 'SOLID', 'TRACE', 'TEXT', 'MTEXT', 'ATTRIB', 'ATTDEF', 'INSERT', 'DIMENSION',
    'LEADER', 'HATCH', 'MLINE', 'MESH', 'IMAGE', 'WIPEOUT', 'UNDERLAY'
  ]);

  function parseDxf(text) {
    const newline = text.includes('\r\n') ? '\r\n' : (text.includes('\r') ? '\r' : '\n');
    const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
    const pairs = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = Number(lines[i].trim());
      if (!Number.isInteger(code)) throw new Error('This does not appear to be an ASCII DXF file. Invalid group code near line ' + (i + 1) + '.');
      pairs.push({ code, value: lines[i + 1], line: i + 1 });
    }
    if (!pairs.length) throw new Error('The DXF file is empty.');
    return { pairs, newline, trailingNewline: /(?:\r\n|\n|\r)$/.test(text), sourceLineCount: lines.length };
  }

  function transformDxfText(dxfText, options) {
    const opts = options || {};
    const sourceZone = Number(opts.sourceZone);
    const targetZone = Number(opts.targetZone);
    const method = opts.method === 'cpd' ? 'cpd' : 'conformal';
    const gridSet = opts.gridSet || null;
    if (!Number.isInteger(sourceZone) || sourceZone < 48 || sourceZone > 56 || !Number.isInteger(targetZone) || targetZone < 48 || targetZone > 56) {
      throw new Error('Choose a valid Australian MGA zone (48–56).');
    }
    if (method === 'cpd' && !gridSet) throw new Error('Select the official ICSM Conformal + Distortion grid file first.');

    const parsed = parseDxf(dxfText);
    const pairs = parsed.pairs;
    let section = '';
    let entityType = '';
    let entityIndexes = [];
    let transformedPoints = 0;
    let skippedLocalPoints = 0;
    let skippedTypes = new Set();
    let samples = [];
    let minBefore = [Infinity, Infinity], maxBefore = [-Infinity, -Infinity];
    let minAfter = [Infinity, Infinity], maxAfter = [-Infinity, -Infinity];
    let minShift = Infinity, maxShift = 0, totalShift = 0;

    function updateBounds(boundsMin, boundsMax, e, n) {
      boundsMin[0] = Math.min(boundsMin[0], e); boundsMin[1] = Math.min(boundsMin[1], n);
      boundsMax[0] = Math.max(boundsMax[0], e); boundsMax[1] = Math.max(boundsMax[1], n);
    }
    function transformEntity() {
      if (!entityType || !entityIndexes.length) return;
      if (entityType === 'VIEWPORT') { entityIndexes = []; return; }
      if (!COORD_ENTITY_TYPES.has(entityType)) {
        if (entityIndexes.some(i => pairs[i].code >= 10 && pairs[i].code <= 18)) skippedTypes.add(entityType);
        entityIndexes = [];
        return;
      }
      const xMap = new Map();
      const yMap = new Map();
      entityIndexes.forEach(i => {
        const code = pairs[i].code;
        let yCode = null;
        if (code >= 10 && code <= 18) yCode = code + 10;
        else if (code >= 110 && code <= 118) yCode = code + 10;
        else if (code >= 1010 && code <= 1013) yCode = code + 10;
        if (yCode !== null) {
          if (!xMap.has(yCode)) xMap.set(yCode, []);
          xMap.get(yCode).push(i);
        }
        if ((code >= 20 && code <= 28) || (code >= 120 && code <= 128) || (code >= 1020 && code <= 1023)) {
          if (!yMap.has(code)) yMap.set(code, []);
          yMap.get(code).push(i);
        }
      });
      for (const [yCode, xIndexes] of xMap.entries()) {
        let yIndexes = yMap.get(yCode);
        if (!yIndexes || !yIndexes.length) continue;
        // ELLIPSE major-axis direction, RAY/XLINE direction and image/mtext vectors are not points.
        if ((entityType === 'ELLIPSE' || entityType === 'RAY' || entityType === 'XLINE') && yCode >= 21) continue;
        if (['MTEXT', 'IMAGE', 'UNDERLAY'].includes(entityType) && yCode >= 21) continue;
        if (entityType === 'INSERT' && yCode !== 20) continue;
        if (entityType === 'POINT' && yCode !== 20) continue;
        if (['CIRCLE', 'ARC'].includes(entityType) && yCode !== 20) continue;
        if (['TEXT', 'ATTRIB', 'ATTDEF'].includes(entityType) && yCode > 21) continue;
        if (entityType === 'IMAGE' && yCode !== 20) continue;
        const count = Math.min(xIndexes.length, yIndexes.length);
        for (let k = 0; k < count; k++) {
          const xi = xIndexes[k], yi = yIndexes[k];
          const e = Number(String(pairs[xi].value).trim());
          const n = Number(String(pairs[yi].value).trim());
          if (!Number.isFinite(e) || !Number.isFinite(n)) continue;
          // A drawing may contain UCS or locally defined geometry. Flag obviously non-MGA positions rather than corrupting them.
          if (e < 10000 || e > 990000 || n < 100000 || n > 10000000) {
            skippedLocalPoints++;
            continue;
          }
          const out = transformPoint(e, n, sourceZone, targetZone, method, gridSet);
          const de = out[0] - e, dn = out[1] - n;
          const shift = Math.hypot(de, dn);
          pairs[xi].value = out[0].toFixed(6);
          pairs[yi].value = out[1].toFixed(6);
          transformedPoints++;
          updateBounds(minBefore, maxBefore, e, n);
          updateBounds(minAfter, maxAfter, out[0], out[1]);
          minShift = Math.min(minShift, shift); maxShift = Math.max(maxShift, shift); totalShift += shift;
          if (samples.length < 6) samples.push({ beforeE: e, beforeN: n, afterE: out[0], afterN: out[1], deltaE: de, deltaN: dn });
        }
      }
      entityIndexes = [];
    }

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      if (pair.code === 0) {
        if (section === 'ENTITIES') transformEntity();
        if (pair.value.trim().toUpperCase() === 'SECTION') {
          if (i + 1 < pairs.length && pairs[i + 1].code === 2) {
            section = pairs[i + 1].value.trim().toUpperCase();
            i++;
          }
          entityType = '';
          entityIndexes = [];
          continue;
        }
        if (pair.value.trim().toUpperCase() === 'ENDSEC') {
          section = '';
          entityType = '';
          entityIndexes = [];
          continue;
        }
        if (section === 'ENTITIES') {
          entityType = pair.value.trim().toUpperCase();
          entityIndexes = [];
        }
      } else if (section === 'ENTITIES' && entityType) {
        entityIndexes.push(i);
      }
    }
    if (section === 'ENTITIES') transformEntity();
    if (!transformedPoints) throw new Error('No supported drawing coordinates were found in the DXF ENTITIES section. The file may be empty, use block-only geometry, or be an unsupported DXF structure.');

    const outputLines = [];
    pairs.forEach(p => { outputLines.push(String(p.code).padStart(3, ' ')); outputLines.push(p.value); });
    let output = outputLines.join(parsed.newline);
    if (parsed.trailingNewline) output += parsed.newline;
    return {
      text: output,
      stats: {
        transformedPoints,
        skippedTypes: Array.from(skippedTypes).sort(),
        skippedLocalPoints,
        sourceZone,
        targetZone,
        method,
        minBefore, maxBefore, minAfter, maxAfter,
        minShift: Number.isFinite(minShift) ? minShift : 0,
        maxShift,
        averageShift: totalShift / transformedPoints,
        samples
      }
    };
  }

  function selfTest() {
    const p = transformPoint(300000, 6200000, 56, 56, 'conformal', null);
    const expected = [300000.4689913, 6200001.4209958];
    const error = Math.hypot(p[0] - expected[0], p[1] - expected[1]);
    if (error > 0.005) throw new Error('Coordinate transformation check failed (' + error.toFixed(4) + ' m).');
    const ll = utmToGeographic(300000, 6200000, 56);
    const roundTrip = geographicToUtm(ll[0], ll[1], 56);
    const roundTripError = Math.hypot(roundTrip[0] - 300000, roundTrip[1] - 6200000);
    if (roundTripError > 0.002) throw new Error('MGA projection round-trip check failed (' + roundTripError.toFixed(4) + ' m).');
    return { passed: true, officialReferenceError: error, projectionRoundTripError: roundTripError };
  }

  function byId(id) { return document.getElementById(id); }
  function setStatus(message, tone) {
    const el = byId('gdaStatus');
    if (!el) return;
    el.hidden = false;
    el.className = 'gda-status' + (tone ? ' ' + tone : '');
    el.textContent = message;
  }
  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected DXF file.'));
      reader.readAsText(file);
    });
  }
  function readFileBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to read the selected NTv2 grid file.'));
      reader.readAsArrayBuffer(file);
    });
  }
  function fmt(v) { return Number(v).toFixed(3); }
  function setReadyState() {
    const file = byId('gdaDxfFile') && byId('gdaDxfFile').files[0];
    const method = document.querySelector('input[name="gdaMethod"]:checked')?.value || 'conformal';
    const hasGrid = !!(byId('gdaGridFile') && byId('gdaGridFile').files[0]) || !!root.__gdaLoadedGrid;
    const btn = byId('gdaConvertBtn');
    if (btn) btn.disabled = !file || !/\.dxf$/i.test(file.name) || (method === 'cpd' && !hasGrid);
    const wrap = byId('gdaGridUpload');
    if (wrap) wrap.hidden = method !== 'cpd';
  }
  function renderResults(stats, filename, outputText) {
    const results = byId('gdaResults');
    if (!results) return;
    results.hidden = false;
    const methodName = stats.method === 'cpd' ? 'Conformal + Distortion (NTv2 CPD)' : '7-parameter conformal';
    const cells = [
      ['Points transformed', stats.transformedPoints.toLocaleString()],
      ['Transformation method', methodName],
      ['Minimum shift', fmt(stats.minShift) + ' m'],
      ['Maximum shift', fmt(stats.maxShift) + ' m'],
      ['Local points left untouched', stats.skippedLocalPoints.toLocaleString()]
    ];
    const statGrid = byId('gdaStatGrid');
    if (statGrid) statGrid.innerHTML = cells.map(x => '<div class="gda-stat"><span>' + x[0] + '</span><strong>' + x[1] + '</strong></div>').join('');
    const sampleBody = byId('gdaSampleRows');
    if (sampleBody) sampleBody.innerHTML = stats.samples.map(s => '<tr><td>' + fmt(s.beforeE) + '</td><td>' + fmt(s.beforeN) + '</td><td>' + fmt(s.afterE) + '</td><td>' + fmt(s.afterN) + '</td><td>' + fmt(s.deltaE) + '</td><td>' + fmt(s.deltaN) + '</td></tr>').join('');
    const warning = byId('gdaUnsupportedNotice');
    if (warning) {
      const notes = [];
      if (stats.skippedTypes.length) notes.push('Unsupported or specialised DXF entities were not changed: ' + stats.skippedTypes.join(', ') + '.');
      if (stats.skippedLocalPoints) notes.push(stats.skippedLocalPoints + ' coordinate pair(s) outside the expected MGA metre range were left untouched (for example, local title-block geometry).');
      warning.hidden = !notes.length;
      warning.textContent = notes.join(' ');
    }
    const before = byId('gdaBeforeBounds');
    const after = byId('gdaAfterBounds');
    if (before) before.textContent = 'E ' + fmt(stats.minBefore[0]) + ' to ' + fmt(stats.maxBefore[0]) + ' · N ' + fmt(stats.minBefore[1]) + ' to ' + fmt(stats.maxBefore[1]);
    if (after) after.textContent = 'E ' + fmt(stats.minAfter[0]) + ' to ' + fmt(stats.maxAfter[0]) + ' · N ' + fmt(stats.minAfter[1]) + ' to ' + fmt(stats.maxAfter[1]);
    const blob = new Blob([outputText], { type: 'application/dxf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = byId('gdaDownload');
    if (link) {
      if (link.dataset.url) URL.revokeObjectURL(link.dataset.url);
      link.dataset.url = url;
      link.href = url;
      const stem = filename.replace(/\.dxf$/i, '');
      link.download = stem + '_MGA2020_Zone' + stats.targetZone + '.dxf';
    }
    const note = byId('gdaMethodResult');
    if (note) note.textContent = methodName + ' · MGA94 Zone ' + stats.sourceZone + ' → MGA2020 Zone ' + stats.targetZone;
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function initUI() {
    const dxfInput = byId('gdaDxfFile');
    const gridInput = byId('gdaGridFile');
    const button = byId('gdaConvertBtn');
    const methodInputs = document.querySelectorAll('input[name="gdaMethod"]');
    if (!dxfInput || !button || dxfInput.dataset.bound === '1') return;
    dxfInput.dataset.bound = '1';
    dxfInput.addEventListener('change', () => {
      const file = dxfInput.files && dxfInput.files[0];
      const name = byId('gdaDxfName');
      if (name) name.textContent = file ? file.name + ' · ' + (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'No drawing selected';
      if (file && !/\.dxf$/i.test(file.name)) setStatus('Please choose an ASCII DXF drawing. DWG and binary DXF files are not supported in this first release.', 'error');
      else setStatus(file ? 'Drawing selected. Check the source and target MGA zones, then convert.' : 'Choose an ASCII DXF drawing to begin.', '');
      setReadyState();
    });
    if (gridInput) gridInput.addEventListener('change', async () => {
      const file = gridInput.files && gridInput.files[0];
      if (!file) { root.__gdaLoadedGrid = null; setReadyState(); return; }
      if (!/\.gsb$/i.test(file.name)) { setStatus('Please select an NTv2 .gsb grid file.', 'error'); return; }
      if (/^GDA94_GDA2020_conformal\.gsb$/i.test(file.name)) { root.__gdaLoadedGrid = null; setStatus('That is the conformal-only grid, not the CPD grid. Select GDA94_GDA2020_conformal_and_distortion.gsb for this method.', 'error'); setReadyState(); return; }
      setStatus('Reading NTv2 grid (' + (file.size / 1024 / 1024).toFixed(1) + ' MB). This can take a moment…', '');
      try {
        const buffer = await readFileBuffer(file);
        root.__gdaLoadedGrid = parseNtv2(buffer);
        const label = byId('gdaGridName');
        if (label) label.textContent = file.name + ' · ' + (file.size / 1024 / 1024).toFixed(1) + ' MB · ' + root.__gdaLoadedGrid.grids.length + ' sub-grid(s)';
        setStatus('NTv2 grid structure and datum labels checked. Confirm this is the official Conformal + Distortion grid before proceeding.', 'success');
      } catch (error) {
        root.__gdaLoadedGrid = null;
        setStatus(error.message || 'Unable to read the NTv2 grid.', 'error');
      }
      setReadyState();
    });
    methodInputs.forEach(input => input.addEventListener('change', setReadyState));
    button.addEventListener('click', async () => {
      const file = dxfInput.files && dxfInput.files[0];
      if (!file) return;
      const sourceZone = Number(byId('gdaSourceZone').value);
      const targetZone = Number(byId('gdaTargetZone').value);
      const method = document.querySelector('input[name="gdaMethod"]:checked')?.value || 'conformal';
      button.disabled = true;
      button.textContent = 'Converting drawing…';
      setStatus('Reading the drawing and transforming its supported coordinates…', '');
      try {
        const dxfText = await readFileText(file);
        const converted = transformDxfText(dxfText, { sourceZone, targetZone, method, gridSet: root.__gdaLoadedGrid });
        renderResults(converted.stats, file.name, converted.text);
        setStatus('Conversion complete. Review the point checks and export the new DXF.', 'success');
      } catch (error) {
        setStatus(error && error.message ? error.message : 'The drawing could not be converted.', 'error');
      } finally {
        button.textContent = 'Convert drawing';
        setReadyState();
      }
    });
    const reset = byId('gdaReset');
    if (reset) reset.addEventListener('click', () => {
      dxfInput.value = '';
      if (gridInput) gridInput.value = '';
      root.__gdaLoadedGrid = null;
      if (byId('gdaDxfName')) byId('gdaDxfName').textContent = 'No drawing selected';
      if (byId('gdaGridName')) byId('gdaGridName').textContent = 'No NTv2 grid loaded';
      if (byId('gdaResults')) byId('gdaResults').hidden = true;
      setStatus('Choose an ASCII DXF drawing to begin.', '');
      setReadyState();
    });
    try {
      const test = selfTest();
      setStatus('Ready · projection and EPSG:8446 conformal checks passed.', 'success');
      const qa = byId('gdaQaStatus');
      if (qa) qa.textContent = 'Core maths checked against an EPSG:8446 reference coordinate (difference ' + (test.officialReferenceError * 1000).toFixed(3) + ' mm).';
    } catch (error) {
      setStatus('The internal coordinate check failed. Do not use this converter: ' + error.message, 'error');
      button.disabled = true;
    }
    setReadyState();
  }

  root.GDATransform = {
    transformPoint,
    transformDxfText,
    parseNtv2,
    interpolateNtv2,
    selfTest
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
    else initUI();
  }
})(typeof window !== 'undefined' ? window : globalThis);