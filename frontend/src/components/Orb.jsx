import { useEffect, useRef } from 'react';

// Renders a rotating, wavy particle-sphere ("orb") on a canvas.
export default function Orb({ status }) {
  const canvasRef = useRef(null);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const size = 210; // bigger, bolder orb
    canvas.width = size;
    canvas.height = size;

    const numParticles = 1400;
    const sphereRadius = 76;

    const particles = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < numParticles; i++) {
      const y = 1 - (i / (numParticles - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      particles.push({
        x: Math.cos(theta) * radiusAtY,
        y,
        z: Math.sin(theta) * radiusAtY,
        phase: Math.random() * Math.PI * 2,
        colorNoise: Math.random(),
      });
    }

    const CORE_POINTS = 200;
    const core = [];
    for (let i = 0; i < CORE_POINTS; i++) {
      const t = (i / CORE_POINTS) * Math.PI * 2;
      const strand = i % 2;
      core.push({ t, strand });
    }

    const rimStops = [
      { r: 255, g: 70, b: 130 },
      { r: 230, g: 60, b: 190 },
      { r: 110, g: 70, b: 230 },
      { r: 60, g: 40, b: 150 },
    ];

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function colorForAngle(angle, opacity, noise) {
      let t = (angle / (Math.PI * 2) + (noise - 0.5) * 0.06 + 1) % 1;
      const scaled = t * rimStops.length;
      const idx = Math.floor(scaled) % rimStops.length;
      const nextIdx = (idx + 1) % rimStops.length;
      const localT = scaled - Math.floor(scaled);

      const c1 = rimStops[idx];
      const c2 = rimStops[nextIdx];
      const r = Math.round(lerp(c1.r, c2.r, localT));
      const g = Math.round(lerp(c1.g, c2.g, localT));
      const b = Math.round(lerp(c1.b, c2.b, localT));

      return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
    }

    let rotation = 0;
    let coreRotation = 0;
    let time = 0;
    let frameId;

    function draw() {
      time += 0.016;

      const currentStatus = statusRef.current;

      let rotationSpeed = 0.003;
      let waveAmplitude = 0.08;
      let waveSpeed = 1.5;

      if (currentStatus === 'speaking') {
        rotationSpeed = 0.012;
        waveAmplitude = 0.22;
        waveSpeed = 3.2;
      } else if (currentStatus === 'listening') {
        rotationSpeed = 0.01;
        waveAmplitude = 0.16;
        waveSpeed = 2.6;
      } else if (currentStatus === 'thinking' || currentStatus === 'replying') {
        rotationSpeed = 0.025;
        waveAmplitude = 0.1;
        waveSpeed = 2.2;
      }

      rotation += rotationSpeed;
      coreRotation += rotationSpeed * 1.6;

      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const cosRotation = Math.cos(rotation);
      const sinRotation = Math.sin(rotation);

      const halo = ctx.createRadialGradient(centerX, centerY, sphereRadius * 0.3, centerX, centerY, sphereRadius * 1.15);
      halo.addColorStop(0, 'rgba(180, 60, 170, 0.10)');
      halo.addColorStop(1, 'rgba(180, 60, 170, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      const projectedParticles = particles.map((p) => {
        const wave = 1 + waveAmplitude * Math.sin(time * waveSpeed + p.phase + p.y * 4);

        const rotatedX = (p.x * cosRotation - p.z * sinRotation) * wave;
        const rotatedZ = (p.x * sinRotation + p.z * cosRotation) * wave;
        const rotatedY = p.y * wave;

        const perspective = size / (size + rotatedZ * sphereRadius);

        const screenX = centerX + rotatedX * sphereRadius * perspective;
        const screenY = centerY + rotatedY * sphereRadius * perspective;

        return {
          screenX,
          screenY,
          z: rotatedZ,
          colorNoise: p.colorNoise,
          dotSize: Math.max(0.9, perspective * 1.9),
        };
      });

      projectedParticles.sort((a, b) => a.z - b.z);

      for (const p of projectedParticles) {
        const dx = p.screenX - centerX;
        const dy = p.screenY - centerY;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) + Math.PI;

        const edgeFactor = Math.min(1, dist / sphereRadius);
        const depthOpacity = 0.35 + (p.z + 1) * 0.25;
        const opacity = depthOpacity * (0.06 + 0.94 * Math.pow(edgeFactor, 1.6));

        if (opacity < 0.03) continue;

        ctx.fillStyle = colorForAngle(angle, opacity, p.colorNoise);
        ctx.beginPath();
        ctx.arc(p.screenX, p.screenY, p.dotSize, 0, Math.PI * 2);
        ctx.fill();
      }

      const coreRadius = 46;
      const cosCore = Math.cos(coreRotation);
      const sinCore = Math.sin(coreRotation);

      ctx.save();
      ctx.shadowBlur = 14;
      ctx.shadowColor = 'rgba(255, 140, 210, 0.95)';

      for (const c of core) {
        const petal = 0.45 + 0.55 * Math.abs(Math.sin(3 * c.t + c.strand * Math.PI));
        const wobble = 0.15 * Math.sin(time * 2.4 + c.t * 5 + c.strand * 2);
        const r = coreRadius * (petal + wobble * 0.2);

        const localX = Math.cos(c.t + c.strand * 0.6) * r;
        const localZ = Math.sin(c.t + c.strand * 0.6) * r * 0.6;
        const localY = Math.sin(c.t * 2 + coreRotation) * coreRadius * 0.25;

        const rotatedX = localX * cosCore - localZ * sinCore;
        const rotatedZ = localX * sinCore + localZ * cosCore;

        const perspective = size / (size + rotatedZ * 1.4);
        const screenX = centerX + rotatedX * perspective;
        const screenY = centerY + localY * perspective;

        const brightness = 1 - petal * 0.5;
        const rC = Math.round(lerp(255, 255, brightness));
        const gC = Math.round(lerp(120, 220, brightness));
        const bC = Math.round(lerp(180, 235, brightness));

        ctx.fillStyle = `rgba(${rC}, ${gC}, ${bC}, 0.95)`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      frameId = requestAnimationFrame(draw);
    }

    draw();

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className={`orb-wrap ${status || 'idle'}`}>
      <canvas ref={canvasRef} className="orb-canvas" />
    </div>
  );
}