import Phaser from 'phaser'
import { Joystick } from './Joystick.js'

export const WIDTH = 360
export const HEIGHT = 640

const RUN_SECONDS = 300
const PLAYER_RADIUS = 14
const ENEMY_RADIUS = 11
const HIT_DISTANCE_SQUARED = (PLAYER_RADIUS + ENEMY_RADIUS) ** 2
const SHOT_DISTANCE_SQUARED = (3 + ENEMY_RADIUS) ** 2
const SPAWN_MARGIN = 16
const FONT = { fontFamily: 'monospace', color: '#e5f3fb' }

function makePool(size, createView) {
  return Array.from({ length: size }, () => ({
    active: false,
    view: createView().setVisible(false),
  }))
}

function deactivate(entity) {
  entity.active = false
  entity.view.setVisible(false)
}

function distanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

export class Arena extends Phaser.Scene {
  create() {
    this.elapsed = 0
    this.lastSecond = -1
    this.hp = 100
    this.damageCooldown = 0
    this.shotCooldown = 0
    this.spawnCooldown = 0.5
    this.finished = false

    const grid = this.add.graphics().lineStyle(1, 0x203241)
    for (let x = 0; x < WIDTH; x += 32) grid.lineBetween(x, 0, x, HEIGHT)
    for (let y = 0; y < HEIGHT; y += 32) grid.lineBetween(0, y, WIDTH, y)

    this.enemies = makePool(24, () => this.add.circle(0, 0, ENEMY_RADIUS, 0xcf6559)
      .setStrokeStyle(2, 0x612e32))
    this.shots = makePool(16, () => this.add.circle(0, 0, 3, 0xffda86))
    const chassis = this.add.rectangle(0, 0, 25, 25, 0x68c7d9)
      .setStrokeStyle(2, 0xc9f7ff)
    const barrel = this.add.rectangle(13, 0, 14, 6, 0xdefaff)
    this.player = this.add.container(WIDTH / 2, HEIGHT / 2, [chassis, barrel])
      .setDepth(1)
    this.joystick = new Joystick(this, 60, HEIGHT - 65)

    this.add.rectangle(0, 0, WIDTH, 60, 0x0d1620, 0.95).setOrigin(0).setDepth(3)
    this.add.text(14, 10, 'IRONFALL', { ...FONT, fontSize: '16px' }).setDepth(3)
    this.clock = this.add.text(WIDTH - 14, 10, '00:00', { ...FONT, fontSize: '16px' })
      .setOrigin(1, 0).setDepth(3)
    this.add.rectangle(14, 43, 120, 8, 0x334456).setOrigin(0, 0.5).setDepth(3)
    this.healthBar = this.add.rectangle(14, 43, 120, 8, 0x68c7d9)
      .setOrigin(0, 0.5).setDepth(3)
    this.healthText = this.add.text(144, 35, '100 HP', { ...FONT, fontSize: '13px' })
      .setDepth(3)
  }

  update(_time, delta) {
    if (this.finished) return
    const dt = Math.min(delta, 50) / 1000
    this.elapsed += dt
    const elapsedSeconds = Math.min(RUN_SECONDS, Math.floor(this.elapsed))
    if (elapsedSeconds !== this.lastSecond) {
      this.lastSecond = elapsedSeconds
      const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')
      const seconds = String(elapsedSeconds % 60).padStart(2, '0')
      this.clock.setText(minutes + ':' + seconds)
    }
    if (this.elapsed >= RUN_SECONDS) {
      this.endRun('SURVIVED')
      return
    }

    const player = this.player
    player.x = Phaser.Math.Clamp(player.x + this.joystick.x * 175 * dt,
      PLAYER_RADIUS, WIDTH - PLAYER_RADIUS)
    player.y = Phaser.Math.Clamp(player.y + this.joystick.y * 175 * dt,
      60 + PLAYER_RADIUS, HEIGHT - PLAYER_RADIUS)

    this.spawnCooldown -= dt
    if (this.spawnCooldown <= 0) {
      this.spawnEnemy()
      this.spawnCooldown = Math.max(0.38, 1.2 - this.elapsed * 0.003)
    }

    this.damageCooldown -= dt
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const dx = player.x - enemy.x
      const dy = player.y - enemy.y
      const distance = Math.hypot(dx, dy)
      if (distance > 0) {
        const step = Math.min(distance, enemy.speed * dt)
        enemy.x += dx / distance * step
        enemy.y += dy / distance * step
        enemy.view.setPosition(enemy.x, enemy.y)
      }
      if (this.damageCooldown <= 0 && distanceSquared(player, enemy) <= HIT_DISTANCE_SQUARED) {
        this.hp = Math.max(0, this.hp - 10)
        this.damageCooldown = 0.55
        this.healthBar.setScale(this.hp / 100, 1)
        this.healthText.setText(this.hp + ' HP')
        if (this.hp === 0) {
          this.endRun('MECH DESTROYED')
          return
        }
      }
    }

    this.shotCooldown -= dt
    if (this.shotCooldown <= 0) this.fire()
    this.updateShots(dt)
  }

  spawnEnemy() {
    const enemy = this.enemies.find((slot) => !slot.active)
    if (!enemy) return

    // Offset each spawn from the mech, then project it to the arena perimeter.
    const angle = Math.random() * Math.PI * 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const edgeX = dx > 0 ? WIDTH + SPAWN_MARGIN : -SPAWN_MARGIN
    const edgeY = dy > 0 ? HEIGHT + SPAWN_MARGIN : 60 - SPAWN_MARGIN
    const distance = Math.min((edgeX - this.player.x) / dx, (edgeY - this.player.y) / dy)
    enemy.x = this.player.x + dx * distance
    enemy.y = this.player.y + dy * distance
    enemy.hp = 2
    enemy.speed = 64 + Math.min(54, this.elapsed * 0.18)
    enemy.active = true
    enemy.view.setPosition(enemy.x, enemy.y).setFillStyle(0xcf6559).setVisible(true)
  }

  fire() {
    let target
    let closest = Infinity
    for (const enemy of this.enemies) {
      if (!enemy.active) continue
      const distance = distanceSquared(this.player, enemy)
      if (distance < closest) {
        closest = distance
        target = enemy
      }
    }
    if (!target) return
    const shot = this.shots.find((slot) => !slot.active)
    if (!shot) return

    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x)
    this.player.setRotation(angle)
    shot.x = this.player.x
    shot.y = this.player.y
    shot.vx = Math.cos(angle) * 450
    shot.vy = Math.sin(angle) * 450
    shot.active = true
    shot.view.setPosition(shot.x, shot.y).setVisible(true)
    this.shotCooldown = 0.24
  }

  updateShots(dt) {
    // Keep individual steps shorter than an enemy's radius on slower frames.
    const steps = Math.ceil(450 * dt / 10)
    for (const shot of this.shots) {
      if (!shot.active) continue
      for (let step = 0; step < steps && shot.active; step++) {
        shot.x += shot.vx * dt / steps
        shot.y += shot.vy * dt / steps
        for (const enemy of this.enemies) {
          if (!enemy.active || distanceSquared(shot, enemy) > SHOT_DISTANCE_SQUARED) continue
          deactivate(shot)
          if (--enemy.hp === 0) deactivate(enemy)
          else enemy.view.setFillStyle(0xf39371)
          break
        }
      }
      if (shot.x < -32 || shot.x > WIDTH + 32 || shot.y < 28 || shot.y > HEIGHT + 32) {
        deactivate(shot)
      }
      if (shot.active) shot.view.setPosition(shot.x, shot.y)
    }
  }

  endRun(title) {
    this.finished = true
    this.joystick.hide()
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x080e15, 0.86)
      .setDepth(4)
    this.add.text(WIDTH / 2, HEIGHT / 2 - 58, title, { ...FONT, fontSize: '26px' })
      .setOrigin(0.5).setDepth(5)
    this.add.text(WIDTH / 2, HEIGHT / 2 - 19, this.clock.text + ' / 05:00', FONT)
      .setOrigin(0.5).setDepth(5)
    const restart = this.add.text(WIDTH / 2, HEIGHT / 2 + 44, 'RESTART', {
      ...FONT,
      color: '#091720',
      backgroundColor: '#68c7d9',
      fontSize: '22px',
      padding: { x: 32, y: 15 },
    }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true })
    restart.once('pointerup', () => this.scene.restart())
  }
}
