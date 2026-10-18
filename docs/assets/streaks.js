/* Wunderdog light-streak background, the same drawing as the cover of the workshop slides.
   Usage: <canvas class="wd-streaks" data-o="0.78,0.42"></canvas>, then load this script.
   data-o is where the rays start, as a fraction of the 1600×900 drawing (x, y). The drawing covers the
   canvas like background-size: cover, and is drawn again when the window size changes. */
(function () {
  function rnd(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function draw(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw || !ch) return;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    const ctx = cv.getContext("2d"), W = 1600, H = 900;
    const [fx, fy] = (cv.dataset.o || "0.78,0.42").split(",").map(Number);
    const ox = fx * W, oy = fy * H;

    // Cover the canvas with the 1600×900 drawing.
    const k = Math.max(cw / W, ch / H) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    g.addColorStop(0, "#03060d"); g.addColorStop(0.55, "#081430"); g.addColorStop(1, "#0a2a5e");
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, (cv.width - W * k) / 2, (cv.height - H * k) / 2);

    ctx.globalCompositeOperation = "lighter";
    // Warm glow, top right.
    let r = ctx.createRadialGradient(W * 0.97, H * 0.02, 0, W * 0.97, H * 0.02, W * 0.62);
    r.addColorStop(0, "rgba(255,112,40,.8)"); r.addColorStop(0.4, "rgba(190,60,50,.28)"); r.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = r; ctx.fillRect(-W, -H, W * 3, H * 3);
    // Blue beam toward the lower left.
    ctx.save(); ctx.translate(ox, oy); ctx.rotate(Math.atan2(H + 260 - oy, -420 - ox));
    [[1700, 70, 0.85, "rgba(150,210,255,1)"], [1700, 190, 0.45, "rgba(60,130,255,1)"], [1700, 420, 0.28, "rgba(30,80,220,1)"]].forEach(([len, sp, a, c]) => {
      const lg = ctx.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, c); lg.addColorStop(0.3, "rgba(40,110,255,.55)"); lg.addColorStop(1, "rgba(10,30,90,0)");
      ctx.fillStyle = lg; ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(len, -sp); ctx.lineTo(len, sp * 0.55); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
    });
    ctx.restore();
    // Rays to the upper right.
    const N = 54;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1), a = -0.8 + f * 0.58;
      const hue = f < 0.35 ? [255, 120 + f * 200, 40] : f < 0.7 ? [255, 90 + (f - 0.35) * 120, 160 + (f - 0.35) * 200] : [200 - (f - 0.7) * 200, 170 + (f - 0.7) * 150, 255];
      const len = 900 + rnd(i) * 900, w = 1 + rnd(i + 9) * 7, al = 0.18 + rnd(i + 3) * 0.45;
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(a);
      const lg = ctx.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.06, `rgba(255,240,230,${al})`);
      lg.addColorStop(0.3, `rgba(${hue[0] | 0},${hue[1] | 0},${hue[2] | 0},${al * 0.9})`); lg.addColorStop(1, `rgba(${hue[0] | 0},${hue[1] | 0},${hue[2] | 0},0)`);
      ctx.strokeStyle = lg; ctx.lineWidth = w; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
      ctx.restore();
    }
    // Hot core.
    const c = ctx.createRadialGradient(ox, oy, 0, ox, oy, 170);
    c.addColorStop(0, "rgba(255,235,210,.95)"); c.addColorStop(0.2, "rgba(255,140,60,.5)"); c.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = c; ctx.fillRect(ox - 200, oy - 200, 400, 400);
    ctx.globalCompositeOperation = "source-over";
  }

  function drawAll() { document.querySelectorAll("canvas.wd-streaks").forEach(draw); }
  let t = 0;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(drawAll, 100); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", drawAll); else drawAll();
})();
