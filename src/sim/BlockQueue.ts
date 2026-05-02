import type { Mulberry32 } from './BreachBoard';

export class BlockQueue {
  readonly colors: Int32Array;
  private colorCount: number;
  private rng: Mulberry32;

  constructor(length: number, colorCount: number, rng: Mulberry32) {
    this.colors = new Int32Array(Math.max(1, length));
    this.colorCount = colorCount;
    this.rng = rng;
    this.rerollAll();
  }

  setRng(rng: Mulberry32): void {
    this.rng = rng;
    this.rerollAll();
  }

  peek(offset = 0): number {
    return this.colors[Math.max(0, Math.min(this.colors.length - 1, offset | 0))];
  }

  setNext(color: number): void {
    this.colors[0] = color;
  }

  consume(): number {
    const color = this.colors[0];
    for (let i = 1; i < this.colors.length; i++) this.colors[i - 1] = this.colors[i];
    this.colors[this.colors.length - 1] = this.randomColor();
    return color;
  }

  rerollNext(): void {
    this.colors[0] = this.randomColor();
  }

  rerollAll(): void {
    for (let i = 0; i < this.colors.length; i++) this.colors[i] = this.randomColor();
  }

  toArray(): number[] {
    return Array.from(this.colors);
  }

  private randomColor(): number {
    return 1 + Math.floor(this.rng.next() * this.colorCount);
  }
}
