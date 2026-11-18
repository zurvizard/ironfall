import Phaser from 'phaser'
import { Arena, WIDTH, HEIGHT } from './Arena.js'

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'canvas-parent',
  backgroundColor: '#111c27',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WIDTH,
    height: HEIGHT,
  },
  scene: Arena,
})
