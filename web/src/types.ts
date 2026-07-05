export interface Point {
  x: number;
  y: number;
}

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type GamePhase = "PLAYING" | "GAME_OVER";

export interface SnakeState {
  snake: Point[];
  food: Point;
  dir: Direction;
  nextDir: Direction;
  phase: GamePhase;
  score: number;
  cols: number;
  rows: number;
}
