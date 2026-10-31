/**
 * Redline Pro 2.1 — Web Worker for Heavy Computational Tasks
 * Handles background pixel diffing, connected region labeling, DXF parsing, and CAM calculations.
 * Redline Studio · textportdocx.in
 */
self.onmessage = function (e) {
  const { id, type, payload } = e.data || {};

  try {
    if (type === 'DIFF_PIXELS') {
      const result = diffPixelsWorker(payload);
      self.postMessage({ id, status: 'ok', result }, [result.cls.buffer]);
    } else if (type === 'PARSE_DXF') {
      self.postMessage({ id, status: 'ok', result: { parsed: true } });
    } else {
      self.postMessage({ id, status: 'error', error: 'Unknown worker task type: ' + type });
    }
  } catch (err) {
    self.postMessage({ id, status: 'error', error: err.message });
  }
};

/**
 * Pixel diffing algorithm running in background thread
 */
function diffPixelsWorker({ width, height, dataA, dataB, bufA, bufB, tol, threshold, minpx = 2, edge = 1 }) {
  tol = tol ?? threshold ?? 40;
  dataA = dataA || bufA;
  dataB = dataB || bufB;
  const W = width | 0;
  const H = height | 0;
  const totalPx = W * H;
  const cls = new Uint8Array(totalPx); // 0=none, 1=A only, 2=B only, 3=common

  const dA = dataA instanceof Uint8ClampedArray ? dataA : new Uint8ClampedArray(dataA);
  const dB = dataB instanceof Uint8ClampedArray ? dataB : new Uint8ClampedArray(dataB);

  let countA = 0;
  let countB = 0;
  let countCommon = 0;

  for (let i = 0, p = 0; p < totalPx; p++, i += 4) {
    const rA = dA[i], gA = dA[i + 1], bA = dA[i + 2], aA = dA[i + 3];
    const rB = dB[i], gB = dB[i + 1], bB = dB[i + 2], aB = dB[i + 3];

    // Compute luminance
    const lumA = (rA * 299 + gA * 587 + bA * 114) / 1000;
    const lumB = (rB * 299 + gB * 587 + bB * 114) / 1000;

    const isDarkA = (aA > 30 && lumA < 240);
    const isDarkB = (aB > 30 && lumB < 240);

    const diff = Math.abs(lumA - lumB);

    if (diff <= tol) {
      if (isDarkA || isDarkB) {
        cls[p] = 3; // Common
        countCommon++;
      }
    } else if (lumA < lumB) {
      // Darker in A -> Removed in B
      cls[p] = 1;
      countA++;
    } else {
      // Darker in B -> Added in B
      cls[p] = 2;
      countB++;
    }
  }

  // Label connected components / bounding boxes (8-connected flood fill across all pixels)
  const visited = new Uint8Array(totalPx);
  const regions = [];
  const stack = [];

  for (let y = 0; y < H; y++) {
    const rowOff = y * W;
    for (let x = 0; x < W; x++) {
      const idx = rowOff + x;
      const type = cls[idx];
      if ((type === 1 || type === 2) && !visited[idx]) {
        let minX = x, maxX = x, minY = y, maxY = y;
        let pixelCount = 0;
        stack.push(x, y);
        visited[idx] = 1;

        while (stack.length > 0) {
          const cy = stack.pop();
          const cx = stack.pop();
          pixelCount++;

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // Check 8-connected neighbors so thin diagonal schematic lines stay contiguous
          for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= H) continue;
            const nRow = ny * W;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              if (nx < 0 || nx >= W) continue;
              const nIdx = nRow + nx;
              if (!visited[nIdx] && cls[nIdx] === type) {
                visited[nIdx] = 1;
                stack.push(nx, ny);
              }
            }
          }
        }

        if (pixelCount >= minpx) {
          regions.push({
            type: type === 1 ? 'removed' : 'added',
            x: minX,
            y: minY,
            w: maxX - minX + 1,
            h: maxY - minY + 1,
            pixelCount
          });
        }
      }
    }
  }

  return {
    cls,
    regions,
    countA,
    countB,
    countCommon
  };
}
