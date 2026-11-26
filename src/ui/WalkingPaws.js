import React from 'react';

// Paw prints that appear one after another, left-right-left, as if a dog is
// walking up the screen. Pure CSS animation (see .fw-paw in index.css), so it
// keeps running while JavaScript is busy loading.
const STEPS = 6;

const Paw = ({ fill }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
    <g fill={fill}>
      <ellipse cx="6.6" cy="8.6" rx="2" ry="2.6" transform="rotate(-18 6.6 8.6)" />
      <ellipse cx="11" cy="5.4" rx="2" ry="2.7" transform="rotate(-6 11 5.4)" />
      <ellipse cx="15.8" cy="6" rx="2" ry="2.7" transform="rotate(10 15.8 6)" />
      <ellipse cx="19" cy="10.4" rx="1.8" ry="2.4" transform="rotate(24 19 10.4)" />
      <path d="M12.6 10.8c3.2.2 6 3.9 5.6 6.5-.3 1.9-2.1 2.6-3.7 2-1.2-.4-1.9-1-3-1.1-1.1 0-1.9.5-3.1.8-1.7.4-3.3-.5-3.3-2.4 0-2.7 3.4-6 7.5-5.8z" />
    </g>
  </svg>
);

export default function WalkingPaws({ color = '#FFFFFF' }) {
  return (
    <div style={{ position: 'relative', width: 120, height: 190 }} aria-hidden="true">
      {Array.from({ length: STEPS }).map((_, i) => {
        const left = i % 2 === 0;
        return (
          <span key={i} className="fw-paw"
            style={{
              position: 'absolute',
              bottom: i * 30,
              left: left ? 26 : 62,
              transform: `rotate(${left ? -14 : 14}deg)`,
              animationDelay: `${i * 0.28}s`,
            }}>
            <Paw fill={color} />
          </span>
        );
      })}
    </div>
  );
}
