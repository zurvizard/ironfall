export class Joystick {
  constructor(scene, x, y) {
    this.x = 0
    this.y = 0
    this.pointer = null
    this.base = scene.add.circle(x, y, 38, 0x172838, 0.8)
      .setStrokeStyle(2, 0x537085).setDepth(2)
    this.knob = scene.add.circle(x, y, 15, 0x8fb3c8, 0.85).setDepth(2)

    scene.input.on('pointerdown', (pointer) => {
      if (!this.base.visible || this.pointer !== null || pointer.y < 80) return
      this.pointer = pointer
      this.base.setPosition(pointer.x, pointer.y)
      this.move(pointer)
    })
    scene.input.on('pointermove', this.move, this)
    scene.input.on('pointerup', this.release, this)
    scene.input.on('pointerupoutside', this.release, this)
    scene.input.on('gameout', () => this.reset())
    scene.game.events.on('blur', this.reset, this)
    scene.events.once('shutdown', () => {
      scene.game.events.off('blur', this.reset, this)
    })
    this.homeX = x
    this.homeY = y
  }

  move(pointer) {
    if (pointer !== this.pointer) return
    const dx = pointer.x - this.base.x
    const dy = pointer.y - this.base.y
    const length = Math.max(38, Math.hypot(dx, dy))
    this.x = dx / length
    this.y = dy / length
    this.knob.setPosition(this.base.x + this.x * 38, this.base.y + this.y * 38)
  }

  release(pointer) {
    if (pointer === this.pointer) this.reset()
  }

  reset() {
    this.pointer = null
    this.x = 0
    this.y = 0
    this.base.setPosition(this.homeX, this.homeY)
    this.knob.setPosition(this.homeX, this.homeY)
  }

  hide() {
    this.reset()
    this.base.setVisible(false)
    this.knob.setVisible(false)
  }
}
