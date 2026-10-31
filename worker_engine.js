/**
 * Redline Pro 2.1 — Virtual Viewport Memory Optimization & Worker Bridge
 * Module 6: 512x512 Virtual Tiling, Memory Protection for A0/E Schematics,
 * and Background Web Worker RPC Client.
 * Redline Studio · textportdocx.in
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorkerEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * WorkerClient: Promise-based interface to worker.js
   */
  class WorkerClient {
    constructor() {
      this.worker = null;
      this.msgId = 0;
      this.pending = new Map();
      this._init();
    }

    _init() {
      if (typeof Worker === 'undefined') return;
      try {
        if (typeof location !== 'undefined' && location.protocol === 'file:') {
          this.worker = null;
          return;
        }
        this.worker = new Worker('worker.js');
        this.worker.onmessage = e => {
          const { id, status, result, error } = e.data || {};
          const p = this.pending.get(id);
          if (!p) return;
          this.pending.delete(id);
          if (status === 'ok') p.resolve(result);
          else p.reject(new Error(error || 'Worker task failed'));
        };
        this.worker.onerror = err => {
          // Fallback to synchronous execution on worker error
          const pendingEntries = Array.from(this.pending.values());
          this.pending.clear();
          this.worker = null;
          for (const entry of pendingEntries) {
            try {
              entry.resolve(this._syncDiff(entry.payload));
            } catch (e) {
              entry.reject(e);
            }
          }
        };
      } catch (e) {
        // Fallback to main thread when worker.js cannot be spawned directly
        this.worker = null;
      }
    }

    terminate() {
      if (this.worker) {
        try { this.worker.terminate(); } catch (e) {}
        this.worker = null;
      }
      for (const entry of this.pending.values()) {
        try { entry.reject(new Error('Worker terminated')); } catch (e) {}
      }
      this.pending.clear();
    }

    async diffPixels(payload) {
      if (!this.worker) {
        return this._syncDiff(payload);
      }

      const id = ++this.msgId;
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject, payload });
        try {
          this.worker.postMessage({ id, type: 'DIFF_PIXELS', payload });
        } catch (err) {
          this.pending.delete(id);
          resolve(this._syncDiff(payload));
        }
      });
    }

    _syncDiff({ width, height, dataA, dataB, bufA, bufB, tol, threshold, minpx = 2 }) {
      tol = tol ?? threshold ?? 40;
      dataA = dataA || bufA;
      dataB = dataB || bufB;
      const W = width | 0, H = height | 0, totalPx = W * H;
      const cls = new Uint8Array(totalPx);
      const dA = dataA instanceof Uint8ClampedArray ? dataA : new Uint8ClampedArray(dataA);
      const dB = dataB instanceof Uint8ClampedArray ? dataB : new Uint8ClampedArray(dataB);
      let countA = 0, countB = 0, countCommon = 0;

      for (let i = 0, p = 0; p < totalPx; p++, i += 4) {
        const lumA = (dA[i] * 299 + dA[i + 1] * 587 + dA[i + 2] * 114) / 1000;
        const lumB = (dB[i] * 299 + dB[i + 1] * 587 + dB[i + 2] * 114) / 1000;
        const isDarkA = (dA[i + 3] > 30 && lumA < 240);
        const isDarkB = (dB[i + 3] > 30 && lumB < 240);
        const diff = Math.abs(lumA - lumB);

        if (diff <= tol) {
          if (isDarkA || isDarkB) { cls[p] = 3; countCommon++; }
        } else if (lumA < lumB) {
          cls[p] = 1; countA++;
        } else {
          cls[p] = 2; countB++;
        }
      }

      const visited = new Uint8Array(totalPx);
      const regions = [];
      const stack = [];

      for (let y = 0; y < H; y++) {
        const rowOff = y * W;
        for (let x = 0; x < W; x++) {
          const idx = rowOff + x;
          const type = cls[idx];
          if ((type === 1 || type === 2) && !visited[idx]) {
            let minX = x, maxX = x, minY = y, maxY = y, pixelCount = 0;
            stack.push(x, y);
            visited[idx] = 1;
            while (stack.length > 0) {
              const cy = stack.pop(), cx = stack.pop();
              pixelCount++;
              if (cx < minX) minX = cx;
              if (cx > maxX) maxX = cx;
              if (cy < minY) minY = cy;
              if (cy > maxY) maxY = cy;
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

      return { cls, regions, countA, countB, countCommon };
    }
  }

  /**
   * VirtualTileManager: 512x512 Virtual Tiling for massive high-density A0/E schematics.
   * Only rasterizes and retains visible viewport tiles in RAM.
   */
  class VirtualTileManager {
    constructor(options = {}) {
      this.tileSize = options.tileSize || 512;
      this.maxCachedTiles = options.maxCachedTiles || 36;
      this.tileCache = new Map(); // key "col_row_scale" -> { canvas, lastUsed }
    }

    clear() {
      for (const tile of this.tileCache.values()) {
        if (tile.canvas) {
          tile.canvas.width = 0;
          tile.canvas.height = 0;
        }
      }
      this.tileCache.clear();
    }

    /**
     * Determine which tiles intersect the visible viewport
     */
    getVisibleTiles(viewX, viewY, viewW, viewH, totalW, totalH, scale = 1.0) {
      const s = this.tileSize;
      const safeScale = Math.max(1e-4, scale || 1.0);
      // Invert view transform to find visible rectangle in document coordinates
      const docLeft = Math.max(0, -viewX / safeScale);
      const docTop = Math.max(0, -viewY / safeScale);
      const docRight = Math.min(totalW, (-viewX + viewW) / safeScale);
      const docBottom = Math.min(totalH, (-viewY + viewH) / safeScale);

      const startCol = Math.max(0, Math.floor(docLeft / s));
      const endCol = Math.min(Math.ceil(totalW / s) - 1, Math.floor(docRight / s));
      const startRow = Math.max(0, Math.floor(docTop / s));
      const endRow = Math.min(Math.ceil(totalH / s) - 1, Math.floor(docBottom / s));

      const visible = [];
      const now = Date.now();

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const key = `${c}_${r}_${safeScale.toFixed(2)}`;
          visible.push({
            col: c,
            row: r,
            x: c * s,
            y: r * s,
            w: Math.min(s, totalW - c * s),
            h: Math.min(s, totalH - r * s),
            key
          });

          if (this.tileCache.has(key)) {
            this.tileCache.get(key).lastUsed = now;
          }
        }
      }

      this._pruneCache(now);
      return visible;
    }

    getOrCreateTileCanvas(key, width, height) {
      if (this.tileCache.has(key)) {
        const item = this.tileCache.get(key);
        item.lastUsed = Date.now();
        return item.canvas;
      }

      const canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : { width, height };
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
        this.tileCache.set(key, { canvas, lastUsed: Date.now() });
        this._pruneCache(Date.now());
      }
      return canvas;
    }

    _pruneCache(currentTime) {
      if (this.tileCache.size <= this.maxCachedTiles) return;

      // Sort entries by lastUsed ascending
      const entries = Array.from(this.tileCache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      const toRemove = entries.slice(0, this.tileCache.size - this.maxCachedTiles);

      for (const [key, item] of toRemove) {
        if (item.canvas) {
          // Explicitly deallocate backing store to avoid memory leaks
          item.canvas.width = 1;
          item.canvas.height = 1;
        }
        this.tileCache.delete(key);
      }
    }
  }

  return {
    WorkerClient,
    VirtualTileManager
  };
});
