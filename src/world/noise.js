export class ValueNoise {
  hash(i, j) {
    let n = i * 374761393 + j * 668265263;
    n = (n ^ (n >> 13)) * 1274126177;
    n ^= n >> 16;
    return ((n >>> 0) / 4294967295) * 2 - 1;
  }

  smooth(t) {
    return t * t * (3 - 2 * t);
  }

  sample2D(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const x1 = x0 + 1;
    const z1 = z0 + 1;

    const tx = this.smooth(x - x0);
    const tz = this.smooth(z - z0);

    const h00 = this.hash(x0, z0);
    const h10 = this.hash(x1, z0);
    const h01 = this.hash(x0, z1);
    const h11 = this.hash(x1, z1);

    const a = h00 + (h10 - h00) * tx;
    const b = h01 + (h11 - h01) * tx;
    return a + (b - a) * tz;
  }

  fractal2D(x, z, octaves = 5, lacunarity = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;

    for (let i = 0; i < octaves; i += 1) {
      sum += this.sample2D(x * freq, z * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }

    return sum / norm;
  }
}
