const express = require('express');
const router = express.Router();
const fs = require('fs');

function getWeapons(file) {
  const path = `./public/weapons/${file}.json`;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

/*
  A firearm drawn like in the game's shop: its magazine (or a loaded rocket) placed by the offset
  of its center from the gun's center, rotated, under or over the gun. Positioned in a box that
  bounds them all, in the images' own pixels.
*/
function layoutFirearmSprite(i) {
  if (!(i.pic_width > 0)) {
    return null;
  }

  const parts = [{ file: i.pic_filename, w: i.pic_width, h: i.pic_height, x: 0, y: 0, rot: 0, under: false }];

  if (i.has_magazine && i.magazine_id && i.magazine_width > 0) {
    parts.push({
      file: `${i.magazine_id}.png`,
      w: i.magazine_width,
      h: i.magazine_height,
      x: i.magazine_x,
      y: i.magazine_y,
      rot: i.magazine_rotation,
      under: i.draw_magazine_under
    });
  }

  const bounds = parts.map(p => {
    const rad = p.rot * Math.PI / 180;
    const ew = Math.abs(p.w * Math.cos(rad)) + Math.abs(p.h * Math.sin(rad));
    const eh = Math.abs(p.w * Math.sin(rad)) + Math.abs(p.h * Math.cos(rad));
    return { l: p.x - ew / 2, t: p.y - eh / 2, r: p.x + ew / 2, b: p.y + eh / 2 };
  });

  const minX = Math.floor(Math.min(...bounds.map(b => b.l)));
  const minY = Math.floor(Math.min(...bounds.map(b => b.t)));
  const maxX = Math.ceil(Math.max(...bounds.map(b => b.r)));
  const maxY = Math.ceil(Math.max(...bounds.map(b => b.b)));

  const placed = parts.map(p => ({
    file: p.file,
    w: p.w,
    h: p.h,
    rot: p.rot,
    left: Math.floor(p.x - p.w / 2 - minX),
    top: Math.floor(p.y - p.h / 2 - minY),
    under: p.under
  }));

  return {
    width: maxX - minX,
    height: maxY - minY,
    parts: [...placed.slice(1).filter(p => p.under), placed[0], ...placed.slice(1).filter(p => !p.under)]
  };
}

const firearms = getWeapons('firearms').map(i => ({ ...i, sprite: layoutFirearmSprite(i) }));

/* Every firearm row as tall as the tallest sprite, so the rows line up. */
const firearmSpriteHeight = Math.max(0, ...firearms.map(i => i.sprite ? i.sprite.height : i.pic_height || 0));
const melees = getWeapons('melees');
const explosives = getWeapons('explosives');
const spells = getWeapons('spells');

router.get('/', function (req, res) {
  res.render('weapons', {
    page: 'Weapons',
    user: req.user,
    firearms, firearmSpriteHeight, melees, explosives, spells
  });
});

module.exports = router;
