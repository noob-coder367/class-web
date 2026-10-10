import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  collectNearbyCrystals,
  createPlatformerState,
  hazardPosition,
  PLATFORMER_CRYSTALS,
  PLATFORMER_FINISH_Z,
  PLATFORMER_HAZARD,
  PLATFORMER_PLATFORMS,
  platformTransform,
  stepPlatformer,
} from '../../lib/quizPartyPlatformerPhysics.js'

const TEAM_COLORS = { blue: '#76a9ff', green: '#62e6ab', purple: '#bd9cff', orange: '#ffb86e', pink: '#ff91be', cyan: '#72e5f3', red: '#ff7c88', gold: '#ffd56d' }
const KEY_DIRECTIONS = {
  w: 'forward', W: 'forward', ArrowUp: 'forward',
  s: 'back', S: 'back', ArrowDown: 'back',
  a: 'left', A: 'left', ArrowLeft: 'left',
  d: 'right', D: 'right', ArrowRight: 'right',
}
const SKY = new THREE.Color('#91d9ee')

function SkyCloud({ position, scale = 1, speed = 0.08 }) {
  const group = useRef(null)
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.position.x = position[0] + Math.sin(clock.elapsedTime * speed + position[2]) * 1.35
      group.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.45 + position[0]) * 0.15
    }
  })
  return <group ref={group} position={position} scale={scale}>
    <mesh><sphereGeometry args={[0.7, 14, 10]} /><meshStandardMaterial color="#f8ffff" roughness={1} /></mesh>
    <mesh position={[-0.65, -0.13, 0]} scale={[0.9, 0.72, 0.72]}><sphereGeometry args={[0.55, 12, 8]} /><meshStandardMaterial color="#f4fbff" roughness={1} /></mesh>
    <mesh position={[0.57, -0.18, 0.05]} scale={[0.92, 0.65, 0.72]}><sphereGeometry args={[0.55, 12, 8]} /><meshStandardMaterial color="#ffffff" roughness={1} /></mesh>
  </group>
}

function DistantIslands() {
  return <group>
    {[-11, -6, 0, 6, 11].map((x, index) => <group key={x} position={[x, 0, 22 + (index % 2) * 7]}>
      <mesh position={[0, 1.1 + index % 3 * 0.35, 0]}><coneGeometry args={[2.4, 2.8, 7]} /><meshStandardMaterial color={index % 2 ? '#79b997' : '#88b6ca'} roughness={0.9} /></mesh>
      <mesh position={[0, 2.75 + index % 3 * 0.35, 0]}><coneGeometry args={[1.35, 2.2, 7]} /><meshStandardMaterial color={index % 2 ? '#8fc9a6' : '#a6d0da'} roughness={0.9} /></mesh>
      <mesh position={[0, -0.24, 0]}><sphereGeometry args={[0.48, 12, 8]} /><meshStandardMaterial color="#b6dcf2" roughness={0.9} /></mesh>
    </group>)}
    <SkyCloud position={[-8, 5.4, 7]} scale={1.2} />
    <SkyCloud position={[8, 6.2, 15]} scale={0.9} speed={0.06} />
    <SkyCloud position={[-5, 7.1, 29]} scale={1.5} speed={0.05} />
  </group>
}

function IslandPlatform({ platform, color }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const position = platformTransform(platform, clock.elapsedTime)
    ref.current.position.set(position.x, position.y, position.z)
  })
  const topColor = platform.style === 'finish' ? '#ffe18a' : platform.style === 'checkpoint' ? '#a4f3d1' : color
  const radius = Math.min(platform.width, platform.depth) * 0.5
  return <group ref={ref} position={[platform.x, platform.y, platform.z]}>
    <mesh position={[0, -0.47, 0]} castShadow>
      <cylinderGeometry args={[radius * 0.78, radius * 0.66, 0.8, 9]} />
      <meshStandardMaterial color={platform.style === 'finish' ? '#8b70c8' : '#70539e'} roughness={0.92} />
    </mesh>
    <mesh position={[0, -0.075, 0]} receiveShadow castShadow>
      <cylinderGeometry args={[radius * 0.98, radius, 0.2, 10]} />
      <meshStandardMaterial color="#6d9876" roughness={0.94} />
    </mesh>
    <mesh position={[0, 0.055, 0]} receiveShadow>
      <cylinderGeometry args={[radius * 0.93, radius * 0.93, 0.12, 10]} />
      <meshStandardMaterial color={topColor} roughness={0.76} />
    </mesh>
    <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius * 0.85, 0.035, 6, 24]} />
      <meshStandardMaterial color={platform.style === 'finish' ? '#fff1b4' : '#cff2c8'} emissive={platform.style === 'finish' ? '#c28d22' : '#315b3d'} emissiveIntensity={0.24} />
    </mesh>
    {platform.style !== 'moving' && platform.style !== 'finish' && <>
      <mesh position={[-radius * 0.42, 0.18, radius * 0.12]} rotation={[0.08, 0.2, -0.12]}><sphereGeometry args={[0.24, 10, 8]} /><meshStandardMaterial color="#74c98e" roughness={0.92} /></mesh>
      <mesh position={[radius * 0.47, 0.17, -radius * 0.28]} rotation={[-0.08, -0.2, 0.12]}><sphereGeometry args={[0.18, 9, 7]} /><meshStandardMaterial color="#9bdc9b" roughness={0.92} /></mesh>
    </>}
    {platform.style === 'finish' && <>
      <mesh position={[-2.3, 1.05, 0]}><cylinderGeometry args={[0.12, 0.16, 2.2, 9]} /><meshStandardMaterial color="#e9c774" metalness={0.48} roughness={0.4} /></mesh>
      <mesh position={[2.3, 1.05, 0]}><cylinderGeometry args={[0.12, 0.16, 2.2, 9]} /><meshStandardMaterial color="#e9c774" metalness={0.48} roughness={0.4} /></mesh>
      <mesh position={[0, 2.03, 0]}><torusGeometry args={[2.3, 0.12, 8, 32, Math.PI]} /><meshStandardMaterial color="#ffe89c" emissive="#f4b842" emissiveIntensity={1.1} metalness={0.25} /></mesh>
      <mesh position={[0, 0.45, -0.25]}><cylinderGeometry args={[0.48, 0.62, 0.85, 8]} /><meshStandardMaterial color="#f5cb64" metalness={0.58} roughness={0.25} /></mesh>
      <mesh position={[0, 1.08, -0.25]}><cylinderGeometry args={[0.22, 0.42, 0.4, 8]} /><meshStandardMaterial color="#fff0a6" metalness={0.48} roughness={0.22} emissive="#b78627" emissiveIntensity={0.55} /></mesh>
    </>}
    {platform.style === 'checkpoint' && <CheckpointFlag />}
  </group>
}

function CheckpointFlag() {
  const flag = useRef(null)
  useFrame(({ clock }) => { if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.2) * 0.14 })
  return <group position={[0, 0, 0]}>
    <mesh position={[-1.55, 0.87, -0.15]}><cylinderGeometry args={[0.055, 0.07, 1.65, 8]} /><meshStandardMaterial color="#e5d4a6" metalness={0.3} roughness={0.55} /></mesh>
    <group ref={flag} position={[-1.08, 1.35, -0.15]}>
      <mesh position={[0.48, 0, 0]}><boxGeometry args={[0.95, 0.48, 0.07]} /><meshStandardMaterial color="#55e3b0" emissive="#1b8c67" emissiveIntensity={0.35} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0.47, 0, 0.045]}><sphereGeometry args={[0.095, 10, 8]} /><meshStandardMaterial color="#fff2a4" emissive="#f5c34f" emissiveIntensity={0.6} /></mesh>
    </group>
  </group>
}

function Crystal({ crystal, color, collected }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y += 0.024
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 1.7 + crystal.z) * 0.12
    ref.current.position.y = crystal.y + Math.sin(clock.elapsedTime * 2.5 + crystal.z) * 0.12
    const target = collected ? 0 : 1
    const scale = ref.current.scale.x + (target - ref.current.scale.x) * 0.24
    ref.current.scale.setScalar(scale)
  })
  return <group ref={ref} position={[crystal.x, crystal.y, crystal.z]}>
    <mesh rotation={[0, 0, Math.PI / 4]}>
      <octahedronGeometry args={[0.38, 0]} />
      <meshStandardMaterial color="#eaffff" emissive={color} emissiveIntensity={1.45} metalness={0.18} roughness={0.18} />
    </mesh>
    <mesh scale={1.4}><sphereGeometry args={[0.31, 12, 9]} /><meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} /></mesh>
  </group>
}

function WindWheel() {
  const group = useRef(null)
  const hub = useRef(null)
  useFrame(({ clock }) => {
    const p = hazardPosition(clock.elapsedTime)
    if (group.current) group.current.position.set(p.x, PLATFORMER_HAZARD.y, p.z)
    if (hub.current) hub.current.rotation.z = clock.elapsedTime * 2.8
  })
  return <group ref={group} position={[PLATFORMER_HAZARD.x, PLATFORMER_HAZARD.y, PLATFORMER_HAZARD.z]}>
    <mesh ref={hub}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#ff9a71" emissive="#bc4828" emissiveIntensity={0.55} /></mesh>
    {[0, 1, 2, 3].map((index) => <group key={index} rotation={[0, 0, index * Math.PI / 2]}>
      <mesh position={[0.46, 0, 0]} rotation={[0, 0, 0.35]}><coneGeometry args={[0.22, 0.86, 5]} /><meshStandardMaterial color={index % 2 ? '#ffd17f' : '#ff816b'} emissive="#833b36" emissiveIntensity={0.2} /></mesh>
    </group>)}
  </group>
}

function QuizGate({ answerFeedback }) {
  const ring = useRef(null)
  const correct = answerFeedback === true
  const wrong = answerFeedback === false
  const color = correct ? '#72ffd0' : wrong ? '#ff8196' : '#b4a5ff'
  useFrame(({ clock }) => { if (ring.current) { ring.current.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.08; ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * (correct || wrong ? 5 : 1.7)) * (correct || wrong ? 0.045 : 0.018)) } })
  return <group position={[0, 2.6, 14.3]}>
    <mesh position={[-1.65, -0.7, 0]}><cylinderGeometry args={[0.14, 0.2, 1.75, 8]} /><meshStandardMaterial color="#dbc989" metalness={0.38} roughness={0.42} /></mesh>
    <mesh position={[1.65, -0.7, 0]}><cylinderGeometry args={[0.14, 0.2, 1.75, 8]} /><meshStandardMaterial color="#dbc989" metalness={0.38} roughness={0.42} /></mesh>
    <mesh ref={ring}>
      <torusGeometry args={[1.55, 0.105, 10, 40]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={correct || wrong ? 1.1 : 0.38} metalness={0.28} roughness={0.23} />
    </mesh>
    <pointLight position={[0, 0, 0.4]} color={color} intensity={correct || wrong ? 1.2 : 0.25} distance={4} />
  </group>
}

function PlayerAvatar({ playerRef, color, finished, stateRef, landingPulseRef }) {
  const root = useRef(null)
  const body = useRef(null)
  const legs = useRef([])
  useFrame(({ clock }) => {
    if (!root.current) return
    const state = stateRef.current
    const speed = Math.hypot(state.vx, state.vz)
    const moving = state.grounded && speed > 0.4
    const stride = moving ? Math.sin(clock.elapsedTime * (speed > 7 ? 16 : 11)) * Math.min(1, speed / 2.4) : 0
    const landedAgo = clock.elapsedTime - landingPulseRef.current
    const landing = landedAgo >= 0 && landedAgo < 0.2 ? Math.sin((landedAgo / 0.2) * Math.PI) : 0
    const hurt = state.invulnerable > 0 && !finished
    playerRef.current.rotation.z = hurt ? Math.sin(clock.elapsedTime * 30) * 0.12 : 0
    if (body.current) {
      const bob = finished ? Math.abs(Math.sin(clock.elapsedTime * 5)) * 0.23 : moving ? Math.abs(stride) * 0.065 : Math.sin(clock.elapsedTime * 2.6) * 0.025
      body.current.position.y = 0.07 + bob - landing * 0.09
      body.current.rotation.z = finished ? Math.sin(clock.elapsedTime * 4) * 0.12 : -state.vx * 0.018
      body.current.rotation.x = !state.grounded ? (state.vy > 0 ? -0.1 : 0.14) : 0
      body.current.scale.set(1 + landing * 0.08, 1 - landing * 0.1, 1 + landing * 0.08)
    }
    legs.current.forEach((leg, index) => {
      if (!leg) return
      if (finished) leg.rotation.x = Math.sin(clock.elapsedTime * 6 + index * Math.PI) * 0.55
      else if (!state.grounded) leg.rotation.x = state.vy > 0 ? (index ? -0.36 : 0.52) : (index ? 0.52 : -0.36)
      else leg.rotation.x = stride * (index ? 1 : -1)
    })
  })
  return <group ref={root}>
    <group ref={playerRef}>
      <group ref={body}>
        <mesh position={[0, -0.02, 0]} castShadow><capsuleGeometry args={[0.37, 0.42, 4, 10]} /><meshStandardMaterial color={color} roughness={0.43} /></mesh>
        <mesh position={[0, 0.38, 0.03]} castShadow><sphereGeometry args={[0.27, 16, 12]} /><meshStandardMaterial color="#ffe1ba" roughness={0.56} /></mesh>
        <mesh position={[-0.105, 0.41, 0.265]}><sphereGeometry args={[0.042, 10, 8]} /><meshBasicMaterial color="#2f3556" /></mesh>
        <mesh position={[0.105, 0.41, 0.265]}><sphereGeometry args={[0.042, 10, 8]} /><meshBasicMaterial color="#2f3556" /></mesh>
        <mesh position={[0, 0.29, 0.28]}><sphereGeometry args={[0.045, 10, 8]} /><meshBasicMaterial color="#f08f7f" /></mesh>
        <mesh position={[-0.43, -0.05, 0]} rotation={[0, 0, -0.28]}><capsuleGeometry args={[0.105, 0.25, 3, 6]} /><meshStandardMaterial color="#ffcf91" roughness={0.55} /></mesh>
        <mesh position={[0.43, -0.05, 0]} rotation={[0, 0, 0.28]}><capsuleGeometry args={[0.105, 0.25, 3, 6]} /><meshStandardMaterial color="#ffcf91" roughness={0.55} /></mesh>
        {[-0.17, 0.17].map((x, index) => <group key={index} ref={(node) => { legs.current[index] = node }} position={[x, -0.38, 0]}>
          <mesh position={[0, -0.11, 0]} castShadow><capsuleGeometry args={[0.115, 0.22, 3, 6]} /><meshStandardMaterial color="#fff0c7" roughness={0.6} /></mesh>
          <mesh position={[0.025, -0.21, 0.09]}><sphereGeometry args={[0.14, 10, 8]} /><meshStandardMaterial color="#775bc7" roughness={0.55} /></mesh>
        </group>)}
        <mesh position={[0, 0.64, 0]}><sphereGeometry args={[0.075, 9, 7]} /><meshStandardMaterial color="#ffd266" emissive="#d09d36" emissiveIntensity={0.35} /></mesh>
      </group>
    </group>
  </group>
}

function FinishConfetti({ active }) {
  const refs = useRef([])
  useFrame(({ clock }) => {
    if (!active) return
    refs.current.forEach((mesh, index) => {
      if (!mesh) return
      const t = clock.elapsedTime * 0.8 + index * 1.73
      mesh.position.set(Math.sin(t * 1.1 + index) * (2 + (index % 4) * 0.4), 2.1 + Math.abs(Math.sin(t)) * 2.2, 33 + Math.cos(t * 0.8 + index) * 2.5)
      mesh.rotation.set(t * 1.4, t, t * 0.7)
    })
  })
  return <group>{Array.from({ length: 24 }, (_, index) => <mesh key={index} ref={(node) => { refs.current[index] = node }} position={[0, -20, 0]}>
    <boxGeometry args={[0.13, 0.19, 0.035]} />
    <meshBasicMaterial color={['#ff718c', '#ffe18a', '#7af4c1', '#8ebaff', '#db9bff'][index % 5]} />
  </mesh>)}</group>
}

function WorldScene({ inputRef, teamColor, onGameEvent, answerFeedback, finished, collectedIds, onProgress }) {
  const playerRef = useRef(null)
  const stateRef = useRef(createPlatformerState())
  const collectedRef = useRef(collectedIds)
  const onEventRef = useRef(onGameEvent)
  const onProgressRef = useRef(onProgress)
  const progressTimer = useRef(0)
  const landingPulseRef = useRef(-1)
  const { camera } = useThree()
  const cameraFocusRef = useRef(new THREE.Vector3())
  const cameraTargetRef = useRef(new THREE.Vector3())
  useEffect(() => { collectedRef.current = collectedIds }, [collectedIds])
  useEffect(() => { onEventRef.current = onGameEvent }, [onGameEvent])
  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const player = playerRef.current
    if (!player) return
    const time = clock.elapsedTime
    let state = stateRef.current

    if (finished) {
      const targetX = 0
      const targetY = 2.45 + 0.58 + 0.12 + Math.abs(Math.sin(time * 5)) * 0.24
      const targetZ = PLATFORMER_FINISH_Z
      state = { ...state, x: THREE.MathUtils.damp(state.x, targetX, 2.4, dt), y: THREE.MathUtils.damp(state.y, targetY, 3.1, dt), z: THREE.MathUtils.damp(state.z, targetZ, 2.4, dt), vx: 0, vz: 0 }
    } else {
      const stepped = stepPlatformer(state, inputRef.current, dt, time)
      state = stepped.state
      if (stepped.events.jumped) onEventRef.current?.('jump')
      if (stepped.events.landed) { landingPulseRef.current = time; onEventRef.current?.('land') }
      if (stepped.events.checkpoint) onEventRef.current?.('checkpoint')
      if (stepped.events.hitHazard || stepped.events.respawned) onEventRef.current?.('respawn')
      if (stepped.events.finish) onEventRef.current?.('finish')
      const collection = collectNearbyCrystals(state, collectedRef.current)
      if (collection.collected.length) {
        collectedRef.current = collection.collectedIds
        onEventRef.current?.('collect', collection.collected)
      }
      progressTimer.current += dt
      if (progressTimer.current > 0.12) {
        progressTimer.current = 0
        onProgressRef.current?.({ progress: Math.max(0, Math.min(100, state.z / PLATFORMER_FINISH_Z * 100)), x: state.x, z: state.z, y: state.y, grounded: state.grounded, respawns: state.respawns })
      }
    }
    stateRef.current = state
    player.position.set(state.x, state.y, state.z)
    if (Math.abs(state.vx) + Math.abs(state.vz) > 0.15) player.rotation.y = Math.atan2(state.vx, state.vz)

    const desiredCamera = cameraTargetRef.current.set(state.x * 0.72, state.y + 4.5, state.z - 8.6)
    camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 3.2))
    cameraFocusRef.current.set(state.x * 0.55, state.y + 0.35, state.z + (finished ? 0.6 : 2.1))
    camera.lookAt(cameraFocusRef.current)
    if (finished) camera.fov = THREE.MathUtils.damp(camera.fov, 42, 2.2, dt)
    else camera.fov = THREE.MathUtils.damp(camera.fov, 49, 2.2, dt)
    camera.updateProjectionMatrix()
  })

  return <>
    <color attach="background" args={[SKY]} />
    <fog attach="fog" args={['#b5e9ef', 24, 62]} />
    <ambientLight intensity={1.25} color="#fff5db" />
    <hemisphereLight args={['#e8fbff', '#718b88', 1.2]} />
    <directionalLight position={[-7, 13, 8]} intensity={2.3} color="#fff3d5" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-13} shadow-camera-right={13} shadow-camera-top={18} shadow-camera-bottom={-13} shadow-bias={-0.00015} />
    <directionalLight position={[7, 7, -4]} intensity={0.65} color="#b9c8ff" />
    <DistantIslands />
    {PLATFORMER_PLATFORMS.map((platform) => <IslandPlatform key={platform.id} platform={platform} color={teamColor} />)}
    {PLATFORMER_CRYSTALS.map((crystal) => <Crystal key={crystal.id} crystal={crystal} color={teamColor} collected={collectedIds.has(crystal.id)} />)}
    <WindWheel />
    <QuizGate answerFeedback={answerFeedback} />
    <PlayerAvatar playerRef={playerRef} color={teamColor} finished={finished} stateRef={stateRef} landingPulseRef={landingPulseRef} />
    <FinishConfetti active={finished} />
  </>
}

function LobbyAvatar({ position, color, index }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2.1 + index) * 0.07
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.65 + index) * 0.12
  })
  return <group ref={ref} position={position}>
    <mesh position={[0, 0.62, 0]} castShadow><capsuleGeometry args={[0.38, 0.42, 4, 9]} /><meshStandardMaterial color={color} roughness={0.45} /></mesh>
    <mesh position={[0, 1.04, 0.08]}><sphereGeometry args={[0.28, 14, 10]} /><meshStandardMaterial color="#ffe4c5" roughness={0.55} /></mesh>
    <mesh position={[-0.1, 1.07, 0.32]}><sphereGeometry args={[0.04, 9, 7]} /><meshBasicMaterial color="#34405a" /></mesh>
    <mesh position={[0.1, 1.07, 0.32]}><sphereGeometry args={[0.04, 9, 7]} /><meshBasicMaterial color="#34405a" /></mesh>
    <mesh position={[0, 1.42, 0]}><sphereGeometry args={[0.11, 10, 8]} /><meshStandardMaterial color="#ffcf65" emissive="#9b6b23" emissiveIntensity={0.3} /></mesh>
  </group>
}

function LobbyPodiums({ teams }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0, 5.3, 10.5)
    camera.lookAt(0, 1, 0)
  }, [camera])
  return <>
    <color attach="background" args={['#253c78']} />
    <fog attach="fog" args={['#526bb0', 13, 29]} />
    <ambientLight intensity={1.35} />
    <hemisphereLight args={['#e8f8ff', '#65467c', 0.8]} />
    <directionalLight position={[-5, 9, 6]} intensity={2} color="#fff0cf" />
    <SkyCloud position={[-7, 5, 2]} scale={1.2} />
    <SkyCloud position={[7, 5.5, -2]} scale={1.5} />
    {teams.map((team, index) => {
      const gap = Math.min(2.15, 13 / Math.max(teams.length, 5))
      const x = (index - (teams.length - 1) / 2) * gap
      const color = TEAM_COLORS[team.token] || '#a99aff'
      return <group key={team.id} position={[x, 0, 0]}>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.78, 0.9, 0.5, 10]} /><meshStandardMaterial color={color} metalness={0.25} roughness={0.4} /></mesh>
        <mesh position={[0, 0.53, 0]}><torusGeometry args={[0.69, 0.045, 7, 24]} /><meshStandardMaterial color="#fff0a7" emissive="#e9bb58" emissiveIntensity={0.4} /></mesh>
        <LobbyAvatar position={[0, 0.57, 0]} color={color} index={index} />
        <mesh position={[0, 1.95, 0]}><sphereGeometry args={[0.07, 8, 7]} /><meshBasicMaterial color="#fff1ab" /></mesh>
      </group>
    })}
  </>
}

function VirtualJoystick({ inputRef, enabled }) {
  const activePointer = useRef(null)
  const update = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.34)
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.34)
    const length = Math.hypot(dx, dy)
    const scale = length > 1 ? 1 / length : 1
    inputRef.current.joystickX = dx * scale
    inputRef.current.joystickZ = -dy * scale
    inputRef.current.x = inputRef.current.keyX + inputRef.current.joystickX
    inputRef.current.z = inputRef.current.keyZ + inputRef.current.joystickZ
    const knob = event.currentTarget.querySelector('.qp-joystick-knob')
    if (knob) knob.style.transform = `translate(${inputRef.current.joystickX * 19}px, ${-inputRef.current.joystickZ * 19}px)`
  }
  const clear = () => {
    activePointer.current = null
    inputRef.current.joystickX = 0
    inputRef.current.joystickZ = 0
    inputRef.current.x = inputRef.current.keyX
    inputRef.current.z = inputRef.current.keyZ
    const knob = document.querySelector('.qp-joystick-knob')
    if (knob) knob.style.transform = ''
  }
  return <div className={`qp-joystick${enabled ? '' : ' disabled'}`} role="application" aria-label="Joystick di chuyển" onPointerDown={(event) => { if (!enabled) return; activePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event) }} onPointerMove={(event) => { if (activePointer.current === event.pointerId) update(event) }} onPointerUp={clear} onPointerCancel={clear}>
    <span className="qp-joystick-ring"><i className="qp-joystick-knob" /></span><span className="qp-control-caption">DI CHUYỂN</span>
  </div>
}

export function PlatformerLobbyStage({ teams = [], quality = 'high' }) {
  return <div className="qp-lobby-3d" aria-label="Sân khấu 3D cùng linh vật các đội">
    <Canvas dpr={quality === 'low' ? 1 : [1, 1.25]} shadows={quality !== 'low'} camera={{ position: [0, 5.3, 10.5], fov: 48 }} gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }} fallback={<div className="qp-webgl-fallback">WebGL chưa khả dụng trên thiết bị này.</div>}>
      <LobbyPodiums teams={teams.slice(0, 8)} />
    </Canvas>
    <span className="qp-lobby-3d-caption">CÁC ĐỘI ĐÃ SẴN SÀNG</span>
  </div>
}

export default function QuizPartyPlatformer({ activeTeam, canControl, quality = 'high', answerFeedback = null, finished = false, winnerName = '', questionIndex = 0, totalQuestions = 1 }) {
  const inputRef = useRef({ x: 0, z: 0, keyX: 0, keyZ: 0, joystickX: 0, joystickZ: 0, jump: false, run: false })
  const keysRef = useRef(new Set())
  const [collectedIds, setCollectedIds] = useState(() => new Set())
  const [hud, setHud] = useState({ progress: 0, x: 0, z: 0, grounded: true, respawns: 0 })
  const [toast, setToast] = useState('')
  const [finishReached, setFinishReached] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const toastTimer = useRef(null)
  const audioContextRef = useRef(null)
  const lastFeedbackRef = useRef(answerFeedback)
  const collectedCount = collectedIds.size
  const teamColor = TEAM_COLORS[activeTeam?.token] || '#9e8cff'
  const playTone = useCallback((event) => {
    const audio = audioContextRef.current
    if (!soundEnabled || !audio || audio.state !== 'running') return
    const tones = { jump: [520, 0.11], land: [205, 0.09], collect: [790, 0.14], checkpoint: [610, 0.22], respawn: [165, 0.2], finish: [930, 0.3], correct: [850, 0.18], wrong: [260, 0.18] }
    const [frequency, duration] = tones[event] || []
    if (!frequency) return
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = event === 'respawn' || event === 'wrong' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * (event === 'jump' ? 1.5 : 1.18)), audio.currentTime + duration)
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.start()
    oscillator.stop(audio.currentTime + duration)
  }, [soundEnabled])
  const toggleSound = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const audio = audioContextRef.current || new AudioContextClass()
    audioContextRef.current = audio
    if (soundEnabled) { audio.suspend().catch(() => {}); setSoundEnabled(false) }
    else { audio.resume().catch(() => {}); setSoundEnabled(true) }
  }
  const onGameEvent = useCallback((event, amount = 1) => {
    playTone(event)
    if (event === 'collect') {
      setCollectedIds((current) => {
        const next = new Set(current)
        ;(Array.isArray(amount) ? amount : []).forEach((id) => next.add(id))
        return next
      })
      setToast('Tinh thể đã thu thập · không cộng vào điểm trận')
    } else if (event === 'checkpoint') setToast('Checkpoint đã kích hoạt')
    else if (event === 'respawn') setToast('Gió mạnh! Đã hồi sinh tại checkpoint')
    else if (event === 'finish') { setFinishReached(true); setToast('Đã chạm cổng đích · điểm và thứ hạng vẫn theo máy chủ') }
    if (event === 'collect' || event === 'checkpoint' || event === 'respawn' || event === 'finish') {
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(''), 1900)
    }
  }, [playTone])
  const syncKeys = useCallback(() => {
    const keys = keysRef.current
    const keyX = Number(keys.has('right')) - Number(keys.has('left'))
    const keyZ = Number(keys.has('forward')) - Number(keys.has('back'))
    inputRef.current.keyX = keyX
    inputRef.current.keyZ = keyZ
    inputRef.current.x = keyX + inputRef.current.joystickX
    inputRef.current.z = keyZ + inputRef.current.joystickZ
    inputRef.current.run = keys.has('run')
  }, [])

  useEffect(() => {
    if (!canControl || finished) {
      keysRef.current.clear()
      inputRef.current.x = 0
      inputRef.current.z = 0
      inputRef.current.keyX = 0
      inputRef.current.keyZ = 0
      inputRef.current.joystickX = 0
      inputRef.current.joystickZ = 0
      inputRef.current.jump = false
      inputRef.current.run = false
      return undefined
    }
    const onKeyDown = (event) => {
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return
      const direction = KEY_DIRECTIONS[event.key]
      if (direction) {
        event.preventDefault()
        keysRef.current.add(direction)
        syncKeys()
      } else if (event.key === 'Shift') { keysRef.current.add('run'); syncKeys() }
      else if (event.code === 'Space') { event.preventDefault(); inputRef.current.jump = true }
    }
    const onKeyUp = (event) => {
      const direction = KEY_DIRECTIONS[event.key]
      if (direction) { keysRef.current.delete(direction); syncKeys() }
      else if (event.key === 'Shift') { keysRef.current.delete('run'); syncKeys() }
      else if (event.code === 'Space') inputRef.current.jump = false
    }
    const onBlur = () => { keysRef.current.clear(); inputRef.current.jump = false; syncKeys() }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur) }
  }, [canControl, finished, syncKeys])
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  useEffect(() => () => { audioContextRef.current?.close().catch(() => {}) }, [])
  useEffect(() => {
    if (lastFeedbackRef.current !== answerFeedback) {
      if (answerFeedback === true) playTone('correct')
      else if (answerFeedback === false) playTone('wrong')
      lastFeedbackRef.current = answerFeedback
    }
  }, [answerFeedback, playTone])

  const jumpDown = (event) => { if (!canControl || finished) return; event.preventDefault(); inputRef.current.jump = true }
  const jumpUp = () => { inputRef.current.jump = false }
  const answerLabel = answerFeedback === true ? 'Đáp án đúng · cổng thử thách phát sáng' : answerFeedback === false ? 'Đáp án đã được máy chủ xác nhận · thử lối an toàn' : 'Trả lời câu hỏi để nhận phản hồi trên cổng thử thách'

  return <section className={`qp-platformer${finished ? ' is-finished' : ''}`} aria-label="Game platformer 3D Quiz Party">
    <div className="qp-platformer-hud">
      <div><span className="qp-hud-eyebrow">ĐẢO MÂY · HÀNH TRÌNH 3D</span><strong>{finished ? 'ĐƯỜNG ĐUA HOÀN TẤT' : `CHẶNG ${Math.min(questionIndex + 1, totalQuestions)} / ${totalQuestions}`}</strong></div>
      {!finished && <div className="qp-progress-block"><span>TIẾN TRÌNH CỤC BỘ</span><div className="qp-progress-track"><i style={{ width: `${hud.progress}%`, background: teamColor }} /></div><b>{Math.round(hud.progress)}%</b></div>}
      <div className="qp-crystal-count" aria-label={`${collectedCount} tinh thể, không cộng điểm`}><span>✦</span><b>{collectedCount}/{PLATFORMER_CRYSTALS.length}</b><small>tinh thể</small></div>
      <button className="qp-audio-toggle" type="button" onClick={toggleSound} aria-pressed={soundEnabled} aria-label={soundEnabled ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh'} title="Âm thanh tắt mặc định; chỉ phát sau khi bạn bật">{soundEnabled ? '♫' : '♪'}<small>{soundEnabled ? 'SFX BẬT' : 'SFX TẮT'}</small></button>
    </div>
    <div className="qp-platformer-stage">
      <Canvas dpr={quality === 'low' ? 1 : [1, 1.35]} shadows={quality !== 'low'} camera={{ position: [0, 5, -8], fov: 49, near: 0.1, far: 100 }} gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false }} fallback={<div className="qp-webgl-fallback"><strong>Thiết bị chưa hỗ trợ WebGL</strong><span>Phần câu hỏi và bảng điểm vẫn hoạt động bình thường.</span></div>}>
        <WorldScene inputRef={inputRef} teamColor={teamColor} onGameEvent={onGameEvent} answerFeedback={answerFeedback} finished={finished} collectedIds={collectedIds} onProgress={setHud} />
      </Canvas>
      <div className="qp-platformer-banner"><span className="qp-live-dot" />{finished ? `NHÀ VÔ ĐỊCH: ${winnerName || 'Đội chiến thắng'}` : canControl ? `ĐANG ĐIỀU KHIỂN · ${activeTeam?.name || 'Đội hiện tại'}` : `ĐANG ĐẾN LƯỢT · ${activeTeam?.name || 'đội khác'}`}</div>
      {!finished && <>
        <div className="qp-platformer-objective"><b>{finishReached ? 'ĐÃ TỚI ĐÍCH' : 'MỤC TIÊU'}</b><span>{finishReached ? 'Hoàn thành câu hỏi để xác nhận điểm và thứ hạng.' : 'Vượt đảo · chạm trạm câu hỏi · về cổng đích'}</span><small>{answerLabel}</small></div>
        <VirtualJoystick inputRef={inputRef} enabled={canControl} />
        <button type="button" className={`qp-jump-button${canControl ? '' : ' disabled'}`} disabled={!canControl} onPointerDown={jumpDown} onPointerUp={jumpUp} onPointerCancel={jumpUp} onPointerLeave={jumpUp} aria-label="Nhảy"><span>↑</span><b>NHẢY</b></button>
        <div className="qp-desktop-hint">WASD / phím mũi tên · Space nhảy · Shift chạy</div>
      </>}
      {toast && !finished && <div className="qp-platformer-toast" role="status">{toast}</div>}
      {finished && <div className="qp-victory-stamp"><span>✦</span><b>CHIẾN THẮNG</b><small>Kết quả và điểm do máy chủ xác nhận</small></div>}
    </div>
    <p className="qp-platformer-note">Di chuyển và vật phẩm là trải nghiệm tại trình duyệt này, không thay đổi điểm số. Câu trả lời và bảng xếp hạng vẫn do máy chủ xác nhận.</p>
  </section>
}
