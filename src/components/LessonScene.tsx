import type { VisualStep } from '../../shared/lessons';

/** Symbolic teaching diagram: not a structural formula or molecular simulation. */
export function LessonScene({ scene, transfer }: { scene: VisualStep['scene']; transfer: number }) {
  const product = ['products', 'retention'].includes(scene);
  const fraction = scene === 'transfer' ? transfer / 100 : product ? 1 : 0;
  const px = 635 + (330 - 635) * fraction;
  const py = 155 + (210 - 155) * fraction;
  if (scene === 'balance')
    return (
      <svg
        viewBox="0 0 800 360"
        role="img"
        aria-label="Glycolysis per glucose: two ATP invested, four produced, net two ATP; two pyruvate and two NADH"
      >
        <text x="40" y="45" className="scene-heading">
          ATP balance · per glucose
        </text>
        <text x="40" y="107">
          Invested
        </text>
        <rect x="210" y="76" width="180" height="44" rx="12" className="scene-invest" />
        <text x="410" y="106">
          2 ATP
        </text>
        <text x="40" y="177">
          Produced
        </text>
        <rect x="210" y="146" width="360" height="44" rx="12" className="scene-payoff" />
        <text x="590" y="176">
          4 ATP
        </text>
        <text x="40" y="247">
          Net gain
        </text>
        <rect x="210" y="216" width="180" height="44" rx="12" className="scene-net" />
        <text x="410" y="246">
          2 ATP
        </text>
        <text x="400" y="324" textAnchor="middle" className="scene-note">
          Also formed: 2 pyruvate + 2 NADH
        </text>
      </svg>
    );
  return (
    <svg
      viewBox="0 0 800 360"
      role="img"
      aria-label={
        product
          ? 'Glucose-6-phosphate and ADP after phosphate transfer'
          : 'Glucose and ATP with a terminal phosphate moving toward carbon 6'
      }
    >
      {scene !== 'substrates' && (
        <g>
          <rect x="95" y="54" width="610" height="225" rx="100" className="scene-enzyme" />
          <text x="400" y="88" textAnchor="middle" className="scene-note">
            Hexokinase · Mg²⁺
          </text>
        </g>
      )}
      <path d="M182 143 L233 115 L284 143 L284 202 L233 231 L182 202 Z" className="scene-sugar" />
      <text x="233" y="180" textAnchor="middle" className="scene-heading">
        Glucose
      </text>
      <path d="M284 202 L330 210" className="scene-bond" />
      <text x="305" y="243" className="scene-note">
        C6–O
      </text>
      <g className="scene-adenosine">
        <rect x="446" y="133" width="100" height="44" rx="16" />
        <text x="496" y="161" textAnchor="middle">
          Adenosine
        </text>
      </g>
      <path d="M546 155 H600" className="scene-bond" />
      {fraction < 0.02 && <path d="M600 155 H635" className="scene-bond" />}
      {[565, 600].map((x) => (
        <g key={x} className="scene-phosphate">
          <circle cx={x} cy="155" r="17" />
          <text x={x} y="161" textAnchor="middle">
            P
          </text>
        </g>
      ))}
      <g className="scene-terminal" transform={`translate(${px} ${py})`}>
        <circle r="21" />
        <text y="6" textAnchor="middle">
          P
        </text>
      </g>
      <text x="570" y="214" textAnchor="middle" className="scene-heading">
        {fraction === 0 ? 'ATP' : fraction === 1 ? 'ADP' : 'Phosphoryl transfer'}
      </text>
      <text x="233" y="306" textAnchor="middle">
        {fraction === 1 ? 'Glucose-6-phosphate' : 'Six-carbon glucose'}
      </text>
      <text x="570" y="306" textAnchor="middle">
        {fraction === 1 ? 'Two phosphate groups remain' : 'Terminal phosphate highlighted'}
      </text>
      {scene === 'retention' && (
        <text x="400" y="344" textAnchor="middle" className="scene-note">
          Glycolysis · glycogen synthesis · pentose phosphate pathway
        </text>
      )}
    </svg>
  );
}
