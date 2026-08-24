// QR code generator - pure Canvas, no dependencies
// Generates QR codes using the Reed-Solomon error correction algorithm
var QRCode = (function() {
  // Minimal QR encoder (version 1-4, level L)
  var ALIGN_POS = {
    1: [], 2: [6,18], 3: [6,22], 4: [6,26],
    5: [6,30], 6: [6,34], 7: [6,22,38], 8: [6,24,42]
  };

  function createDataSegments(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) { bytes.push(c); }
      else if (c < 0x800) { bytes.push(0xC0|(c>>6), 0x80|(c&0x3F)); }
      else { bytes.push(0xE0|(c>>12), 0x80|((c>>6)&0x3F), 0x80|(c&0x3F)); }
    }
    return bytes;
  }

  // GF(256) arithmetic for Reed-Solomon
  var EXP = new Array(256), LOG = new Array(256);
  (function() {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11D : 0); }
    EXP[255] = EXP[0];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
  }

  function rsGenPoly(nsym) {
    var g = [1];
    for (var i = 0; i < nsym; i++) {
      var ng = new Array(g.length + 1).fill(0);
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }

  function rsEncode(data, nsym) {
    var gen = rsGenPoly(nsym);
    var res = new Array(data.length + nsym).fill(0);
    for (var i = 0; i < data.length; i++) res[i] = data[i];
    for (var i = 0; i < data.length; i++) {
      var coef = res[i];
      if (coef !== 0) {
        for (var j = 1; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(data.length);
  }

  function makeMatrix(text) {
    var bytes = createDataSegments(text);
    // Choose version based on data length
    var version, totalCodewords, ecLevel = 'L';
    if (bytes.length <= 17) { version = 1; totalCodewords = 26; }
    else if (bytes.length <= 32) { version = 2; totalCodewords = 44; }
    else if (bytes.length <= 53) { version = 3; totalCodewords = 70; }
    else if (bytes.length <= 78) { version = 4; totalCodewords = 100; }
    else if (bytes.length <= 106) { version = 5; totalCodewords = 134; }
    else if (bytes.length <= 134) { version = 6; totalCodewords = 172; }
    else if (bytes.length <= 154) { version = 7; totalCodewords = 196; }
    else { version = 8; totalCodewords = 242; }

    var size = version * 4 + 17;
    var matrix = [];
    var reserved = [];
    for (var i = 0; i < size; i++) {
      matrix[i] = new Array(size).fill(0);
      reserved[i] = new Array(size).fill(false);
    }

    function setModule(r, c, val) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        matrix[r][c] = val ? 1 : 0;
        reserved[r][c] = true;
      }
    }

    // Finder patterns
    function drawFinder(row, col) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
          var inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          var onBorder = r === 0 || r === 6 || c === 0 || c === 6;
          setModule(row + r, col + c, inInner || (inOuter && onBorder));
        }
      }
    }
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (var i = 8; i < size - 8; i++) {
      setModule(6, i, i % 2 === 0);
      setModule(i, 6, i % 2 === 0);
    }

    // Alignment patterns
    var aligns = ALIGN_POS[version] || [];
    for (var i = 0; i < aligns.length; i++) {
      for (var j = 0; j < aligns.length; j++) {
        var ar = aligns[i], ac = aligns[j];
        if (reserved[ar] && reserved[ar][ac]) continue;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            setModule(ar + dr, ac + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
          }
        }
      }
    }

    // Dark module
    setModule(size - 8, 8, true);

    // Reserve format info areas
    for (var i = 0; i < 15; i++) {
      if (i < 6) setModule(i, 8, false);
      else if (i < 8) setModule(i + 1, 8, false);
      else if (i < 15) setModule(size - 15 + i, 8, false);
    }
    for (var i = 0; i < 15; i++) {
      if (i < 8) setModule(8, size - 1 - i, false);
      else if (i < 9) setModule(8, 14 - i, false);
      else setModule(8, 15 - i - 1, false);
    }

    // Encode data
    var dataCodewords = totalCodewords - (version <= 1 ? 19 : version <= 6 ? 34 : version <= 8 ? 44 : 70);
    var ecPerBlock = version <= 1 ? 7 : version <= 6 ? 10 : version <= 8 ? 15 : 20;
    var numBlocks = version <= 1 ? 1 : version <= 6 ? 2 : version <= 8 ? 4 : 4;
    var dataPerBlock = Math.floor(dataCodewords / numBlocks);

    var dataBits = [];
    // Mode indicator (byte mode = 0100)
    dataBits.push(0, 1, 0, 0);
    // Character count
    var charCountBits = version <= 9 ? 8 : 16;
    for (var i = charCountBits - 1; i >= 0; i--) dataBits.push((bytes.length >> i) & 1);
    // Data
    for (var i = 0; i < bytes.length; i++) {
      for (var b = 7; b >= 0; b--) dataBits.push((bytes[i] >> b) & 1);
    }
    // Terminator
    var totalDataBits = dataPerBlock * numBlocks * 8;
    for (var i = 0; i < 4 && dataBits.length < totalDataBits; i++) dataBits.push(0);
    // Pad to byte boundary
    while (dataBits.length % 8 !== 0) dataBits.push(0);
    // Pad bytes
    var padBytes = [0xEC, 0x11];
    var padIdx = 0;
    while (dataBits.length < totalDataBits) {
      for (var b = 7; b >= 0; b--) dataBits.push((padBytes[padIdx] >> b) & 1);
      padIdx = (padIdx + 1) % 2;
    }

    // Split into blocks and add EC
    var blocks = [];
    var ecBlocks = [];
    var offset = 0;
    for (var b = 0; b < numBlocks; b++) {
      var blockData = [];
      for (var i = 0; i < dataPerBlock; i++) {
        var byte = 0;
        for (var j = 0; j < 8; j++) {
          byte = (byte << 1) | (dataBits[offset++] || 0);
        }
        blockData.push(byte);
      }
      blocks.push(blockData);
      ecBlocks.push(rsEncode(blockData, ecPerBlock));
    }

    // Interleave
    var codewords = [];
    for (var i = 0; i < dataPerBlock; i++) {
      for (var b = 0; b < numBlocks; b++) {
        codewords.push(blocks[b][i]);
      }
    }
    for (var i = 0; i < ecPerBlock; i++) {
      for (var b = 0; b < numBlocks; b++) {
        if (ecBlocks[b][i] !== undefined) codewords.push(ecBlocks[b][i]);
      }
    }

    // Convert to bits
    var allBits = [];
    for (var i = 0; i < codewords.length; i++) {
      for (var b = 7; b >= 0; b--) allBits.push((codewords[i] >> b) & 1);
    }

    // Place data bits
    var bitIdx = 0;
    var col = size - 1;
    while (col >= 0) {
      if (col === 6) col--; // skip timing
      for (var row = 0; row < size; row++) {
        for (var dc = 0; dc <= 1; dc++) {
          var c = col - dc;
          if (c < 0 || c >= size) continue;
          var r = ((Math.floor((size - 1 - col) / 2)) % 2 === 0) ? size - 1 - row : row;
          if (!reserved[r][c]) {
            matrix[r][c] = bitIdx < allBits.length ? allBits[bitIdx] : 0;
            bitIdx++;
          }
        }
      }
      col -= 2;
    }

    // Apply mask 0 (XOR with row+col even)
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (!reserved[r][c] && (r + c) % 2 === 0) {
          matrix[r][c] ^= 1;
        }
      }
    }

    return { matrix: matrix, size: size };
  }

  function generate(text, canvas, options) {
    options = options || {};
    var moduleSize = options.moduleSize || 4;
    var margin = options.margin || 4;
    var darkColor = options.darkColor || '#111111';
    var lightColor = options.lightColor || '#ffffff';

    var qr = makeMatrix(text);
    var totalSize = (qr.size + margin * 2) * moduleSize;
    canvas.width = totalSize;
    canvas.height = totalSize;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, totalSize, totalSize);
    ctx.fillStyle = darkColor;

    for (var r = 0; r < qr.size; r++) {
      for (var c = 0; c < qr.size; c++) {
        if (qr.matrix[r][c]) {
          ctx.fillRect((c + margin) * moduleSize, (r + margin) * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  }

  return { generate: generate };
})();
