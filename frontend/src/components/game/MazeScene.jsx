import { Canvas, useFrame } from '@react-three/fiber'
import { renderToStaticMarkup } from 'react-dom/server'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mazePosition, normalizeMaze, shortestPath } from '../../lib/maze.js'
import PetMascot from '../pet/PetMascot.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { EMPTY_OUTFIT, loadOutfit } from '../../lib/petOutfit.js'

const TEAM_COLORS = { blue: '#6d9dff', green: '#67e5b0', purple: '#c09aff', orange: '#ffb56f', pink: '#ff91bb', cyan: '#70e6f5', red: '#ff7c80', gold: '#f7d277' }
const PLAYER_MOVE_DURATION_MS = 75
const WALL_COLORS = ['#8a5a36', '#7d4f2e', '#94643c', '#86563a']
const WALL_DETAIL_COLOR = '#4e2f1a'
const FLOOR_COLORS = ['#4a3524', '#523a28']

// Ánh sáng: lúc chơi chỉ có lửa đuốc màu đỏ, hết game thì bật đèn (sáng dần).
const TORCH_COLOR = '#ff4a1c'
const BG_DARK = new THREE.Color('#050206')
const BG_LIGHT = new THREE.Color('#dce8f5')
const AMBIENT_DARK = new THREE.Color('#ff5a2a')
const AMBIENT_LIGHT = new THREE.Color('#ffffff')
const LIGHT_FADE_SPEED = 1.8

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
  return <><instancedMesh ref={meshRef} args={[wallGeometry, null, wallMatrices.length]} receiveShadow><meshStandardMaterial vertexColors roughness={0.9} metalness={0.02} /></instancedMesh><WallDetails matrices={wallDetails} /></>
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

// Luôn mount đủ 3 đèn (ambient + 2 directional) và chỉ đổi cường độ: thêm/bớt đèn sẽ làm shader biên dịch lại gây đứng hình.
function SceneLighting({ lightsOn }) {
  const ambientRef = useRef(null)
  const sunRef = useRef(null)
  const fillRef = useRef(null)
  const level = useRef(lightsOn ? 1 : 0)
  useFrame(({ scene }, delta) => {
    const target = lightsOn ? 1 : 0
    level.current += (target - level.current) * Math.min(1, delta * LIGHT_FADE_SPEED)
    if (Math.abs(target - level.current) < 0.002) level.current = target
    const l = level.current
    if (ambientRef.current) {
      ambientRef.current.intensity = 0.01 + l * 1.49
      ambientRef.current.color.copy(AMBIENT_DARK).lerp(AMBIENT_LIGHT, l)
    }
    if (sunRef.current) sunRef.current.intensity = l * 2.2
    if (fillRef.current) fillRef.current.intensity = l * 0.8
    if (scene.background?.isColor) scene.background.copy(BG_DARK).lerp(BG_LIGHT, l)
  })
  return <><ambientLight ref={ambientRef} intensity={lightsOn ? 1.5 : 0.01} color={lightsOn ? '#ffffff' : '#ff5a2a'} /><directionalLight ref={sunRef} position={[-3, 8, 4]} intensity={lightsOn ? 2.2 : 0} color="#ffffff" /><directionalLight ref={fillRef} position={[4, 6, -5]} intensity={lightsOn ? 0.8 : 0} color="#ffffff" /></>
}

function Torch({ active }) {
  const flameRef = useRef(null)
  const haloRef = useRef(null)
  const lightRef = useRef(null)
  const baseIntensity = active ? 16 : 6
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pulse = 1 + Math.sin(t * 11) * 0.1 + Math.sin(t * 17) * 0.06
    if (flameRef.current) flameRef.current.scale.set(1.1 * pulse, 1.7 * pulse, 1.1 * pulse)
    if (haloRef.current) haloRef.current.scale.setScalar(pulse * (active ? 1.25 : 0.9))
    if (lightRef.current) lightRef.current.intensity = baseIntensity * (0.9 + (pulse - 1) * 1.6)
  })
  return <group position={[0.27, 0.55, -0.08]}>
    <mesh rotation={[0, 0, -0.35]}><cylinderGeometry args={[0.03, 0.04, 0.3, 6]} /><meshStandardMaterial color="#6e4329" /></mesh>
    <mesh ref={flameRef} position={[0.04, 0.19, 0]} scale={[1.1, 1.7, 1.1]}><dodecahedronGeometry args={[0.1, 0]} /><meshBasicMaterial color="#ff7a2a" /></mesh>
    <mesh ref={haloRef} position={[0.04, 0.2, 0]}><sphereGeometry args={[0.34, 16, 12]} /><meshBasicMaterial color="#ff3b12" transparent opacity={active ? 0.32 : 0.18} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <pointLight ref={lightRef} position={[0.04, 0.25, 0]} color={TORCH_COLOR} intensity={baseIntensity} distance={active ? 6.5 : 3.5} decay={1.6} />
  </group>
}

const pulseGeometry = new THREE.RingGeometry(0.42, 0.5, 40)

// Báo hiệu tới lượt đội: các vòng tròn phóng to dần rồi mờ mất, lặp lại liên tục.
function PulseRings({ color, active }) {
  const refs = useRef([])
  const materials = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false })), [color])
  useFrame(({ clock }) => {
    if (!active) return
    materials.forEach((material, index) => {
      const mesh = refs.current[index]
      if (!mesh) return
      const phase = (clock.elapsedTime * 0.85 + index / 3) % 1
      const size = 0.5 + phase * 2.8
      mesh.scale.set(size, size, 1)
      material.opacity = (1 - phase) * 0.9
    })
  })
  return <group visible={active}>{materials.map((material, index) => <mesh key={index} ref={(node) => { refs.current[index] = node }} position={[0, -0.28, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={pulseGeometry} material={material} />)}</group>
}

function PetTexture({ outfit }) {
  const texture = useMemo(() => {
    const svg = renderToStaticMarkup(<PetMascot outfit={outfit} size={256} label="" />)
    const encoded = window.btoa(unescape(encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))))
    const image = new Image()
    image.src = `data:image/svg+xml;base64,${encoded}`
    const nextTexture = new THREE.Texture(image)
    nextTexture.colorSpace = THREE.SRGBColorSpace
    image.onload = () => { nextTexture.needsUpdate = true }
    return nextTexture
  }, [outfit])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function Player({ team, active, pulse, outfit }) {
  const position = mazePosition(team)
  const x = position.x - 4
  const z = position.y - 4
  const groupRef = useRef(null)
  const visualPosition = useRef(new THREE.Vector3(x, 0.42, z))
  const moveFrom = useRef(new THREE.Vector3(x, 0.42, z))
  const moveTo = useRef(new THREE.Vector3(x, 0.42, z))
  const moveStartedAt = useRef(0)
  const color = TEAM_COLORS[team.token] || '#fff'
  const texture = PetTexture({ outfit })

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

  return <group ref={groupRef} position={[x, 0.42, z]} scale={active ? 1.08 : 0.92}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
      <planeGeometry args={[0.68, 0.78]} />
      <meshStandardMaterial map={texture} transparent alphaTest={0.08} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <circleGeometry args={[0.31, 24]} />
      <meshBasicMaterial color={color} transparent opacity={active || pulse ? 0.28 : 0.14} depthWrite={false} />
    </mesh>
    <Torch active={active} /><PulseRings color={color} active={pulse} />
  </group>
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

const PATH_STEP_SECONDS = 0.14
const pathTileGeometry = new THREE.PlaneGeometry(0.86, 0.86)
const pathGlowGeometry = new THREE.PlaneGeometry(1.2, 1.2)
const pathTileMaterial = new THREE.MeshBasicMaterial({ color: '#39ff7a', transparent: true, opacity: 0.9 })
const pathGlowMaterial = new THREE.MeshBasicMaterial({ color: '#39ff7a', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })

// Các ô trên đường ngắn nhất (không xuyên tường) của mọi đội lần lượt phát sáng xanh lá.
// Nhẹ: dùng chung geometry/material, không thêm đèn (thêm đèn làm shader biên dịch lại gây đứng hình).
function GreenPaths({ maze, teams }) {
  const startedAt = useRef(performance.now())
  const tiles = useMemo(() => {
    const byCell = new Map()
    teams.forEach((team) => shortestPath(maze, mazePosition(team), maze.exit).forEach((cell, step) => {
      const key = `${cell.x},${cell.y}`
      const known = byCell.get(key)
      if (!known || step < known.step) byCell.set(key, { key, x: cell.x - maze.width / 2 + 0.5, z: cell.y - maze.height / 2 + 0.5, step })
    }))
    return [...byCell.values()]
  }, [maze, teams])
  const refs = useRef([])
  useFrame(() => {
    const elapsed = (performance.now() - startedAt.current) / 1000
    for (let index = 0; index < tiles.length; index += 1) {
      const group = refs.current[index]
      if (!group) continue
      const local = elapsed - tiles[index].step * PATH_STEP_SECONDS
      if (local <= 0) { group.visible = false; continue }
      group.visible = true
      const scale = Math.min(1, local / 0.18) * (0.92 + Math.sin(elapsed * 6 + tiles[index].step) * 0.08)
      group.scale.set(scale, 1, scale)
    }
  })
  return <>{tiles.map((tile, index) => <group key={tile.key} ref={(node) => { refs.current[index] = node }} position={[tile.x, 0.03, tile.z]} visible={false}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={pathTileGeometry} material={pathTileMaterial} />
    <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={pathGlowGeometry} material={pathGlowMaterial} />
  </group>)}</>
}

function MazeContent({ maze, teams, lightsOn, revealPaths }) {
  return <><SceneLighting lightsOn={lightsOn} /><MazeWalls maze={maze} /><Floor maze={maze} /><ExitMarker maze={maze} />{revealPaths && <GreenPaths maze={maze} teams={teams} />}</>
}

function GamePetMarkers({ maze, teams, currentTeamId, pulseTeamId, outfit }) {
  return <div className="game-pet-markers" aria-hidden="true">
    {teams.map((team) => {
      const position = mazePosition(team)
      const left = ((position.x + 0.5) / maze.width) * 100
      const top = ((position.y + 0.5) / maze.height) * 100
      const active = team.id === currentTeamId
      return <div
        className={`game-pet-marker${active ? ' is-active' : ''}${team.id === pulseTeamId ? ' is-pulsing' : ''}`}
        key={team.id}
        style={{ left: `${left}%`, top: `${top}%`, '--team-color': TEAM_COLORS[team.token] || '#fff' }}
      >
        <PetMascot outfit={outfit} size={active ? 54 : 46} label={`Linh vật của ${team.name}`} />
        <span className="game-pet-marker-name">{team.name}</span>
      </div>
    })}
  </div>
}

function Game3DPlayers({ teams, currentTeamId, pulseTeamId, outfit }) {
  return <>{teams.map((team) => <Player key={team.id} team={team} active={team.id === currentTeamId} pulse={team.id === pulseTeamId} outfit={outfit} />)}</>
}

function GamePets({ maze, teams, currentTeamId, pulseTeamId, lightsOn, revealPaths, quality }) {
  const { session, authReady } = useAuth()
  const [outfit, setOutfit] = useState({ ...EMPTY_OUTFIT })
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!authReady || !userId) {
      setOutfit({ ...EMPTY_OUTFIT })
      return undefined
    }
    let active = true
    void loadOutfit(userId).then((savedOutfit) => {
      if (active) setOutfit(savedOutfit)
    }).catch(() => {
      if (active) setOutfit({ ...EMPTY_OUTFIT })
    })
    return () => { active = false }
  }, [authReady, userId])

  return <>
    <div className="game-maze-render"><Canvas camera={{ position: [0, 14, 0.01], fov: 45 }} dpr={quality === 'low' ? 1 : [1, 1.25]} gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}><color attach="background" args={[lightsOn ? '#dce8f5' : '#050206']} /><MazeContent maze={maze} teams={teams} lightsOn={lightsOn} revealPaths={revealPaths} /><Game3DPlayers teams={teams} currentTeamId={currentTeamId} pulseTeamId={pulseTeamId} outfit={outfit} /></Canvas></div>
  </>
}

// lightsOn=false: tối đen, chỉ có ánh lửa đuốc đỏ. lightsOn=true: bật đèn sáng dần.
// pulseTeamId: đội đang được báo tới lượt -> hiện các vòng tròn lan toả quanh người chơi của đội đó.
export default function MazeScene({ maze: rawMaze, teams = [], currentTeamId, pulseTeamId = null, quality = 'high', lightsOn = false, revealPaths = false }) {
  const maze = normalizeMaze(rawMaze)
  if (!maze) return <div className="maze-fallback">Đang dựng mê cung…</div>
  const isLowQuality = quality === 'low'
  return <div className={`maze-canvas maze-quality-${quality}`} aria-label="Mê cung 3D Treasure Race"><GamePets maze={maze} teams={teams} currentTeamId={currentTeamId} pulseTeamId={pulseTeamId} lightsOn={lightsOn} revealPaths={revealPaths} /></div>
}
