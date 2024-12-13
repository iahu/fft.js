export default class FFT {
    size: number;
    table: number[];
    _csize: number;
    _width: number;
    _bitrev: number[];
    _out: number[];
    _data: number[];
    _inv: number;
    constructor(size: number);
    fromComplexArray(complex: number[]): number[];
    createComplexArray(): number[];
    toComplexArray(input: number[]): number[];
    completeSpectrum(spectrum: number[]): number[];
    transform(data: number[]): number[];
    realTransform(data: number[]): number[];
    inverseTransform(data: number[]): number[];
    _transform4(): void;
    _singleTransform2(outOff: number, off: number, step: number): void;
    _singleTransform4(outOff: number, off: number, step: number): void;
    _realTransform4(): void;
    _singleRealTransform2(outOff: number, off: number, step: number): void;
    _singleRealTransform4(outOff: number, off: number, step: number): void;
}
