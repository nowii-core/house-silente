'use strict';
/* HORROR - materiali PBR condivisi */
const Mats = (function () {
  const M = {};
  function mat(o) {
    return Object.assign({
      albedo: [1, 1, 1], tex: null, uv: [1, 1], bump: 0, rough: 0.8, metal: 0, rvar: 0,
      emissive: [0, 0, 0], emMode: 0, unlit: 0, trim: 0, roomLit: 0
    }, o);
  }
  function make() {
    const T = Tex.get;
    // pareti: 1 carta da parati, 2 intonaco scuola, 3 piastrelle, 4 legno
    M.wallpaper = mat({ tex: T('wallpaper'), albedo: [1.3, 1.3, 1.3], bump: 0.012, rough: 0.9, trim: 1 });
    M.plaster = mat({ tex: T('plaster'), albedo: [1.1, 1.1, 1.1], bump: 0.015, rough: 0.9, trim: 1 });
    M.tileWall = mat({ tex: T('tileWall'), albedo: [1.2, 1.2, 1.2], bump: 0.02, rough: 0.35, trim: 1 });
    M.woodWall = mat({ tex: T('woodWall'), albedo: [1.4, 1.4, 1.4], bump: 0.02, rough: 0.55, trim: 1 });
    M.floorA = mat({ tex: T('floorA'), albedo: [1.3, 1.3, 1.3], bump: 0.02, rough: 0.4, rvar: -0.2 });
    M.floorB = mat({ tex: T('floorB'), albedo: [0.85, 0.85, 0.82], bump: 0.01, rough: 0.28, rvar: -0.2 });
    M.ceil = mat({ tex: T('ceil'), albedo: [0.7, 0.68, 0.62], bump: 0.01, rough: 0.9 });
    M.door = mat({ tex: T('doorWood'), uv: [1, 1 / 1.42], albedo: [1.4, 1.4, 1.4], bump: 0.02, rough: 0.5 });
    M.doorIron = mat({ tex: T('doorIron'), uv: [1, 1 / 1.42], albedo: [1.5, 1.5, 1.5], bump: 0.02, rough: 0.4, metal: 0.6 });
    M.dark = mat({ albedo: [0.05, 0.05, 0.055], rough: 0.5, metal: 0.5 });
    M.furn = mat({ tex: T('furnWood'), uv: [1, 1], albedo: [1.5, 1.5, 1.5], bump: 0.01, rough: 0.5 });
    M.sofa = mat({ tex: T('sofa'), albedo: [1.2, 1.2, 1.2], bump: 0.01, rough: 0.9 });
    M.sheet = mat({ tex: T('sheet'), albedo: [1.2, 1.2, 1.2], bump: 0.01, rough: 0.9 });
    M.locker = mat({ tex: T('locker'), albedo: [1.7, 1.7, 1.7], bump: 0.01, rough: 0.45, metal: 0.5 });
    M.painting = mat({ tex: T('painting'), uv: [1, 1 / 1.4], albedo: [1.6, 1.6, 1.6], bump: 0.01, rough: 0.6 });
    M.books = mat({ tex: T('books'), albedo: [1.8, 1.8, 1.8], bump: 0.01, rough: 0.8 });
    M.rug = mat({ tex: T('rug'), albedo: [1.4, 1.4, 1.4], bump: 0.01, rough: 0.95 });
    M.paper = mat({ tex: T('paper'), albedo: [1.5, 1.5, 1.5], rough: 0.8 });
    M.blood = mat({ tex: T('blood'), albedo: [1, 1, 1], rough: 0.3 });
    M.metal = mat({ albedo: [0.35, 0.36, 0.38], rough: 0.35, metal: 0.9 });
    M.white = mat({ albedo: [0.7, 0.7, 0.68], rough: 0.4 });
    M.porcelain = mat({ albedo: [0.8, 0.8, 0.78], rough: 0.12 });
    M.brass = mat({ albedo: [0.9, 0.62, 0.2], rough: 0.25, metal: 1 });
    M.glass = mat({ albedo: [0.1, 0.14, 0.16], rough: 0.05, metal: 0.3 });
    M.black = mat({ albedo: [0.015, 0.015, 0.018], rough: 0.6 });
    M.board = mat({ albedo: [0.03, 0.07, 0.05], rough: 0.95 });
    M.screenTV = mat({ unlit: 1, albedo: [0.55, 0.65, 0.75], emissive: [0.7, 0.7, 0.7] });
    M.lamp = mat({ unlit: 1, albedo: [1, 0.78, 0.5], emissive: [4.2, 4.2, 4.2], roomLit: 1 });
    M.window = mat({ unlit: 1, albedo: [0.05, 0.08, 0.14], emissive: [0.3, 0.3, 0.3] });
    M.switchPlate = mat({ albedo: [0.55, 0.53, 0.45], rough: 0.5 });
    M.glowRed = mat({ unlit: 1, albedo: [1, 0.1, 0.05], emissive: [3, 3, 3] });
    M.glowGold = mat({ albedo: [1, 0.78, 0.2], rough: 0.2, metal: 1, emissive: [0.5, 0.35, 0.05] });
    M.gunMetal = mat({ albedo: [0.13, 0.135, 0.15], rough: 0.32, metal: 0.95 });
    M.gunPoly = mat({ albedo: [0.05, 0.052, 0.058], rough: 0.55, metal: 0.1 });
    M.gunSteel = mat({ albedo: [0.55, 0.56, 0.6], rough: 0.25, metal: 1.0 });
    M.wood = mat({ albedo: [0.28, 0.14, 0.06], rough: 0.5 });
    M.sleeve = mat({ albedo: [0.12, 0.1, 0.09], rough: 0.9 });
    M.glove = mat({ albedo: [0.45, 0.33, 0.25], rough: 0.7 });
    M.battery = mat({ albedo: [0.1, 0.45, 0.12], rough: 0.4, metal: 0.4 });
    M.lensOn = mat({ unlit: 1, albedo: [1, 0.95, 0.8], emissive: [3.5, 3.5, 3.5] });
    M.lensOff = mat({ albedo: [0.05, 0.05, 0.06], rough: 0.1, metal: 0.5 });
    // mostro
    M.skin = mat({ albedo: [0.34, 0.31, 0.27], rough: 0.65 });
    M.skinDark = mat({ albedo: [0.1, 0.09, 0.09], rough: 0.7 });
    M.rag = mat({ tex: T('sheet'), albedo: [0.14, 0.11, 0.09], rough: 0.95 });
    M.maskBone = mat({ albedo: [0.7, 0.66, 0.58], rough: 0.5 });
    M.eye = mat({ unlit: 1, albedo: [1, 0.85, 0.6], emissive: [2.6, 2.6, 2.6] });
    M.sack = mat({ albedo: [0.15, 0.11, 0.07], rough: 0.95 });
    return M;
  }
  return { make: make, M: M };
})();
