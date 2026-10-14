import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../lib/boltSort.js'
import './bolt-sort-3d.css'

const ROD_GAP = 0.7
const NUT_PITCH = 0.16
const NUT_HEIGHT = 0.14
const NUT_RADIUS = 0.228
const NUT_HOLE_RADIUS = 0.073
const MOVE_DURATION = 560

function supportsWebGL() {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!context) return false
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

function hexShape(radius, holeRadius = 0) {
  const shape = new THREE.Shape()
  for (let index = 0; index < 6; index += 1) {
    const angle = Math.PI / 6 + index * Math.PI / 3
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    if (index === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  }
  shape.closePath()
  if (holeRadius > 0) {
    const hole = new THREE.Path()
    hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true)
    shape.holes.push(hole)
  }
  return shape
}

function extrudedGeometry(shape, depth, bevelSize, bevelThickness) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize,
    bevelThickness,
    curveSegments: 24,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, -depth / 2, 0)
  geometry.computeVertexNormals()
  return geometry
}

function roundedPlateGeometry(width, depth, thickness, bevelSize) {
  const radius = 0.15
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2 + radius, -depth / 2)
  shape.lineTo(width / 2 - radius, -depth / 2)
  shape.quadraticCurveTo(width / 2, -depth / 2, width / 2, -depth / 2 + radius)
  shape.lineTo(width / 2, depth / 2 - radius)
  shape.quadraticCurveTo(width / 2, depth / 2, width / 2 - radius, depth / 2)
  shape.lineTo(-width / 2 + radius, depth / 2)
  shape.quadraticCurveTo(-width / 2, depth / 2, -width / 2, depth / 2 - radius)
  shape.lineTo(-width / 2, -depth / 2 + radius)
  shape.quadraticCurveTo(-width / 2, -depth / 2, -width / 2 + radius, -depth / 2)
  return extrudedGeometry(shape, thickness, bevelSize, bevelSize * 0.7)
}

function ringGeometry(outerRadius, innerRadius, thickness, bevelSize = 0.008) {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  return extrudedGeometry(shape, thickness, bevelSize, bevelSize * 0.6)
}

function nutGeometry() {
  return extrudedGeometry(hexShape(NUT_RADIUS, NUT_HOLE_RADIUS), NUT_HEIGHT - 0.024, 0.018, 0.012)
}

function hexHeadGeometry() {
  return extrudedGeometry(hexShape(0.155), 0.09, 0.012, 0.009)
}

function helixGeometry(height) {
  const turns = Math.max(7, Math.ceil(height / 0.13))
  const segments = turns * 20
  const points = []
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments
    const angle = progress * turns * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(angle) * 0.052, progress * height, Math.sin(angle) * 0.052))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, 0.011, 5, false)
}

function mysteryMarkGeometry() {
  const points = [
    new THREE.Vector3(0.105, 0.078, -0.055),
    new THREE.Vector3(0.147, 0.078, -0.062),
    new THREE.Vector3(0.166, 0.078, -0.025),
    new THREE.Vector3(0.145, 0.078, 0.005),
    new THREE.Vector3(0.12, 0.078, 0.025),
    new THREE.Vector3(0.12, 0.078, 0.048),
  ]
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.009, 5, false)
}

function createResources(width, depth, rodHeight) {
  const materials = {
    board: new THREE.MeshPhysicalMaterial({ color: '#17212b', metalness: 0.48, roughness: 0.36, clearcoat: 0.42, clearcoatRoughness: 0.3 }),
    boardTop: new THREE.MeshPhysicalMaterial({ color: '#293640', metalness: 0.38, roughness: 0.4, clearcoat: 0.35 }),
    frame: new THREE.MeshStandardMaterial({ color: '#aeb9c1', metalness: 0.48, roughness: 0.24 }),
    rod: new THREE.MeshPhysicalMaterial({ color: '#c5cfd5', metalness: 0.42, roughness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    thread: new THREE.MeshStandardMaterial({ color: '#e5ebef', metalness: 0.56, roughness: 0.22 }),
    socket: new THREE.MeshStandardMaterial({ color: '#111820', metalness: 0.34, roughness: 0.36 }),
    washer: new THREE.MeshPhysicalMaterial({ color: '#c0cbd1', metalness: 0.58, roughness: 0.22, clearcoat: 0.36 }),
    question: new THREE.MeshStandardMaterial({ color: '#1d2730', metalness: 0.25, roughness: 0.52 }),
    selected: new THREE.MeshPhysicalMaterial({ color: '#80eca7', metalness: 0.56, roughness: 0.21, emissive: '#167945', emissiveIntensity: 0.25 }),
    hiddenNut: new THREE.MeshPhysicalMaterial({ color: '#b5c1c7', metalness: 0.42, roughness: 0.23, clearcoat: 0.4 }),
    ground: new THREE.MeshStandardMaterial({ color: '#10161d', metalness: 0.18, roughness: 0.62 }),
    hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false, side: THREE.DoubleSide }),
  }
  for (const color of PALETTE) {
    materials[color] = new THREE.MeshPhysicalMaterial({ color, metalness: 0.28, roughness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.2 })
  }
  return {
    width,
    depth,
    boardGeometry: roundedPlateGeometry(width, depth, 0.2, 0.045),
    topGeometry: roundedPlateGeometry(width - 0.2, depth - 0.2, 0.028, 0.012),
    frontRailGeometry: new THREE.BoxGeometry(width - 0.36, 0.07, 0.055),
    sideRailGeometry: new THREE.BoxGeometry(0.055, 0.07, depth - 0.34),
    fastenerGeometry: new THREE.CylinderGeometry(0.043, 0.043, 0.026, 16),
    socketGeometry: ringGeometry(0.172, 0.061, 0.05),
    washerGeometry: ringGeometry(0.126, 0.055, 0.028),
    headGeometry: hexHeadGeometry(),
    shaftGeometry: new THREE.CylinderGeometry(0.043, 0.043, rodHeight, 24),
    threadGeometry: helixGeometry(rodHeight),
    nutGeometry: nutGeometry(),
    hitGeometry: new THREE.CylinderGeometry(0.235, 0.235, rodHeight + 0.26, 16),
    completeRingGeometry: new THREE.TorusGeometry(0.205, 0.009, 6, 40),
    labelGeometry: new THREE.BoxGeometry(0.16, 0.014, 0.025),
    mysteryGeometry: mysteryMarkGeometry(),
    mysteryDotGeometry: new THREE.SphereGeometry(0.012, 8, 6),
    groundGeometry: new THREE.PlaneGeometry(width + 4, depth + 4),
    materials,
  }
}

function disposeResources(resources) {
  for (const [key, value] of Object.entries(resources)) {
    if (key === 'materials') continue
    value?.dispose?.()
  }
  for (const material of Object.values(resources.materials)) material.dispose()
}

function SceneCamera({ width, depth, height }) {
  const { camera, size } = useThree()
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const narrow = size.width < 430
    const fov = narrow ? 38 : 35
    const aspect = size.width / Math.max(size.height, 1)
    const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(fov / 2))
    const fitWidth = (width * 1.13) / (2 * halfFovTangent * aspect)
    const fitHeight = ((height + depth * 0.55) * 1.1) / (2 * halfFovTangent)
    const distance = Math.max(fitWidth, fitHeight)
    camera.position.set(0, distance * 0.57, distance * 0.82)
    camera.lookAt(0, height * 0.42, 0)
    camera.fov = fov
    camera.near = 0.1
    camera.far = 80
    camera.aspect = size.width / Math.max(size.height, 1)
    camera.updateProjectionMatrix()
  }, [camera, depth, height, size.height, size.width, width])
  return null
}

function Board({ scene, materials }) {
  const fastenerPositions = useMemo(() => [
    [-scene.width / 2 + 0.17, -scene.depth / 2 + 0.17],
    [scene.width / 2 - 0.17, -scene.depth / 2 + 0.17],
    [-scene.width / 2 + 0.17, scene.depth / 2 - 0.17],
    [scene.width / 2 - 0.17, scene.depth / 2 - 0.17],
  ], [scene.depth, scene.width])
  return <group>
    <mesh geometry={scene.groundGeometry} material={materials.ground} position={[0, -0.27, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow dispose={null}/>
    <mesh geometry={scene.boardGeometry} material={materials.board} position={[0, -0.132, 0]} castShadow receiveShadow dispose={null}/>
    <mesh geometry={scene.topGeometry} material={materials.boardTop} position={[0, 0.022, 0]} castShadow receiveShadow dispose={null}/>
    {[-1, 1].map((side) => <mesh key={`front-${side}`} geometry={scene.frontRailGeometry} material={materials.frame} position={[0, -0.16, side * (scene.depth / 2 - 0.08)]} castShadow dispose={null}/>)}
    {[-1, 1].map((side) => <mesh key={`side-${side}`} geometry={scene.sideRailGeometry} material={materials.frame} position={[side * (scene.width / 2 - 0.08), -0.16, 0]} castShadow dispose={null}/>)}
    {fastenerPositions.map(([x, z], index) => <mesh key={index} geometry={scene.fastenerGeometry} material={materials.frame} position={[x, 0.061, z]} castShadow dispose={null}/>)}
  </group>
}

function Nut({ bolt, selected, y, geometry, materials, mysteryGeometry, mysteryDotGeometry, interactive, onClick }) {
  const group = useRef(null)
  const colorMaterial = bolt.revealed ? (materials[bolt.color] || materials.rod) : materials.hiddenNut
  useFrame((state, delta) => {
    if (!group.current) return
    const targetY = y + (selected ? 0.115 : 0)
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, targetY, 13, delta)
    const targetRotation = selected ? Math.sin(state.clock.elapsedTime * 3.5) * 0.045 : 0
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetRotation, 10, delta)
  })
  return <group ref={group} position={[0, y, 0]} dispose={null}>
    <mesh geometry={geometry} material={colorMaterial} castShadow receiveShadow dispose={null} onClick={interactive ? (event) => { event.stopPropagation(); onClick() } : undefined}/>
    {!bolt.revealed && <group>
      <mesh geometry={mysteryGeometry} material={materials.question} dispose={null}/>
      <mesh geometry={mysteryDotGeometry} material={materials.question} position={[0.12, 0.078, 0.083]} dispose={null}/>
    </group>}
  </group>
}

function Rod({ index, stack, x, capacity, selected, shaking, complete, interactive, onClick, scene, materials }) {
  const group = useRef(null)
  const shakeStart = useRef(0)
  const rodHeight = 0.32 + capacity * NUT_PITCH
  const nutBase = 0.23
  useLayoutEffect(() => {
    if (shaking) shakeStart.current = performance.now()
  }, [shaking])
  useFrame((state, delta) => {
    if (!group.current) return
    if (shaking) {
      const progress = Math.min(1, (performance.now() - shakeStart.current) / 420)
      group.current.position.x = x + Math.sin(progress * Math.PI * 9) * (1 - progress) * 0.075
    } else {
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, x, 15, delta)
    }
  })
  const topBoltId = stack[stack.length - 1]?.id
  const movingBoltIds = scene.moveAnimation?.teamId === scene.teamId && scene.moveAnimation.toRod === index
    ? new Set(scene.moveAnimation.bolts.map(({ bolt }) => bolt.id))
    : null
  return <group ref={group} position={[x, 0, 0]} dispose={null}>
    <mesh geometry={scene.socketGeometry} material={materials.socket} position={[0, 0.045, 0]} castShadow receiveShadow dispose={null}/>
    <mesh geometry={scene.washerGeometry} material={selected || complete ? materials.selected : materials.washer} position={[0, 0.087, 0]} castShadow receiveShadow dispose={null}/>
    <mesh geometry={scene.headGeometry} material={materials.frame} position={[0, 0.155, 0]} castShadow receiveShadow dispose={null}/>
    <mesh geometry={scene.shaftGeometry} material={materials.rod} position={[0, rodHeight / 2 + 0.075, 0]} castShadow receiveShadow dispose={null}/>
    <mesh geometry={scene.threadGeometry} material={materials.thread} position={[0, 0.075, 0]} castShadow receiveShadow dispose={null}/>
    <mesh geometry={scene.hitGeometry} material={materials.hit} position={[0, rodHeight / 2 + 0.08, 0]} dispose={null} onClick={interactive ? (event) => { event.stopPropagation(); onClick(index) } : undefined}/>
    {stack.map((bolt, boltIndex) => {
      if (movingBoltIds?.has(bolt.id)) return null
      const isTop = bolt.id === topBoltId
      return <Nut key={bolt.id} bolt={bolt} selected={selected && isTop} y={nutBase + boltIndex * NUT_PITCH} geometry={scene.nutGeometry} materials={materials} mysteryGeometry={scene.mysteryGeometry} mysteryDotGeometry={scene.mysteryDotGeometry} interactive={interactive && isTop} onClick={() => onClick(index)}/>
    })}
    {complete && <mesh geometry={scene.completeRingGeometry} material={materials.selected} position={[0, 0.112, 0]} rotation={[Math.PI / 2, 0, 0]} dispose={null}/>}
    <mesh geometry={scene.labelGeometry} material={materials.frame} position={[0, 0.022, 0.38]} rotation={[-Math.PI / 2, 0, 0]} dispose={null}/>
  </group>
}

function MovingBoltGroup({ animation, scene, materials, onAnimationEnd }) {
  const groups = useRef([])
  const startedAt = useRef(0)
  const ended = useRef(false)
  const fromX = (animation.fromRod - (scene.rodCount - 1) / 2) * ROD_GAP
  const toX = (animation.toRod - (scene.rodCount - 1) / 2) * ROD_GAP
  useLayoutEffect(() => {
    startedAt.current = performance.now()
    ended.current = false
  }, [animation.id])
  useFrame(() => {
    if (ended.current) return
    const progress = Math.min(1, (performance.now() - startedAt.current) / MOVE_DURATION)
    const eased = 1 - (1 - progress) ** 3
    animation.bolts.forEach((movement, index) => {
      const group = groups.current[index]
      if (!group) return
      const startY = 0.23 + movement.fromIndex * NUT_PITCH
      const endY = 0.23 + movement.toIndex * NUT_PITCH
      group.position.set(
        THREE.MathUtils.lerp(fromX, toX, eased),
        THREE.MathUtils.lerp(startY, endY, eased) + Math.sin(Math.PI * eased) * 0.72,
        Math.sin(Math.PI * eased) * 0.1,
      )
      group.rotation.set(0, eased * Math.PI * 2.2, eased * Math.PI * 0.22)
    })
    if (progress >= 1) {
      ended.current = true
      onAnimationEnd(animation.id)
    }
  })
  return <>
    {animation.bolts.map((movement, index) => {
      const colorMaterial = movement.bolt.revealed ? (materials[movement.bolt.color] || materials.rod) : materials.hiddenNut
      const startY = 0.23 + movement.fromIndex * NUT_PITCH
      return <group key={movement.bolt.id} ref={(group) => { groups.current[index] = group }} position={[fromX, startY, 0]} dispose={null}>
        <mesh geometry={scene.nutGeometry} material={colorMaterial} castShadow receiveShadow dispose={null}/>
        {!movement.bolt.revealed && <group>
          <mesh geometry={scene.mysteryGeometry} material={materials.question} dispose={null}/>
          <mesh geometry={scene.mysteryDotGeometry} material={materials.question} position={[0.12, 0.078, 0.083]} dispose={null}/>
        </group>}
      </group>
    })}
  </>
}

function SceneContents({ team, active, selected, shakingRod, level, moveAnimation, onRod, onMoveAnimationEnd }) {
  const rodCount = team.stacks.length
  const width = (rodCount - 1) * ROD_GAP + 0.95
  const depth = 2.45
  const rodHeight = 0.32 + level.capacity * NUT_PITCH
  const scene = useMemo(() => createResources(width, depth, rodHeight), [depth, rodHeight, width])
  useEffect(() => () => disposeResources(scene), [scene])
  const positions = useMemo(() => Array.from({ length: rodCount }, (_, index) => (index - (rodCount - 1) / 2) * ROD_GAP), [rodCount])
  const completeStacks = team.stacks.map((stack) => stack.length === level.capacity && stack.every((bolt) => bolt.color === stack[0]?.color))
  const teamScene = { ...scene, teamId: team.id, rodCount, moveAnimation }
  return <>
    <SceneCamera width={width} depth={depth} height={rodHeight}/>
    <color attach="background" args={['#101720']}/>
    <ambientLight intensity={0.62}/>
    <hemisphereLight args={['#eff7ff', '#303842', 1.1]}/>
    <directionalLight position={[-3.8, 8, 5]} intensity={2.5} castShadow shadow-mapSize-width={768} shadow-mapSize-height={768} shadow-camera-left={-width} shadow-camera-right={width} shadow-camera-top={depth + rodHeight} shadow-camera-bottom={-depth - rodHeight} shadow-bias={-0.00025}/>
    <pointLight position={[4, 3.8, -3]} intensity={20} distance={13} color="#d9e8ff"/>
    <pointLight position={[-4, 2.8, 3]} intensity={12} distance={11} color={active ? team.color : '#a4b1bc'}/>
    <Board scene={scene} materials={scene.materials}/>
    {positions.map((x, index) => <Rod key={`${team.id}-${index}`} index={index} stack={team.stacks[index]} x={x} capacity={level.capacity} selected={active && selected === index} shaking={active && shakingRod === index} complete={completeStacks[index]} interactive={active} onClick={onRod} scene={teamScene} materials={scene.materials}/>) }
    {moveAnimation?.teamId === team.id && <MovingBoltGroup animation={moveAnimation} scene={teamScene} materials={scene.materials} onAnimationEnd={onMoveAnimationEnd}/>}
  </>
}

class SceneErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { console.error('Bolt Sort 3D scene failed; using the accessible board fallback.', error); this.props.onError?.() }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function BoltSort3DScene({ team, active, selected, shakingRod, level, moveAnimation, onRod, onMoveAnimationEnd, fallback }) {
  const [webglAvailable, setWebglAvailable] = useState(null)
  const [canvasElement, setCanvasElement] = useState(null)
  useEffect(() => { setWebglAvailable(supportsWebGL()) }, [])
  const handleCanvasCreated = useCallback(({ gl }) => setCanvasElement(gl.domElement), [])
  const handleSceneError = useCallback(() => setWebglAvailable(false), [])
  useEffect(() => {
    if (!canvasElement || !webglAvailable) return undefined
    const handleContextLost = (event) => {
      event.preventDefault()
      setWebglAvailable(false)
    }
    canvasElement.addEventListener('webglcontextlost', handleContextLost)
    return () => canvasElement.removeEventListener('webglcontextlost', handleContextLost)
  }, [canvasElement, webglAvailable])
  return <div className="bolt-3d-viewport" role="group" aria-label={`Bàn chơi 3D của ${team.name}`}>
    {webglAvailable === null && <div className="bolt-3d-loading" role="status">Đang chuẩn bị bàn 3D…</div>}
    {webglAvailable === false && fallback}
    {webglAvailable && <SceneErrorBoundary fallback={fallback} onError={handleSceneError}>
      <Canvas className="bolt-3d-canvas" onCreated={handleCanvasCreated} dpr={[1, 1.25]} shadows frameloop={active ? 'always' : 'demand'} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} camera={{ fov: 36, near: 0.1, far: 80, position: [0, 7, 9] }} fallback={fallback}>
        <SceneContents team={team} active={active} selected={selected} shakingRod={shakingRod} level={level} moveAnimation={moveAnimation} onRod={onRod} onMoveAnimationEnd={onMoveAnimationEnd}/>
      </Canvas>
    </SceneErrorBoundary>}
  </div>
}
