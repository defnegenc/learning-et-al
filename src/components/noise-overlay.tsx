"use client";

import { useEffect, useRef } from "react";

export function NoiseOverlay() {
  const blob1 = useRef<HTMLDivElement>(null);
  const blob2 = useRef<HTMLDivElement>(null);
  const blob3 = useRef<HTMLDivElement>(null);
  const blob4 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;

      if (blob1.current) blob1.current.style.transform = `translate(${x * 0.5}px, ${y * 0.5}px)`;
      if (blob2.current) blob2.current.style.transform = `translate(${-x * 0.3}px, ${-y * 0.3}px)`;
      if (blob3.current) blob3.current.style.transform = `translate(${x * 0.4}px, ${-y * 0.4}px)`;
      if (blob4.current) blob4.current.style.transform = `translate(${-x * 0.2}px, ${y * 0.2}px)`;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <>
      {/* SVG noise texture overlay */}
      <div className="noise-overlay">
        <svg xmlns="http://www.w3.org/2000/svg">
          <filter id="noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.80"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      {/* Aura blobs */}
      <div ref={blob1} className="aura-blob aura-blob--green" />
      <div ref={blob2} className="aura-blob aura-blob--pink" />
      <div ref={blob3} className="aura-blob aura-blob--purple" />
      <div ref={blob4} className="aura-blob aura-blob--yellow" />
    </>
  );
}
