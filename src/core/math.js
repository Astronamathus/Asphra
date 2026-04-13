export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const damp = (cur, tgt, lambda, dt) => cur + (tgt - cur) * (1 - Math.exp(-lambda * dt));
