import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mazePosition, normalizeMaze } from '../../lib/maze.js'

const TEAM_COLORS = { blue: '#6d9dff', green: '#67e5b0', purple: '#c09aff', orange: '#ffb56f', pink: '#ff91bb', cyan: '#70e6f5', red: '#ff7c80', gold: '#f7d277' }
const DEBUG_FULL_LIGHT = true
const PLAYER_MOVE_DURATION_MS = 75
const WALL_COLORS = ['#8a5a36', '#7d4f2e', '#94643c', '#86563a']
const WALL_DETAIL_COLOR = '#4e2f1a'
const FLOOR_COLORS = ['#4a3524', '#523a28']

function MazeWalls({ maze }) {
  const meshRef = useRef(null)
  const wallGeometry = useMemo(() => new RoundedBoxGeometry(1, 1.25, 0.18, 2, 0.06), [])
  const { wallMatrices, wallDetails } = useMemo(() => {
    const matrices = []
    const details = []
    maze.cells.forEach((cell) => {
      const x = cell.x - maze.width / 2 + 0.5
      const z = cell.y - maze.height / 2 + 0.5
      const addWall = (wallX, wallZ, rotationY) => {
        matrices.push([wallX, 0.62, wallZ, rotationY])
        ;[0.29, 0.63, 0.97].forEach((y) => {
          const faceOffset = rotationY ? 0.105 : 0
          const sideOffset = rotationY ? 0 : 0.105
          details.push([wallX - sideOffset, y, wallZ - faceOffset, rotationY])
          details.push([wallX + sideOffset, y, wallZ + faceOffset, rotationY])
        })
      }
      if (cell.walls.n) addWall(x, z - 0.5, 0)
      if (cell.walls.s) addWall(x, z + 0.5, 0)
      if (cell.walls.w) addWall(x - 0.5, z, Math.PI / 2)
      if (cell.walls.e) addWall(x + 0.5, z, Math.PI / 2)
    })
    return { wallMatrices: matrices, wallDetails: details }
  }, [maze])
  const wallColors = useMemo(() => wallMatrices.map((_, index) => WALL_COLORS[index % WALL_COLORS.length]), [wallMatrices])
  useEffect(() => {
    if (!meshRef.current) return
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()
    wallMatrices.forEach(([x, y, z, rotationY], index) => {
      matrix.makeRotationY(rotationY)
      matrix.setPosition(x, y, z)
      meshRef.current.setMatrixAt(index, matrix)
      color.set(wallColors[index])
      meshRef.current.setColorAt(index, color)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true
  }, [wallMatrices, wallColors])
  return <><instancedMesh ref={meshRef} args={[wallGeometry, null, wallMatrices.length]} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={0.9} metalness={0.02} /></instancedMesh><WallDetails matrices={wallDetails} /></>
}

function WallDetails({ matrices }) {
  const meshRef = useRef(null)
  useEffect(() => {
    if (!meshRef.current) return
    const matrix = new THREE.Matrix4()
    matrices.forEach(([x, y, z, rotationY], index) => {
      matrix.makeRotationY(rotationY)
      matrix.setPosition(x, y, z)
      meshRef.current.setMatrixAt(index, matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [matrices])
  return <instancedMesh ref={meshRef} args={[null, null, matrices.length]}><boxGeometry args={[0.62, 0.026, 0.018]} /><meshStandardMaterial color={WALL_DETAIL_COLOR} roughness={0.78} metalness={0.04} /></instancedMesh>
}

function Torch({ active }) {
  const flameRef = useRef(null)
  const haloRef = useRef(null)
  const lightRef = useRef(null)
  const baseIntensity = active ? 16 : 5
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pulse = 1 + Math.sin(t * 11) * 0.1 + Math.sin(t * 17) * 0.06
    if (flameRef.current) flameRef.current.scale.set(1.1 * pulse, 1.7 * pulse, 1.1 * pulse)
    if (haloRef.current) haloRef.current.scale.setScalar(pulse * (active ? 1.25 : 0.9))
    if (lightRef.current) lightRef.current.intensity = baseIntensity * (0.9 + (pulse - 1) * 1.6)
  })
  return <group position={[0.27, 0.55, -0.08]}>
    <mesh rotation={[0, 0, -0.35]} castShadow><cylinderGeometry args={[0.03, 0.04, 0.3, 6]} /><meshStandardMaterial color="#6e4329" /></mesh>
    <mesh ref={flameRef} position={[0.04, 0.19, 0]} scale={[1.1, 1.7, 1.1]}><dodecahedronGeometry args={[0.1, 0]} /><meshBasicMaterial color="#fff1a8" /></mesh>
    <mesh ref={haloRef} position={[0.04, 0.2, 0]}><sphereGeometry args={[0.34, 16, 12]} /><meshBasicMaterial color="#ffa733" transparent opacity={active ? 0.32 : 0.18} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <pointLight ref={lightRef} position={[0.04, 0.25, 0]} color="#ffb04a" intensity={baseIntensity} distance={active ? 6.5 : 3.5} decay={1.6} />
  </group>
}

function Player({ team, active }) {
  const position = mazePosition(team)
  const x = position.x - 4
  const z = position.y - 4
  const groupRef = useRef(null)
  const visualPosition = useRef(new THREE.Vector3(x, 0.42, z))
  const moveFrom = useRef(new THREE.Vector3(x, 0.42, z))
  const moveTo = useRef(new THREE.Vector3(x, 0.42, z))
  const moveStartedAt = useRef(0)
  const color = TEAM_COLORS[team.token] || '#fff'

  useEffect(() => {
    moveFrom.current.copy(visualPosition.current)
    moveTo.current.set(x, 0.42, z)
    moveStartedAt.current = performance.now()
  }, [x, z])

  useFrame(() => {
    const progress = Math.min(1, (performance.now() - moveStartedAt.current) / PLAYER_MOVE_DURATION_MS)
    const easedProgress = 1 - ((1 - progress) ** 3)
    visualPosition.current.lerpVectors(moveFrom.current, moveTo.current, easedProgress)
    if (groupRef.current) groupRef.current.position.copy(visualPosition.current)
  })

  return <group ref={groupRef} position={[x, 0.42, z]} scale={active ? 1.08 : 0.92}><mesh castShadow><cylinderGeometry args={[0.24, 0.3, 0.62, 6]} /><meshStandardMaterial color={color} emissive={active ? color : '#111522'} emissiveIntensity={active ? 0.55 : 0.12} roughness={0.55} /></mesh><mesh position={[0, 0.38, 0]} castShadow><sphereGeometry args={[0.16, 10, 8]} /><meshStandardMaterial color="#f0c4a0" roughness={0.9} /></mesh><Torch active={active} /></group>
}

function Floor({ maze }) {
  const tiles = useMemo(() => Array.from({ length: maze.width * maze.height }, (_, index) => { const x = index % maze.width - maze.width / 2 + 0.5; const z = Math.floor(index / maze.width) - maze.height / 2 + 0.5; return [x, z] }), [maze])
  return <><mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[maze.width, maze.height]} /><meshStandardMaterial color="#2e2016" roughness={0.96} /></mesh>{tiles.map(([x, z], index) => <mesh key={index} position={[x, -0.065, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[0.92, 0.92]} /><meshStandardMaterial color={index % 2 ? FLOOR_COLORS[0] : FLOOR_COLORS[1]} roughness={0.98} /></mesh>)}</>
}

function ExitMarker({ maze }) {
  const exitX = maze.exit.x - 4
  const exitZ = maze.exit.y - 4
  return <group position={[exitX, 0.08, exitZ]}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.28, 0.43, 12]} /><meshBasicMaterial color="#f7ce72" transparent opacity={0.72} /></mesh><mesh position={[0, 0.42, 0]}><torusGeometry args={[0.28, 0.045, 8, 16, Math.PI]} /><meshBasicMaterial color="#ffe6a0" /></mesh><pointLight color="#f6b94b" intensity={0.35} distance={1.6} decay={2} /></group>
}

function MazeContent({ maze, teams, currentTeamId, quality }) {
  return <><ambientLight intensity={DEBUG_FULL_LIGHT ? 1.5 : quality === 'low' ? 0.035 : 0.055} color={DEBUG_FULL_LIGHT ? '#ffffff' : '#536487'} /><directionalLight position={[-3, 8, 4]} intensity={DEBUG_FULL_LIGHT ? 2.2 : quality === 'low' ? 0.06 : 0.1} color={DEBUG_FULL_LIGHT ? '#ffffff' : '#a5b9e8'} castShadow={!DEBUG_FULL_LIGHT && quality !== 'low'} shadow-mapSize={[256, 256]} />{DEBUG_FULL_LIGHT && <directionalLight position={[4, 6, -5]} intensity={0.8} color="#ffffff" />}<MazeWalls maze={maze} /><Floor maze={maze} /><ExitMarker maze={maze} />{teams.map((team) => <Player key={team.id} team={team} active={team.id === currentTeamId} />)}</>
}

export default function MazeScene({ maze: rawMaze, teams = [], currentTeamId, quality = 'high' }) {
  const maze = normalizeMaze(rawMaze)
  if (!maze) return <div className="maze-fallback">Đang dựng mê cung…</div>
  const isLowQuality = quality === 'low'
  const cameraPosition = [0, 14, 0.01]
  const cameraFov = 45
  return <div className={`maze-canvas maze-quality-${quality}`} aria-label="Mê cung 3D Treasure Race"><Canvas camera={{ position: cameraPosition, fov: cameraFov }} shadows={!DEBUG_FULL_LIGHT && !isLowQuality} dpr={isLowQuality ? 1 : [1, 1.25]} gl={{ antialias: !isLowQuality, powerPreference: 'high-performance' }}><color attach="background" args={[DEBUG_FULL_LIGHT ? '#dce8f5' : '#08101d']} />{!DEBUG_FULL_LIGHT && <fog attach="fog" args={['#08101d', 3.8, 11.5]} />}<MazeContent maze={maze} teams={teams} currentTeamId={currentTeamId} quality={quality} /></Canvas></div>
}
