export = FFT;

declare class FFT {
  constructor(size: number);
  size: number;
  table: number[];
  fromComplexArray(complex: number[], storage?: number[]): number[];
  createComplexArray(): number[];
  toComplexArray(input: number[], storage?: number[]): number[];
  completeSpectrum(spectrum: number[]): void;
  transform(out: number[], data: number[]): void;
  realTransform(out: number[], data: number[]): void;
  inverseTransform(out: number[], data: number[]): void;
}
