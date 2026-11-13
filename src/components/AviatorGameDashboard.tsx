import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AviatorGameState, User } from '../types';
import { aviatorSound } from '../utils/aviatorSound';
import { auth } from '../firebase/config';
import { upsertOperationToFirestore } from '../firebase/firestoreService';
import {
  Volume2,
  VolumeX,
  Bell,
  Copy,
  Check,
  PlusCircle,
  Minus,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface AviatorGameDashboardProps {
  user: User;
  aviatorState: AviatorGameState | null;
  onUserUpdated: (updatedUser: User) => void;
  onGoToRecharge: () => void;
}

// Identical calm Spribe Aviator climb curve as server.ts
function computeCalmMultiplier(elapsedSec: number): number {
  if (elapsedSec <= 0) return 1.0;
  return 1 + elapsedSec * 0.115 + Math.pow(elapsedSec, 1.75) * 0.015;
}

export const AviatorGameDashboard: React.FC<AviatorGameDashboardProps> = ({
  user,
  aviatorState,
  onUserUpdated,
  onGoToRecharge,
}) => {
  const [localAviatorState, setLocalAviatorState] = useState<AviatorGameState | null>(aviatorState);
  const effectiveState = aviatorState || localAviatorState;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<AviatorGameState | null>(null);
  const lastServerSyncAtRef = useRef<number>(Date.now());
  const crashStartedAtRef = useRef<number | null>(null);
  const lastPlanePosRef = useRef<{ x: number; y: number } | null>(null);

  // Dedicated DOM refs updated exclusively by 60 FPS RAF during FLYING (prevents React re-render flicker)
  const multDisplayRef = useRef<HTMLSpanElement | null>(null);
  const winDisplayRef = useRef<HTMLSpanElement | null>(null);
  const betBtnWinRef = useRef<HTMLSpanElement | null>(null);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(aviatorSound.enabled);
  const [betMode, setBetMode] = useState<'pari' | 'auto'>('pari');
  const [stakeAmount, setStakeAmount] = useState<string>('500');
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState<boolean>(false);
  const [autoCashoutTarget, setAutoCashoutTarget] = useState<string>('2.00');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const isCashingOutRef = useRef(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const prevPhaseRef = useRef<string | null>(null);
  const prevCountdownRef = useRef<number | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const autoCashoutFiredRoundRef = useRef<number | null>(null);

  const userBalance = typeof user.balance === 'number' ? user.balance : 0;

  // Immediate state hydration fallback
  useEffect(() => {
    if (aviatorState) {
      setLocalAviatorState(aviatorState);
      return;
    }
    let cancelled = false;
    fetch(`/api/aviator/state?userId=${encodeURIComponent(user.id)}&phone=${encodeURIComponent(user.phone)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.state) {
          setLocalAviatorState(d.state);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [aviatorState, user.id, user.phone]);

  const handleCashout = useCallback(async () => {
    if (isCashingOutRef.current) return;
    aviatorSound.unlock();
    setActionFeedback(null);
    isCashingOutRef.current = true;
    setIsCashingOut(true);
    try {
      const res = await fetch('/api/aviator/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        aviatorSound.playCashoutWin();
        if (data.user) onUserUpdated(data.user);
        if (auth.currentUser) {
          const nowIso = new Date().toISOString();
          upsertOperationToFirestore(
            {
              id: `op_win_${Date.now()}`,
              userId: auth.currentUser.uid,
              firebaseUid: auth.currentUser.uid,
              userPhone: user.phone,
              type: 'WIN',
              amount: Number(data.winAmount) || 0,
              status: 'SUCCESS',
              title: `Gain Aviator ${Number(data.cashoutMultiplier).toFixed(2)}x`,
              description: `Cashout à ${Number(data.cashoutMultiplier).toFixed(2)}x`,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            { firebaseUid: auth.currentUser.uid }
          ).catch(() => {});
        }
        setActionFeedback({
          type: 'success',
          text: `Encaissé : +${Number(data.winAmount).toLocaleString('fr-FR')} FCFA à ${Number(data.cashoutMultiplier).toFixed(2)}x !`,
        });
      } else {
        setActionFeedback({ type: 'error', text: data.message || 'Encaissement indisponible.' });
      }
    } catch {
      setActionFeedback({ type: 'error', text: 'Veuillez réessayer.' });
    } finally {
      isCashingOutRef.current = false;
      setIsCashingOut(false);
    }
  }, [user.id, onUserUpdated]);

  // Sync incoming server ticks & trigger realistic engine / crash audio
  useEffect(() => {
    stateRef.current = effectiveState;
    lastServerSyncAtRef.current = Date.now();
    if (!effectiveState) return;

    const { phase, countdownSeconds, roundNumber, currentMultiplier, activeBet } = effectiveState;

    if (roundNumber !== prevRoundRef.current && phase === 'COUNTDOWN') {
      prevRoundRef.current = roundNumber;
      crashStartedAtRef.current = null;
      lastPlanePosRef.current = null;
      autoCashoutFiredRoundRef.current = null;
      aviatorSound.stopFlightHum();
      aviatorSound.playSignalAlert();
    }

    if (phase === 'COUNTDOWN' && countdownSeconds > 0 && countdownSeconds !== prevCountdownRef.current) {
      prevCountdownRef.current = countdownSeconds;
      aviatorSound.playCountdownTick(countdownSeconds);
    }

    if (prevPhaseRef.current !== phase) {
      if (phase === 'FLYING') {
        crashStartedAtRef.current = null;
        aviatorSound.playTakeoff();
      } else if (phase === 'CRASHED') {
        crashStartedAtRef.current = Date.now();
        if (prevPhaseRef.current === 'FLYING') {
          aviatorSound.playCrash();
        } else {
          aviatorSound.stopFlightHum();
        }
      } else if (phase === 'COUNTDOWN') {
        crashStartedAtRef.current = null;
        lastPlanePosRef.current = null;
        aviatorSound.stopFlightHum();
      }
      prevPhaseRef.current = phase;
    }

    if (phase === 'FLYING') {
      aviatorSound.updateFlightPitch(currentMultiplier);

      if (
        betMode === 'auto' &&
        autoCashoutEnabled &&
        activeBet &&
        !activeBet.cashedOut &&
        !isCashingOutRef.current &&
        autoCashoutFiredRoundRef.current !== roundNumber
      ) {
        const target = parseFloat(autoCashoutTarget);
        if (!isNaN(target) && target >= 1.1 && currentMultiplier >= target) {
          autoCashoutFiredRoundRef.current = roundNumber;
          void handleCashout();
        }
      }
    }
  }, [effectiveState, betMode, autoCashoutEnabled, autoCashoutTarget, handleCashout]);

  useEffect(() => {
    return () => {
      aviatorSound.stopFlightHum();
    };
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    aviatorSound.setEnabled(next);
    setSoundEnabled(next);
  };

  // Smooth, glitch-free 60 FPS Spribe Aviator Canvas Renderer
  useEffect(() => {
    let rafId = 0;

    const drawAuthenticSpribePlane = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      nowMs: number,
      scale = 1
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);

      // Warm subtle red-gold exhaust glow behind the tail
      const exhaust = ctx.createRadialGradient(-28, 3, 1, -28, 3, 16);
      exhaust.addColorStop(0, 'rgba(255, 210, 120, 0.85)');
      exhaust.addColorStop(0.45, 'rgba(229, 9, 42, 0.5)');
      exhaust.addColorStop(1, 'rgba(229, 9, 42, 0)');
      ctx.fillStyle = exhaust;
      ctx.beginPath();
      ctx.arc(-28, 3, 16, 0, Math.PI * 2);
      ctx.fill();

      // Tail fin
      ctx.fillStyle = '#C90622';
      ctx.beginPath();
      ctx.moveTo(-25, 1);
      ctx.lineTo(-33, -14);
      ctx.lineTo(-22, -14);
      ctx.lineTo(-15, -2);
      ctx.closePath();
      ctx.fill();

      // White tail X mark
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-26, -10);
      ctx.lineTo(-22, -5);
      ctx.moveTo(-22, -10);
      ctx.lineTo(-26, -5);
      ctx.stroke();

      // Landing gear struts + wheel
      ctx.strokeStyle = '#9E041B';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(4, 7);
      ctx.lineTo(10, 15);
      ctx.moveTo(14, 7);
      ctx.lineTo(10, 15);
      ctx.stroke();
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(10, 16, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#D4D4D8';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Main sculpted fuselage body
      ctx.fillStyle = '#E5092A';
      ctx.beginPath();
      ctx.moveTo(-28, 2);
      ctx.quadraticCurveTo(-14, -5, 1, -6);
      ctx.quadraticCurveTo(15, -7, 27, -2);
      ctx.quadraticCurveTo(32, 1, 31, 4);
      ctx.quadraticCurveTo(28, 8, 12, 8);
      ctx.quadraticCurveTo(-10, 8, -28, 4);
      ctx.closePath();
      ctx.fill();

      // Lower fuselage shadow shading
      ctx.fillStyle = '#9B041B';
      ctx.beginPath();
      ctx.moveTo(-26, 4);
      ctx.quadraticCurveTo(-6, 8, 16, 7);
      ctx.lineTo(27, 4);
      ctx.quadraticCurveTo(10, 5, -26, 3);
      ctx.closePath();
      ctx.fill();

      // Cockpit canopy glass
      ctx.fillStyle = '#111113';
      ctx.beginPath();
      ctx.moveTo(-1, -5.5);
      ctx.quadraticCurveTo(8, -13, 19, -4.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // White fuselage stripe
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, 2);
      ctx.quadraticCurveTo(4, 1, 22, 1.5);
      ctx.stroke();

      // Swept wing
      ctx.fillStyle = '#D40726';
      ctx.beginPath();
      ctx.moveTo(-3, 2);
      ctx.lineTo(13, 12);
      ctx.lineTo(6, 13);
      ctx.lineTo(-10, 3);
      ctx.closePath();
      ctx.fill();

      // Nose spinner cone
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(31.5, 1.5, 2.8, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Realistic spinning propeller motion blur
      const spinPhase = nowMs * 0.045;
      const blurH = 12 + Math.sin(spinPhase) * 3.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(33, 1.5, 1.8, blurH, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(280, rect.width);
          const height = Math.max(220, rect.height);

          const targetW = Math.floor(width * dpr);
          const targetH = Math.floor(height * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          const now = Date.now();
          const st = stateRef.current;
          const phase = st?.phase || 'COUNTDOWN';

          const dtSinceTick = Math.min(0.14, Math.max(0, (now - lastServerSyncAtRef.current) / 1000));
          const serverMult = st?.currentMultiplier ?? 1.0;
          const serverElapsed = st?.elapsedFlightSeconds ?? 0;

          const smoothElapsed = phase === 'FLYING' ? serverElapsed + dtSinceTick : serverElapsed;
          let smoothMult =
            phase === 'FLYING'
              ? Math.max(serverMult, computeCalmMultiplier(smoothElapsed))
              : serverMult;

          // Prevent visual overshoot past the crash point before CRASHED tick arrives
          if (phase === 'FLYING' && st?.nextCrashPoint) {
            smoothMult = Math.min(smoothMult, Math.max(1.0, st.nextCrashPoint - 0.01));
          }

          // Smooth 60 FPS text updates (owned solely by RAF during FLYING)
          if (phase === 'FLYING') {
            if (multDisplayRef.current) {
              multDisplayRef.current.textContent = `${smoothMult.toFixed(2)}x`;
            }
            if (st?.activeBet && !st.activeBet.cashedOut) {
              const liveWin = Math.floor(st.activeBet.amount * smoothMult).toLocaleString('fr-FR');
              if (winDisplayRef.current) {
                winDisplayRef.current.textContent = `+${liveWin} FCFA`;
              }
              if (betBtnWinRef.current) {
                betBtnWinRef.current.textContent = `${liveWin} FCFA`;
              }
            }
          }

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          // 1. Deep Spribe Canvas Background (#0E0E10)
          ctx.fillStyle = '#0E0E10';
          ctx.fillRect(0, 0, width, height);

          const padLeft = 48;
          const padBottom = 26;
          const padTop = 14;
          const padRight = 14;
          const originX = padLeft;
          const originY = height - padBottom;
          const plotW = width - padLeft - padRight;
          const plotH = height - padTop - padBottom;

          // 2. Slow-Rotating Sunburst Rays from Bottom-Left Origin
          ctx.save();
          ctx.beginPath();
          ctx.rect(padLeft, padTop, plotW, plotH);
          ctx.clip();

          const rayCount = 26;
          const rotSpeed = phase === 'FLYING' ? 0.00014 : 0.00005;
          const rotOffset = (now * rotSpeed) % (Math.PI * 2);
          const maxRadius = Math.hypot(width, height) * 1.3;
          for (let i = 0; i < rayCount; i++) {
            if (i % 2 === 0) {
              const a1 = rotOffset + (i * Math.PI * 2) / rayCount;
              const a2 = rotOffset + ((i + 1) * Math.PI * 2) / rayCount;
              ctx.beginPath();
              ctx.moveTo(originX, originY);
              ctx.arc(originX, originY, maxRadius, a1, a2);
              ctx.closePath();
              ctx.fillStyle = 'rgba(255, 255, 255, 0.028)';
              ctx.fill();
            }
          }

          const glow = ctx.createRadialGradient(
            originX + plotW * 0.45,
            originY - plotH * 0.48,
            10,
            originX + plotW * 0.45,
            originY - plotH * 0.48,
            plotW * 0.85
          );
          if (phase === 'CRASHED') {
            glow.addColorStop(0, 'rgba(229, 9, 42, 0.22)');
          } else if (smoothMult >= 10) {
            glow.addColorStop(0, 'rgba(192, 23, 180, 0.22)');
          } else if (smoothMult >= 2) {
            glow.addColorStop(0, 'rgba(145, 62, 248, 0.20)');
          } else {
            glow.addColorStop(0, 'rgba(52, 180, 255, 0.14)');
          }
          glow.addColorStop(1, 'rgba(14, 14, 16, 0)');
          ctx.fillStyle = glow;
          ctx.fillRect(padLeft, padTop, plotW, plotH);
          ctx.restore();

          // 3. Authentic Spribe Dotted Scales (L'échelle)
          const maxYScale = Math.max(2.0, smoothMult * 1.24);
          const maxTimeScale = Math.max(10, smoothElapsed * 1.15);

          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';

          const yTicks = 4;
          const yScrollOffset = phase === 'FLYING' ? (smoothElapsed * 0.22) % (1 / yTicks) : 0;
          for (let i = 0; i <= yTicks; i++) {
            const ratio = i / yTicks;
            const y = originY - ratio * plotH;
            const val = 1 + ratio * (maxYScale - 1);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(width - padRight, y);
            ctx.stroke();

            const dotY = originY - (((i / yTicks) - yScrollOffset + 1) % 1) * plotH;
            ctx.fillStyle = '#34B4FF';
            ctx.beginPath();
            ctx.arc(padLeft, i === 0 ? originY : dotY, 2.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.fillText(`${val.toFixed(1)}x`, padLeft - 7, y);
          }

          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const xTicks = 5;
          const xScrollOffset = phase === 'FLYING' ? (smoothElapsed * 0.16) % (1 / xTicks) : 0;
          for (let i = 0; i <= xTicks; i++) {
            const ratio = i / xTicks;
            const x = originX + ratio * plotW;
            const secVal = Math.round(ratio * maxTimeScale);

            const dotX = originX + (((i / xTicks) - xScrollOffset + 1) % 1) * plotW;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.beginPath();
            ctx.arc(i === 0 ? originX : dotX, originY, 1.9, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.fillText(`${secVal}s`, x, originY + 6);
          }

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(originX, padTop);
          ctx.lineTo(originX, originY);
          ctx.lineTo(width - padRight, originY);
          ctx.stroke();

          // 4. Smooth Takeoff & Flight Path Trajectory + Plane
          if (phase === 'FLYING') {
            const climbProgress = Math.min(1, smoothElapsed / 8.5);
            const easedX = 1 - Math.pow(1 - climbProgress, 1.55);
            const easedY = Math.pow(climbProgress, 1.25);

            const cruiseOscY =
              smoothElapsed > 5.5
                ? Math.sin((smoothElapsed - 5.5) * 1.45) * 10
                : 0;
            const cruiseOscX =
              smoothElapsed > 5.5
                ? Math.cos((smoothElapsed - 5.5) * 1.1) * 5
                : 0;

            const tipX = originX + easedX * 0.74 * plotW + cruiseOscX;
            const tipY = Math.max(
              padTop + 26,
              originY - easedY * 0.66 * plotH + cruiseOscY
            );

            lastPlanePosRef.current = { x: tipX, y: tipY };

            const ctrlX = originX + (tipX - originX) * 0.54;
            const ctrlY = originY - (originY - tipY) * 0.14;

            const fillGrad = ctx.createLinearGradient(0, tipY, 0, originY);
            fillGrad.addColorStop(0, 'rgba(229, 9, 42, 0.42)');
            fillGrad.addColorStop(1, 'rgba(229, 9, 42, 0.03)');

            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
            ctx.lineTo(tipX, originY);
            ctx.closePath();
            ctx.fillStyle = fillGrad;
            ctx.fill();

            ctx.save();
            ctx.shadowColor = 'rgba(229, 9, 42, 0.75)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(originX, originY);
            ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
            ctx.strokeStyle = '#E5092A';
            ctx.lineWidth = 3.6;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();

            const pitchAngle = -0.22 + (smoothElapsed > 5.5 ? Math.cos((smoothElapsed - 5.5) * 1.45) * 0.05 : 0);
            drawAuthenticSpribePlane(ctx, tipX, tipY - 3, pitchAngle, now, 1.05);
          } else if (phase === 'CRASHED') {
            if (!crashStartedAtRef.current) {
              crashStartedAtRef.current = now;
            }
            const crashElapsed = (now - crashStartedAtRef.current) / 1000;
            if (crashElapsed < 1.15) {
              const startX = lastPlanePosRef.current?.x ?? originX + plotW * 0.72;
              const startY = lastPlanePosRef.current?.y ?? originY - plotH * 0.64;
              const flyX = startX + crashElapsed * plotW * 0.9;
              const flyY = startY - crashElapsed * plotH * 0.9;
              drawAuthenticSpribePlane(
                ctx,
                flyX,
                flyY,
                -0.45,
                now,
                Math.max(0.5, 1.05 - crashElapsed * 0.45)
              );
            }
          }
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handlePlaceBet = async () => {
    aviatorSound.unlock();
    setActionFeedback(null);
    const amount = Math.floor(Number(stakeAmount));
    if (isNaN(amount) || amount < 100) {
      setActionFeedback({ type: 'error', text: 'Mise minimale : 100 FCFA.' });
      return;
    }
    if (amount > userBalance) {
      setActionFeedback({ type: 'error', text: 'Solde insuffisant. Veuillez recharger votre compte.' });
      return;
    }

    setIsPlacingBet(true);
    try {
      const res = await fetch('/api/aviator/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user) onUserUpdated(data.user);
        if (auth.currentUser) {
          const nowIso = new Date().toISOString();
          upsertOperationToFirestore(
            {
              id: `op_bet_${Date.now()}`,
              userId: auth.currentUser.uid,
              firebaseUid: auth.currentUser.uid,
              userPhone: user.phone,
              type: 'BET',
              amount,
              status: 'SUCCESS',
              title: 'Mise Aviator',
              description: `Mise engagée sur le vol (${amount.toLocaleString('fr-FR')} XOF)`,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            { firebaseUid: auth.currentUser.uid }
          ).catch(() => {});
        }
        setActionFeedback({
          type: 'success',
          text: `Mise de ${amount.toLocaleString('fr-FR')} FCFA validée pour le vol.`,
        });
      } else {
        setActionFeedback({ type: 'error', text: data.message || 'Impossible de placer la mise.' });
      }
    } catch {
      setActionFeedback({ type: 'error', text: 'Veuillez réessayer.' });
    } finally {
      setIsPlacingBet(false);
    }
  };

  const handleStepStake = (delta: number) => {
    const cur = Math.floor(Number(stakeAmount) || 0);
    const next = Math.max(100, cur + delta);
    setStakeAmount(String(next));
  };

  const handleCopyCode15 = () => {
    if (!effectiveState?.code15) return;
    navigator.clipboard.writeText(effectiveState.code15).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const phase = effectiveState?.phase || 'COUNTDOWN';
  const countdown = effectiveState?.countdownSeconds ?? 10;
  const currentMult = effectiveState?.currentMultiplier ?? 1.0;
  const nextCrashPoint = effectiveState?.nextCrashPoint ?? null;
  const code15 = effectiveState?.code15 || 'AV15...';
  const activeBet = effectiveState?.activeBet || null;
  const initialPotentialWin = activeBet ? Math.floor(activeBet.amount * currentMult) : 0;

  return (
    <div className="space-y-3" onClick={() => aviatorSound.unlock()}>
      {/* ===================================================================== */}
      {/* 1. COMPACT TOP BOT ALERT (10s BEFORE GAME STARTS - CODE 15 & COTE)    */}
      {/* ===================================================================== */}
      <div
        className={`rounded-2xl border px-3.5 py-2.5 shadow-sm transition-colors ${
          phase === 'COUNTDOWN'
            ? 'bg-[#2A1806] border-amber-400/70 text-white'
            : 'bg-[#1B1C1D] border-[#2C2D30] text-white'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                phase === 'COUNTDOWN'
                  ? 'bg-amber-400 text-slate-950'
                  : phase === 'FLYING'
                  ? 'bg-[#28A909] text-white'
                  : 'bg-[#E5092A] text-white'
              }`}
            >
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-200 truncate">
                {phase === 'COUNTDOWN'
                  ? `Alerte Bot · Départ dans ${countdown}s`
                  : phase === 'FLYING'
                  ? `Vol #${effectiveState?.roundNumber} en cours`
                  : `Vol #${effectiveState?.roundNumber} terminé`}
              </div>
              <div className="font-mono font-black text-xs text-amber-300 tracking-wide truncate tabular-nums">
                CODE 15 : {code15}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0 px-2.5 py-1 rounded-xl bg-black/50 border border-emerald-400/40">
            <div className="text-[9px] font-bold uppercase text-emerald-300 leading-tight">
              Cote Exacte
            </div>
            <div className="font-mono font-black text-base text-[#4ADE80] tabular-nums leading-tight">
              {nextCrashPoint !== null ? `${nextCrashPoint.toFixed(2)}x` : '--'}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. AUTHENTIC SPRIBE / 1xBET AVIATOR COCKPIT                           */}
      {/* ===================================================================== */}
      <div className="rounded-2xl overflow-hidden bg-[#0E0E10] border border-[#2C2D30] shadow-xl">
        <div className="px-3 py-2 bg-[#1B1C1D] border-b border-[#2C2D30] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-black italic tracking-tight text-lg text-[#E5092A]">
              Aviator
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              #{effectiveState?.roundNumber || '--'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-xs text-[#4ADE80] tabular-nums whitespace-nowrap">
              {userBalance.toLocaleString('fr-FR')} FCFA
            </span>
            <button
              type="button"
              onClick={handleToggleSound}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border whitespace-nowrap shrink-0 ${
                soundEnabled
                  ? 'bg-[#2C2D30] text-white border-[#3E4045]'
                  : 'bg-[#141517] text-slate-400 border-[#2C2D30]'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[#4ADE80]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{soundEnabled ? 'Son ON' : 'Muet'}</span>
            </button>
          </div>
        </div>

        {/* History Odds Strip */}
        <div className="px-2.5 py-1.5 bg-[#141517] border-b border-[#2C2D30] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(effectiveState?.history || []).slice(0, 14).map((item) => {
            const colorClass =
              item.crashPoint >= 10
                ? 'text-[#E852DF] bg-[#C017B4]/15 border-[#C017B4]/40'
                : item.crashPoint >= 2
                ? 'text-[#B27BFF] bg-[#913EF8]/15 border-[#913EF8]/40'
                : 'text-[#52C4FF] bg-[#34B4FF]/15 border-[#34B4FF]/40';
            return (
              <span
                key={`${item.roundNumber}-${item.timestamp}`}
                className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] tabular-nums shrink-0 border ${colorClass}`}
              >
                {item.crashPoint.toFixed(2)}x
              </span>
            );
          })}
          {(!effectiveState?.history || effectiveState.history.length === 0) && (
            <span className="text-[10px] font-mono text-slate-400">
              Historique des cotes en direct...
            </span>
          )}
        </div>

        {/* Live Aviator Flight Stage */}
        <div className="relative w-full h-[255px] bg-[#0E0E10]">
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Always-visible Cote Bot overlay inside game stage */}
          <div className="absolute top-2.5 left-12 z-10 pointer-events-none flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-lg bg-black/75 border border-emerald-400/50 backdrop-blur-xs flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-300">Cote Bot :</span>
              <span className="font-mono font-black text-xs text-[#4ADE80] tabular-nums">
                {nextCrashPoint !== null ? `${nextCrashPoint.toFixed(2)}x` : '--'}
              </span>
            </div>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
            {phase === 'COUNTDOWN' ? (
              <div className="space-y-2">
                <svg
                  className="w-12 h-12 mx-auto text-[#E5092A] animate-spin"
                  viewBox="0 0 64 64"
                  fill="none"
                >
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                  <path d="M32 6 C36 16, 36 24, 32 32 C28 24, 28 16, 32 6Z" fill="currentColor" />
                  <path d="M32 58 C28 48, 28 40, 32 32 C36 40, 36 48, 32 58Z" fill="currentColor" />
                  <path d="M6 32 C16 28, 24 28, 32 32 C24 36, 16 36, 6 32Z" fill="currentColor" />
                  <path d="M58 32 C48 36, 40 36, 32 32 C40 28, 48 28, 58 32Z" fill="currentColor" />
                  <circle cx="32" cy="32" r="4" fill="#FFFFFF" />
                </svg>

                <div className="text-[11px] font-bold uppercase tracking-widest text-white">
                  EN ATTENTE DU PROCHAIN TOUR
                </div>

                <div className="w-48 mx-auto h-1.5 bg-[#2C2D30] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E5092A]"
                    style={{ width: `${(countdown / 10) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-center gap-3 pt-0.5">
                  <span className="font-mono font-black text-base text-amber-300 tabular-nums">
                    {countdown}s
                  </span>
                  {nextCrashPoint !== null && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#28A909]/25 border border-[#4ADE80]/60 font-mono font-black text-xs text-[#4ADE80] tabular-nums">
                      Prochaine Cote : {nextCrashPoint.toFixed(2)}x
                    </span>
                  )}
                </div>
              </div>
            ) : phase === 'FLYING' ? (
              <div className="space-y-1.5">
                <div className="text-5xl font-mono font-black text-white tracking-tight tabular-nums drop-shadow-[0_3px_14px_rgba(0,0,0,0.95)]">
                  <span ref={multDisplayRef}>1.00x</span>
                </div>
                {activeBet && !activeBet.cashedOut && (
                  <div className="px-3 py-0.5 rounded-full bg-[#28A909]/30 border border-[#4ADE80] text-white font-mono font-bold text-xs tabular-nums inline-block">
                    <span ref={winDisplayRef}>+{initialPotentialWin.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                {activeBet && activeBet.cashedOut && (
                  <div className="px-3 py-0.5 rounded-full bg-[#28A909] text-white font-mono font-bold text-xs tabular-nums inline-block">
                    ENCAISSÉ +{activeBet.winAmount?.toLocaleString('fr-FR')} F @{' '}
                    {activeBet.cashoutMultiplier?.toFixed(2)}x
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-widest text-white">
                  L'AVION S'EST ENVOLÉ !
                </div>
                <div className="text-5xl font-mono font-black text-[#E5092A] tabular-nums drop-shadow-[0_3px_14px_rgba(0,0,0,0.95)]">
                  {currentMult.toFixed(2)}x
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. AUTHENTIC SPRIBE BETTING CONSOLE                                   */}
      {/* ===================================================================== */}
      <div className="bg-[#1B1C1D] text-white rounded-2xl border border-[#2C2D30] p-3 shadow-lg space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#2C2D30]">
          <div className="inline-flex bg-[#0E0E10] p-0.5 rounded-full border border-[#2C2D30]">
            <button
              type="button"
              onClick={() => setBetMode('pari')}
              className={`px-4 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                betMode === 'pari' ? 'bg-[#2C2D30] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pari
            </button>
            <button
              type="button"
              onClick={() => setBetMode('auto')}
              className={`px-4 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                betMode === 'auto' ? 'bg-[#2C2D30] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Auto
            </button>
          </div>

          <button
            type="button"
            onClick={onGoToRecharge}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#28A909] hover:bg-[#2EC20B] text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Recharger</span>
          </button>
        </div>

        {betMode === 'auto' && (
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[#141517] border border-[#2C2D30]">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCashoutEnabled}
                onChange={(e) => setAutoCashoutEnabled(e.target.checked)}
                className="accent-[#28A909] w-4 h-4"
              />
              <span>Auto-Encaissement</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="1.10"
                value={autoCashoutTarget}
                onChange={(e) => setAutoCashoutTarget(e.target.value)}
                className="w-20 px-2 py-1 rounded-lg bg-[#0E0E10] border border-[#2C2D30] text-right font-mono font-bold text-xs text-white focus:outline-none focus:border-[#28A909]"
              />
              <span className="text-xs font-mono font-bold text-slate-400">x</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-12 gap-2.5 items-stretch">
          <div className="col-span-6 space-y-1.5">
            <div className="flex items-center bg-[#0E0E10] border border-[#2C2D30] rounded-full px-1.5 py-1">
              <button
                type="button"
                disabled={Boolean(activeBet)}
                onClick={() => handleStepStake(-100)}
                className="w-7 h-7 rounded-full bg-[#2C2D30] hover:bg-[#3A3C42] text-white flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
                aria-label="Diminuer mise"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={100}
                step={100}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                disabled={Boolean(activeBet)}
                className="w-full bg-transparent text-center font-mono font-black text-sm text-white focus:outline-none disabled:opacity-60 min-w-0"
              />
              <button
                type="button"
                disabled={Boolean(activeBet)}
                onClick={() => handleStepStake(100)}
                className="w-7 h-7 rounded-full bg-[#2C2D30] hover:bg-[#3A3C42] text-white flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
                aria-label="Augmenter mise"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1">
              {[100, 500, 1000, 2000].map((val) => (
                <button
                  key={val}
                  type="button"
                  disabled={Boolean(activeBet)}
                  onClick={() => setStakeAmount(String(val))}
                  className={`py-1.5 rounded-full text-[11px] font-mono font-bold border cursor-pointer ${
                    Number(stakeAmount) === val
                      ? 'bg-[#2C2D30] text-white border-white/40'
                      : 'bg-[#141517] text-slate-300 border-[#2C2D30]'
                  } disabled:opacity-40`}
                >
                  {val.toLocaleString('fr-FR')}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-6 flex">
            {phase === 'FLYING' && activeBet && !activeBet.cashedOut ? (
              <button
                type="button"
                disabled={isCashingOut}
                onClick={() => void handleCashout()}
                className="w-full min-h-[76px] py-2 px-3 rounded-2xl bg-gradient-to-b from-[#E67E00] to-[#C86600] hover:brightness-110 active:scale-[0.98] text-white font-black shadow-lg border border-amber-400/60 flex flex-col items-center justify-center cursor-pointer disabled:opacity-60"
              >
                <span className="text-xs uppercase tracking-wider">ENCAISSER</span>
                <span ref={betBtnWinRef} className="font-mono text-base tabular-nums">
                  {initialPotentialWin.toLocaleString('fr-FR')} FCFA
                </span>
              </button>
            ) : phase === 'COUNTDOWN' && !activeBet ? (
              <button
                type="button"
                disabled={isPlacingBet}
                onClick={handlePlaceBet}
                className="w-full min-h-[76px] py-2 px-3 rounded-2xl bg-gradient-to-b from-[#2EC20B] to-[#239307] hover:brightness-110 active:scale-[0.98] text-white font-black shadow-lg border border-emerald-400/50 flex flex-col items-center justify-center cursor-pointer disabled:opacity-60"
              >
                <span className="text-xs uppercase tracking-wider">MISER</span>
                <span className="font-mono text-base tabular-nums">
                  {Number(stakeAmount || 0).toLocaleString('fr-FR')} FCFA
                </span>
              </button>
            ) : phase === 'COUNTDOWN' && activeBet ? (
              <div className="w-full min-h-[76px] py-2 px-3 rounded-2xl bg-[#2C2D30] border border-amber-500/50 text-amber-300 font-bold text-[11px] flex flex-col items-center justify-center text-center gap-1">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Mise {activeBet.amount.toLocaleString('fr-FR')} F validée · {countdown}s</span>
              </div>
            ) : activeBet && activeBet.cashedOut ? (
              <div className="w-full min-h-[76px] py-2 px-3 rounded-2xl bg-[#28A909]/25 border border-[#4ADE80] text-emerald-300 font-bold text-[11px] flex flex-col items-center justify-center text-center gap-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  +{activeBet.winAmount?.toLocaleString('fr-FR')} F @ {activeBet.cashoutMultiplier?.toFixed(2)}x
                </span>
              </div>
            ) : (
              <div className="w-full min-h-[76px] py-2 px-3 rounded-2xl bg-[#141517] border border-[#2C2D30] text-slate-400 font-bold text-[11px] flex flex-col items-center justify-center text-center gap-1">
                <Clock className="w-4 h-4 shrink-0" />
                <span>En vol · Prochain tour bientôt</span>
              </div>
            )}
          </div>
        </div>

        {actionFeedback && (
          <div
            className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
              actionFeedback.type === 'success'
                ? 'bg-[#28A909]/20 text-emerald-300 border border-[#28A909]/40'
                : 'bg-[#E5092A]/20 text-rose-300 border border-[#E5092A]/40'
            }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 4. CODE 15 & SIGNAL EXACT PANEL                                       */}
      {/* ===================================================================== */}
      <div className="bg-[#1B1C1D] text-white rounded-2xl p-3.5 border border-[#2C2D30] space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#2C2D30] pb-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-[#4ADE80] block">
              Bot Signal · {user.bookmaker} {user.bookmakerUserId ? `(#${user.bookmakerUserId})` : ''}
            </span>
            <h3 className="text-xs font-black">Code 15 & Prochaine Cote</h3>
          </div>
          <span className="px-2 py-0.5 rounded bg-[#28A909]/20 border border-[#28A909]/40 text-emerald-300 font-mono text-[10px] font-bold">
            {user.vipTier} ACTIF
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[#0E0E10] border border-[#2C2D30] space-y-1">
            <span className="text-[10px] font-mono text-slate-400 block">CODE 15</span>
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono font-black text-xs text-amber-300 truncate">{code15}</span>
              <button
                type="button"
                onClick={handleCopyCode15}
                className="p-1.5 rounded-lg bg-[#2C2D30] text-slate-200 shrink-0 cursor-pointer"
                title="Copier Code 15"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0E0E10] border border-[#2C2D30] space-y-1">
            <span className="text-[10px] font-mono text-slate-400 block">COTE EXACTE</span>
            <div className="font-mono font-black text-lg text-[#4ADE80] tabular-nums">
              {nextCrashPoint !== null ? `${nextCrashPoint.toFixed(2)}x` : '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
