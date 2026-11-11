import Phaser from 'phaser';
import { HeroDef, TAG_COLOR } from './data';

export class Hero {
  cooldown = 0;
  body: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, public id: string, public def: HeroDef, public x: number, public y: number) {
    this.body = scene.add.rectangle(x, y, 36, 36, TAG_COLOR[def.tag]).setStrokeStyle(3, rarityColor(def.rarity));
    this.label = scene.add
      .text(x, y, def.name.split(' ')[0].slice(0, 4), { fontFamily: 'monospace', fontSize: '11px', color: '#111' })
      .setOrigin(0.5);
  }

  destroy() {
    this.body.destroy();
    this.label.destroy();
  }
}

export function rarityColor(r: HeroDef['rarity']): number {
  return { common: 0x555555, rare: 0x3b82f6, epic: 0xa855f7, legendary: 0xf5b301 }[r];
}
