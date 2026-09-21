const { pct } = (() => {
  function pct(part, of) {
    if (of <= 0) return 0;
    return Math.round((part / of) * 1000) / 10;
  }
  return { pct };
})();
if (pct(1, 4) !== 25) throw new Error("pct 1/4");
if (pct(0, 0) !== 0) throw new Error("pct empty");
if (pct(1, 3) !== 33.3) throw new Error("pct 1/3");
console.log("ok attendance-report pct");
