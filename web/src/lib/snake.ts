import type { Direction, Point, SnakeState } from "../types";

export const COLS = 20;
export const ROWS = 20;

function randomFood(snake: Point[], cols: number, rows: number): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  let pos: Point;
  do {
    pos = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows),
    };
  } while (occupied.has(`${pos.x},${pos.y}`));
  return pos;
}

export function createInitialState(): SnakeState {
  const snake: Point[] = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  return {
    snake,
    food: randomFood(snake, COLS, ROWS),
    dir: "RIGHT",
    nextDir: "RIGHT",
    phase: "PLAYING",
    score: 0,
    cols: COLS,
    rows: ROWS,
  };
}

export function applyDirection(state: SnakeState): SnakeState {
  return { ...state, dir: state.nextDir };
}

export function queueDirection(state: SnakeState, dir: Direction): SnakeState {
  // Prevent reversing into self
  const { dir: cur } = state;
  if (
    (dir === "UP" && cur === "DOWN") ||
    (dir === "DOWN" && cur === "UP") ||
    (dir === "LEFT" && cur === "RIGHT") ||
    (dir === "RIGHT" && cur === "LEFT")
  ) {
    return state;
  }
  return { ...state, nextDir: dir };
}

export function stepSnake(state: SnakeState): SnakeState {
  if (state.phase === "GAME_OVER") return state;

  const { snake, food, dir, cols, rows, score } = state;
  const head = snake[0]!;

  const newHead: Point = { ...head };
  if (dir === "UP") newHead.y -= 1;
  else if (dir === "DOWN") newHead.y += 1;
  else if (dir === "LEFT") newHead.x -= 1;
  else newHead.x += 1;

  // Wall collision
  if (newHead.x < 0 || newHead.x >= cols || newHead.y < 0 || newHead.y >= rows) {
    return { ...state, phase: "GAME_OVER" };
  }

  // Self collision (skip tail since it will move away)
  const bodyToCheck = snake.slice(0, snake.length - 1);
  if (bodyToCheck.some((p) => p.x === newHead.x && p.y === newHead.y)) {
    return { ...state, phase: "GAME_OVER" };
  }

  const ateFood = newHead.x === food.x && newHead.y === food.y;
  const newSnake = ateFood ? [newHead, ...snake] : [newHead, ...snake.slice(0, -1)];
  const newScore = ateFood ? score + 10 : score;
  const newFood = ateFood ? randomFood(newSnake, cols, rows) : food;

  return {
    ...state,
    snake: newSnake,
    food: newFood,
    score: newScore,
  };
}
