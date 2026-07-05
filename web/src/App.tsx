import { GameShell, GameTopbar } from "@freegamestore/games";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHighScore } from "./hooks/useHighScore";
import { useGameLoop } from "./hooks/useGameLoop";
import { createInitialState, queueDirection, applyDirection, stepSnake } from "./lib/snake";
import type { SnakeState, Direction } from "./types";

const TICK_INTERVAL = 0.13; // seconds between snake steps

export default function App() {
  const [state, setState] = useState<SnakeState>(createInitialState);
  const [highScore, updateHighScore] = useHighScore("mcp-snake-test_highscore");

  // Accumulate time between ticks
  const accRef = useRef(0);
  // Track touch start for swipe detection
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Update high score whenever game ends
  useEffect(() => {
    if (state.phase === "GAME_OVER") {
      updateHighScore(state.score);
    }
  }, [state.phase, state.score, updateHighScore]);

  const restart = useCallback(() => {
    accRef.current = 0;
    setState(createInitialState());
  }, []);

  // Keyboard controls
  useEffect(() => {
    const dirMap: Record<string, Direction> = {
      ArrowUp: "UP",
      ArrowDown: "DOWN",
      ArrowLeft: "LEFT",
      ArrowRight: "RIGHT",
      w: "UP",
      s: "DOWN",
      a: "LEFT",
      d: "RIGHT",
    };

    function onKeyDown(e: KeyboardEvent) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      const dir = dirMap[e.key];
      if (dir) {
        setState((prev) => {
          if (prev.phase === "GAME_OVER") return prev;
          return queueDirection(prev, dir);
        });
      }
      if (e.key === "r" || e.key === "R") {
        restart();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [restart]);

  // Game loop
  useGameLoop((dt: number) => {
    if (state.phase === "GAME_OVER") return;
    accRef.current += dt;
    if (accRef.current >= TICK_INTERVAL) {
      accRef.current -= TICK_INTERVAL;
      setState((prev) => {
        if (prev.phase === "GAME_OVER") return prev;
        const withDir = applyDirection(prev);
        return stepSnake(withDir);
      });
    }
  });

  // Touch swipe controls
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return; // too small
    let dir: Direction;
    if (absDx > absDy) {
      dir = dx > 0 ? "RIGHT" : "LEFT";
    } else {
      dir = dy > 0 ? "DOWN" : "UP";
    }
    setState((prev) => {
      if (prev.phase === "GAME_OVER") return prev;
      return queueDirection(prev, dir);
    });
    touchStartRef.current = null;
  }

  return (
    <GameShell topbar={<GameTopbar title="Snake" score={state.score} highScore={highScore} />}>
      <div
        className="flex flex-col items-center justify-center h-full w-full select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <GameBoard state={state} />

        {state.phase === "GAME_OVER" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
            <div
              className="rounded-2xl px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto"
              style={{
                background: "var(--surface)",
                border: "2px solid var(--border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              }}
            >
              <h2
                className="text-3xl font-bold"
                style={{ fontFamily: "Fraunces, serif", color: "var(--ink)" }}
              >
                Game Over
              </h2>
              <p style={{ color: "var(--muted)" }} className="text-lg">
                Score: <strong style={{ color: "var(--ink)" }}>{state.score}</strong>
              </p>
              {highScore > 0 && (
                <p style={{ color: "var(--muted)" }} className="text-sm">
                  Best: <strong style={{ color: "var(--accent)" }}>{highScore}</strong>
                </p>
              )}
              <button
                onClick={restart}
                className="mt-2 px-6 py-3 rounded-xl text-base font-semibold transition-opacity hover:opacity-80 active:opacity-60"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  minWidth: 120,
                  minHeight: 44,
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Touch hint on mobile */}
        <p
          className="mt-3 text-xs pointer-events-none"
          style={{ color: "var(--muted)" }}
        >
          Arrow keys / WASD &nbsp;·&nbsp; Swipe on mobile &nbsp;·&nbsp; R to restart
        </p>
      </div>
    </GameShell>
  );
}

// ─── Board renderer ───────────────────────────────────────────────────────────

function GameBoard({ state }: { state: SnakeState }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Resize canvas to fill container while keeping square cells
  useEffect(() => {
    function resize() {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const size = Math.min(container.clientWidth, container.clientHeight);
      canvas.width = size;
      canvas.height = size;
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Draw every frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const { snake, food, cols, rows } = state;
    const cellW = size / cols;
    const cellH = size / rows;

    // Background
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--paper")
      .trim() || "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Grid lines (subtle)
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--border")
      .trim() || "#e5e7eb";
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, size);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(size, r * cellH);
      ctx.stroke();
    }

    // Food — pulsing red circle
    const pad = cellW * 0.15;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(
      food.x * cellW + cellW / 2,
      food.y * cellH + cellH / 2,
      cellW / 2 - pad,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Snake body
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6366f1";

    snake.forEach((seg, i) => {
      const isHead = i === 0;
      const t = 1 - i / snake.length; // 1 at head → 0 at tail
      ctx.globalAlpha = 0.55 + 0.45 * t;
      ctx.fillStyle = isHead ? accent : accent;
      const segPad = isHead ? 1 : 2;
      const r = cellW * 0.18;
      const x = seg.x * cellW + segPad;
      const y = seg.y * cellH + segPad;
      const w = cellW - segPad * 2;
      const h = cellH - segPad * 2;
      // Rounded rect
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Eyes on head
    if (snake.length > 0) {
      const head = snake[0]!;
      const { dir } = state;
      ctx.fillStyle = "#fff";
      const eyeR = cellW * 0.1;
      const ex1 = head.x * cellW + cellW / 2;
      const ey1 = head.y * cellH + cellH / 2;
      let offA = { x: 0, y: 0 };
      let offB = { x: 0, y: 0 };
      const spread = cellW * 0.2;
      const forward = cellW * 0.1;
      if (dir === "RIGHT") { offA = { x: forward, y: -spread }; offB = { x: forward, y: spread }; }
      else if (dir === "LEFT") { offA = { x: -forward, y: -spread }; offB = { x: -forward, y: spread }; }
      else if (dir === "UP") { offA = { x: -spread, y: -forward }; offB = { x: spread, y: -forward }; }
      else { offA = { x: -spread, y: forward }; offB = { x: spread, y: forward }; }
      ctx.beginPath();
      ctx.arc(ex1 + offA.x, ey1 + offA.y, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex1 + offB.x, ey1 + offB.y, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full flex items-center justify-center"
      style={{ maxWidth: "min(90vw, calc(100vh - 120px))", maxHeight: "min(90vw, calc(100vh - 120px))" }}
    >
      <canvas
        ref={canvasRef}
        className="rounded-xl"
        style={{
          border: "2px solid var(--border)",
          display: "block",
          touchAction: "none",
        }}
      />
    </div>
  );
}
