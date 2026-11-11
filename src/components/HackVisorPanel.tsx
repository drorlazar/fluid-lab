import React from 'react';
import { Language, MathHack } from '../math/mathEngine';

interface HackVisorPanelProps {
  hack: MathHack;
  lang: Language;
  a: number;
  b: number;
  answer: number;
}

export const HackVisorPanel: React.FC<HackVisorPanelProps> = ({
  hack,
  lang,
  a,
  b,
  answer,
}) => {
  const isHe = lang === 'he';

  return (
    <div className="hack-visor-card" role="region" aria-label="Smart Hack Visor">
      <div className="hack-visor-header">
        <span className="hack-badge-pill">⚡ HACK OS</span>
        <h3 className="hack-visor-title">{isHe ? hack.titleHe : hack.titleEn}</h3>
        <span className="hack-transformed-eq" dir="ltr">
          {hack.transformedEquation}
        </span>
      </div>

      <p className="hack-banner-text">
        {isHe ? hack.shortBannerHe : hack.shortBannerEn}
      </p>

      {/* VISUAL MANIPULATIVE DIAGRAM */}
      <div className="hack-visual-stage">
        {hack.visualType === 'finger9' && (
          <div className="finger9-stage">
            <div className="finger9-hands" dir="ltr">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((fingerNum) => {
                const folded = fingerNum === hack.visualData.fingerFolded;
                const isLeft = fingerNum < (hack.visualData.fingerFolded || 1);
                return (
                  <div
                    key={fingerNum}
                    className={`cyber-finger ${
                      folded ? 'folded' : isLeft ? 'left-ten' : 'right-one'
                    }`}
                  >
                    <span className="finger-num">{fingerNum}</span>
                    <div className="finger-bar" />
                    <span className="finger-role">
                      {folded ? '✖' : isLeft ? '+10' : '+1'}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="finger9-summary" dir="ltr">
              <span className="pill-gold">{hack.visualData.tensA} (Tens)</span>
              <span>+</span>
              <span className="pill-cyan">{hack.visualData.onesA} (Ones)</span>
              <span>=</span>
              <span className="pill-green">{answer}</span>
            </div>
          </div>
        )}

        {(hack.visualType === 'bridgeJump' || hack.visualType === 'equalShift') && (
          <div className="bridge-stage" dir="ltr">
            {hack.visualType === 'equalShift' ? (
              <div className="equal-shift-diagram">
                <div className="shift-box">
                  <span className="old-val">{a}</span>
                  <span className="shift-arrow">+{hack.visualData.shiftAmount} ➔</span>
                  <span className="new-val gold">{hack.visualData.tensA}</span>
                </div>
                <span className="op-sym">−</span>
                <div className="shift-box">
                  <span className="old-val">{b}</span>
                  <span className="shift-arrow">+{hack.visualData.shiftAmount} ➔</span>
                  <span className="new-val cyan">{hack.visualData.tensB}</span>
                </div>
                <span className="op-sym">=</span>
                <span className="new-val green">{answer}</span>
              </div>
            ) : (
              <div className="number-bridge-line">
                <div className="bridge-node start">
                  <span className="node-val">{b}</span>
                </div>
                <div className="bridge-arc cyan">
                  <span className="arc-label">+{hack.visualData.jump1}</span>
                </div>
                <div className="bridge-node mid">
                  <span className="node-val">{hack.visualData.bridgeStop}</span>
                </div>
                <div className="bridge-arc gold">
                  <span className="arc-label">+{hack.visualData.jump2}</span>
                </div>
                <div className="bridge-node end">
                  <span className="node-val">{a}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {(hack.visualType === 'arraySplit' ||
          hack.visualType === 'doubleChain' ||
          hack.visualType === 'halfTen') && (
          <div className="array-split-stage" dir="ltr">
            {(() => {
              const rA = Math.min(hack.visualData.splitRowA || 2, 5);
              const rB = Math.min(hack.visualData.splitRowB || 2, 5);
              const cols = Math.min(hack.visualData.cols || b, 10);
              return (
                <div className="mini-drone-grid">
                  {Array.from({ length: rA }).map((_, rIdx) => (
                    <div key={`ra-${rIdx}`} className="drone-row row-gold">
                      {Array.from({ length: cols }).map((__, cIdx) => (
                        <span key={cIdx} className="drone-cell gold" />
                      ))}
                      {rIdx === 0 && (
                        <span className="row-sum-tag">
                          {hack.visualData.splitRowA} × {hack.visualData.cols} ={' '}
                          {(hack.visualData.splitRowA || 0) * (hack.visualData.cols || 0)}
                        </span>
                      )}
                    </div>
                  ))}
                  {rB > 0 &&
                    Array.from({ length: rB }).map((_, rIdx) => (
                      <div key={`rb-${rIdx}`} className="drone-row row-cyan">
                        {Array.from({ length: cols }).map((__, cIdx) => (
                          <span key={cIdx} className="drone-cell cyan" />
                        ))}
                        {rIdx === 0 && (
                          <span className="row-sum-tag cyan">
                            {hack.visualData.splitRowB} × {hack.visualData.cols} ={' '}
                            {(hack.visualData.splitRowB || 0) * (hack.visualData.cols || 0)}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              );
            })()}
          </div>
        )}

        {(hack.visualType === 'splitTensOnes' ||
          hack.visualType === 'friendlyTen' ||
          hack.visualType === 'make10') && (
          <div className="tens-ones-bars" dir="ltr">
            <div className="bar-group gold">
              <span className="bar-title">10s Core</span>
              <span className="bar-num">{(Math.floor(a / 10) + Math.floor(b / 10)) * 10}</span>
            </div>
            <span className="op-sym">+</span>
            <div className="bar-group cyan">
              <span className="bar-title">1s Sparks</span>
              <span className="bar-num">{(a % 10) + (b % 10)}</span>
            </div>
            <span className="op-sym">=</span>
            <div className="bar-group green">
              <span className="bar-title">Total</span>
              <span className="bar-num">{answer}</span>
            </div>
          </div>
        )}
      </div>

      {/* STEP-BY-STEP CARDS */}
      <div className="hack-steps-grid">
        {hack.steps.map((step, index) => (
          <div key={index} className={`hack-step-card border-${step.highlightColor}`}>
            <div className="hack-step-top">
              <span className={`hack-step-badge bg-${step.highlightColor}`}>{step.badge}</span>
              <span className="hack-step-formula" dir="ltr">
                {step.formula}
              </span>
            </div>
            <p className="hack-step-exp">
              {isHe ? step.explanationHe : step.explanationEn}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
