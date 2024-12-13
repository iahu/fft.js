var FFT = /** @class */ (function () {
    function FFT(size) {
        this.size = size | 0;
        if (this.size <= 1 || (this.size & (this.size - 1)) !== 0)
            throw new Error('FFT size must be a power of two and bigger than 1');
        this._csize = size << 1;
        // NOTE: Use of `var` is intentional for old V8 versions
        var table = new Array(this.size * 2);
        for (var i = 0; i < table.length; i += 2) {
            var angle = (Math.PI * i) / this.size;
            table[i] = Math.cos(angle);
            table[i + 1] = -Math.sin(angle);
        }
        this.table = table;
        // Find size's power of two
        var power = 0;
        for (var t = 1; this.size > t; t <<= 1)
            power++;
        // Calculate initial step's width:
        //   * If we are full radix-4 - it is 2x smaller to give inital len=8
        //   * Otherwise it is the same as `power` to give len=4
        this._width = power % 2 === 0 ? power - 1 : power;
        // Pre-compute bit-reversal patterns
        this._bitrev = new Array(1 << this._width);
        for (var j = 0; j < this._bitrev.length; j++) {
            this._bitrev[j] = 0;
            for (var shift = 0; shift < this._width; shift += 2) {
                var revShift = this._width - shift - 2;
                this._bitrev[j] |= ((j >>> shift) & 3) << revShift;
            }
        }
        this._out = [];
        this._data = [];
        this._inv = 0;
    }
    FFT.prototype.fromComplexArray = function (complex) {
        var res = new Array(complex.length >>> 1);
        for (var i = 0; i < complex.length; i += 2)
            res[i >>> 1] = complex[i];
        return res;
    };
    FFT.prototype.createComplexArray = function () {
        var res = new Array(this._csize);
        for (var i = 0; i < res.length; i++)
            res[i] = 0;
        return res;
    };
    FFT.prototype.toComplexArray = function (input) {
        var res = this.createComplexArray();
        for (var i = 0; i < res.length; i += 2) {
            res[i] = input[i >>> 1];
            res[i + 1] = 0;
        }
        return res;
    };
    FFT.prototype.completeSpectrum = function (spectrum) {
        var size = this._csize;
        var half = size >>> 1;
        for (var i = 2; i < half; i += 2) {
            spectrum[size - i] = spectrum[i];
            spectrum[size - i + 1] = -spectrum[i + 1];
        }
        return spectrum;
    };
    FFT.prototype.transform = function (data) {
        var out = this.createComplexArray();
        this._out = out;
        this._data = data;
        this._inv = 0;
        this._transform4();
        this._out = [];
        this._data = [];
        return out;
    };
    FFT.prototype.realTransform = function (data) {
        var out = this.createComplexArray();
        this._out = out;
        this._data = data;
        this._inv = 0;
        this._realTransform4();
        this._out = [];
        this._data = [];
        return out;
    };
    FFT.prototype.inverseTransform = function (data) {
        var out = this.createComplexArray();
        this._out = out;
        this._data = data;
        this._inv = 1;
        this._transform4();
        for (var i = 0; i < out.length; i++)
            out[i] /= this.size;
        this._out = [];
        this._data = [];
        return out;
    };
    // radix-4 implementation
    //
    // NOTE: Uses of `var` are intentional for older V8 version that do not
    // support both `let compound assignments` and `const phi`
    FFT.prototype._transform4 = function () {
        var out = this._out;
        var size = this._csize;
        // Initial step (permute and transform)
        var width = this._width;
        var step = 1 << width;
        var len = (size / step) << 1;
        var outOff;
        var t;
        var bitrev = this._bitrev;
        if (len === 4) {
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                var off = bitrev[t];
                this._singleTransform2(outOff, off, step);
            }
        }
        else {
            // len === 8
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                var off = bitrev[t];
                this._singleTransform4(outOff, off, step);
            }
        }
        // Loop through steps in decreasing order
        var inv = this._inv ? -1 : 1;
        var table = this.table;
        for (step >>= 2; step >= 2; step >>= 2) {
            len = (size / step) << 1;
            var quarterLen = len >>> 2;
            // Loop through offsets in the data
            for (outOff = 0; outOff < size; outOff += len) {
                // Full case
                var limit = outOff + quarterLen;
                for (var i = outOff, k = 0; i < limit; i += 2, k += step) {
                    var A = i;
                    var B = A + quarterLen;
                    var C = B + quarterLen;
                    var D = C + quarterLen;
                    // Original values
                    var Ar = out[A];
                    var Ai = out[A + 1];
                    var Br = out[B];
                    var Bi = out[B + 1];
                    var Cr = out[C];
                    var Ci = out[C + 1];
                    var Dr = out[D];
                    var Di = out[D + 1];
                    // Middle values
                    var MAr = Ar;
                    var MAi = Ai;
                    var tableBr = table[k];
                    var tableBi = inv * table[k + 1];
                    var MBr = Br * tableBr - Bi * tableBi;
                    var MBi = Br * tableBi + Bi * tableBr;
                    var tableCr = table[2 * k];
                    var tableCi = inv * table[2 * k + 1];
                    var MCr = Cr * tableCr - Ci * tableCi;
                    var MCi = Cr * tableCi + Ci * tableCr;
                    var tableDr = table[3 * k];
                    var tableDi = inv * table[3 * k + 1];
                    var MDr = Dr * tableDr - Di * tableDi;
                    var MDi = Dr * tableDi + Di * tableDr;
                    // Pre-Final values
                    var T0r = MAr + MCr;
                    var T0i = MAi + MCi;
                    var T1r = MAr - MCr;
                    var T1i = MAi - MCi;
                    var T2r = MBr + MDr;
                    var T2i = MBi + MDi;
                    var T3r = inv * (MBr - MDr);
                    var T3i = inv * (MBi - MDi);
                    // Final values
                    var FAr = T0r + T2r;
                    var FAi = T0i + T2i;
                    var FCr = T0r - T2r;
                    var FCi = T0i - T2i;
                    var FBr = T1r + T3i;
                    var FBi = T1i - T3r;
                    var FDr = T1r - T3i;
                    var FDi = T1i + T3r;
                    out[A] = FAr;
                    out[A + 1] = FAi;
                    out[B] = FBr;
                    out[B + 1] = FBi;
                    out[C] = FCr;
                    out[C + 1] = FCi;
                    out[D] = FDr;
                    out[D + 1] = FDi;
                }
            }
        }
    };
    // radix-2 implementation
    //
    // NOTE: Only called for len=4
    FFT.prototype._singleTransform2 = function (outOff, off, step) {
        var out = this._out;
        var data = this._data;
        var evenR = data[off];
        var evenI = data[off + 1];
        var oddR = data[off + step];
        var oddI = data[off + step + 1];
        var leftR = evenR + oddR;
        var leftI = evenI + oddI;
        var rightR = evenR - oddR;
        var rightI = evenI - oddI;
        out[outOff] = leftR;
        out[outOff + 1] = leftI;
        out[outOff + 2] = rightR;
        out[outOff + 3] = rightI;
    };
    // radix-4
    //
    // NOTE: Only called for len=8
    FFT.prototype._singleTransform4 = function (outOff, off, step) {
        var out = this._out;
        var data = this._data;
        var inv = this._inv ? -1 : 1;
        var step2 = step * 2;
        var step3 = step * 3;
        // Original values
        var Ar = data[off];
        var Ai = data[off + 1];
        var Br = data[off + step];
        var Bi = data[off + step + 1];
        var Cr = data[off + step2];
        var Ci = data[off + step2 + 1];
        var Dr = data[off + step3];
        var Di = data[off + step3 + 1];
        // Pre-Final values
        var T0r = Ar + Cr;
        var T0i = Ai + Ci;
        var T1r = Ar - Cr;
        var T1i = Ai - Ci;
        var T2r = Br + Dr;
        var T2i = Bi + Di;
        var T3r = inv * (Br - Dr);
        var T3i = inv * (Bi - Di);
        // Final values
        var FAr = T0r + T2r;
        var FAi = T0i + T2i;
        var FBr = T1r + T3i;
        var FBi = T1i - T3r;
        var FCr = T0r - T2r;
        var FCi = T0i - T2i;
        var FDr = T1r - T3i;
        var FDi = T1i + T3r;
        out[outOff] = FAr;
        out[outOff + 1] = FAi;
        out[outOff + 2] = FBr;
        out[outOff + 3] = FBi;
        out[outOff + 4] = FCr;
        out[outOff + 5] = FCi;
        out[outOff + 6] = FDr;
        out[outOff + 7] = FDi;
    };
    // Real input radix-4 implementation
    FFT.prototype._realTransform4 = function () {
        var out = this._out;
        var size = this._csize;
        // Initial step (permute and transform)
        var width = this._width;
        var step = 1 << width;
        var len = (size / step) << 1;
        var outOff;
        var t;
        var bitrev = this._bitrev;
        if (len === 4) {
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                var off = bitrev[t];
                this._singleRealTransform2(outOff, off >>> 1, step >>> 1);
            }
        }
        else {
            // len === 8
            for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
                var off = bitrev[t];
                this._singleRealTransform4(outOff, off >>> 1, step >>> 1);
            }
        }
        // Loop through steps in decreasing order
        var inv = this._inv ? -1 : 1;
        var table = this.table;
        for (step >>= 2; step >= 2; step >>= 2) {
            len = (size / step) << 1;
            var halfLen = len >>> 1;
            var quarterLen = halfLen >>> 1;
            var hquarterLen = quarterLen >>> 1;
            // Loop through offsets in the data
            for (outOff = 0; outOff < size; outOff += len) {
                for (var i = 0, k = 0; i <= hquarterLen; i += 2, k += step) {
                    var A = outOff + i;
                    var B = A + quarterLen;
                    var C = B + quarterLen;
                    var D = C + quarterLen;
                    // Original values
                    var Ar = out[A];
                    var Ai = out[A + 1];
                    var Br = out[B];
                    var Bi = out[B + 1];
                    var Cr = out[C];
                    var Ci = out[C + 1];
                    var Dr = out[D];
                    var Di = out[D + 1];
                    // Middle values
                    var MAr = Ar;
                    var MAi = Ai;
                    var tableBr = table[k];
                    var tableBi = inv * table[k + 1];
                    var MBr = Br * tableBr - Bi * tableBi;
                    var MBi = Br * tableBi + Bi * tableBr;
                    var tableCr = table[2 * k];
                    var tableCi = inv * table[2 * k + 1];
                    var MCr = Cr * tableCr - Ci * tableCi;
                    var MCi = Cr * tableCi + Ci * tableCr;
                    var tableDr = table[3 * k];
                    var tableDi = inv * table[3 * k + 1];
                    var MDr = Dr * tableDr - Di * tableDi;
                    var MDi = Dr * tableDi + Di * tableDr;
                    // Pre-Final values
                    var T0r = MAr + MCr;
                    var T0i = MAi + MCi;
                    var T1r = MAr - MCr;
                    var T1i = MAi - MCi;
                    var T2r = MBr + MDr;
                    var T2i = MBi + MDi;
                    var T3r = inv * (MBr - MDr);
                    var T3i = inv * (MBi - MDi);
                    // Final values
                    var FAr = T0r + T2r;
                    var FAi = T0i + T2i;
                    var FBr = T1r + T3i;
                    var FBi = T1i - T3r;
                    out[A] = FAr;
                    out[A + 1] = FAi;
                    out[B] = FBr;
                    out[B + 1] = FBi;
                    // Output final middle point
                    if (i === 0) {
                        var FCr = T0r - T2r;
                        var FCi = T0i - T2i;
                        out[C] = FCr;
                        out[C + 1] = FCi;
                        continue;
                    }
                    // Do not overwrite ourselves
                    if (i === hquarterLen)
                        continue;
                    // In the flipped case:
                    // MAi = -MAi
                    // MBr=-MBi, MBi=-MBr
                    // MCr=-MCr
                    // MDr=MDi, MDi=MDr
                    var ST0r = T1r;
                    var ST0i = -T1i;
                    var ST1r = T0r;
                    var ST1i = -T0i;
                    var ST2r = -inv * T3i;
                    var ST2i = -inv * T3r;
                    var ST3r = -inv * T2i;
                    var ST3i = -inv * T2r;
                    var SFAr = ST0r + ST2r;
                    var SFAi = ST0i + ST2i;
                    var SFBr = ST1r + ST3i;
                    var SFBi = ST1i - ST3r;
                    var SA = outOff + quarterLen - i;
                    var SB = outOff + halfLen - i;
                    out[SA] = SFAr;
                    out[SA + 1] = SFAi;
                    out[SB] = SFBr;
                    out[SB + 1] = SFBi;
                }
            }
        }
    };
    // radix-2 implementation
    //
    // NOTE: Only called for len=4
    FFT.prototype._singleRealTransform2 = function (outOff, off, step) {
        var out = this._out;
        var data = this._data;
        var evenR = data[off];
        var oddR = data[off + step];
        var leftR = evenR + oddR;
        var rightR = evenR - oddR;
        out[outOff] = leftR;
        out[outOff + 1] = 0;
        out[outOff + 2] = rightR;
        out[outOff + 3] = 0;
    };
    // radix-4
    //
    // NOTE: Only called for len=8
    FFT.prototype._singleRealTransform4 = function (outOff, off, step) {
        var out = this._out;
        var data = this._data;
        var inv = this._inv ? -1 : 1;
        var step2 = step * 2;
        var step3 = step * 3;
        // Original values
        var Ar = data[off];
        var Br = data[off + step];
        var Cr = data[off + step2];
        var Dr = data[off + step3];
        // Pre-Final values
        var T0r = Ar + Cr;
        var T1r = Ar - Cr;
        var T2r = Br + Dr;
        var T3r = inv * (Br - Dr);
        // Final values
        var FAr = T0r + T2r;
        var FBr = T1r;
        var FBi = -T3r;
        var FCr = T0r - T2r;
        var FDr = T1r;
        var FDi = T3r;
        out[outOff] = FAr;
        out[outOff + 1] = 0;
        out[outOff + 2] = FBr;
        out[outOff + 3] = FBi;
        out[outOff + 4] = FCr;
        out[outOff + 5] = 0;
        out[outOff + 6] = FDr;
        out[outOff + 7] = FDi;
    };
    return FFT;
}());
export default FFT;
//# sourceMappingURL=fft.js.map