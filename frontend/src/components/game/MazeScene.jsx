import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mazePosition, normalizeMaze } from '../../lib/maze.js'

const TEAM_COLORS = { blue: '#6d9dff', green: '#67e5b0', purple: '#c09aff', orange: '#ffb56f', pink: '#ff91bb', cyan: '#70e6f5', red: '#ff7c80', gold: '#f7d277' }

function MazeWalls({ maze }) {
  const meshRef = useRef(null)
  const wallMatrices = useMemo(() => {
    const result = []
    maze.cells.forEach((cell) => {
      const x = cell.x - maze.width / 2 + 0.5
      const z = cell.y - maze.height / 2 + 0.5
      if (cell.walls.n) result.push([x, 0.62, z - 0.5, 0])
      if (cell.walls.s) result.push([x, 0.62, z + 0.5, 0])
      if (cell.walls.w) result.push([x - 0.5, 0.62, z, Math.PI / 2])
      if (cell.walls.e) result.push([x + 0.5, 0.62, z, Math.PI / 2])
    })
    return result
  }, [maze])
  useEffect(() => {
    if (!meshRef.current) return
    const matrix = new THREE.Matrix4()
    wallMatrices.forEach(([x, y, z, rotationY], index) => {
      matrix.makeRotationY(rotationY)
      matrix.setPosition(x, y, z)
      meshRef.current.setMatrixAt(index, matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [wallMatrices])
  return <instancedMesh ref={meshRef} args={[null, null, wallMatrices.length]} castShadow receiveShadow><boxGeometry args={[1, 1.25, 0.18]} /><meshStandardMaterial color="#35425a" roughness={0.82} metalness={0.08} /></instancedMesh>
}

function Torch({ active }) {
  return <group position={[0.27, 0.55, -0.08]}><mesh rotation={[0, 0, -0.35]} castShadow><cylinderGeometry args={[0.025, 0.035, 0.28, 6]} /><meshStandardMaterial color="#6e4329" /></mesh><mesh position={[0.04, 0.16, 0]} scale={[0.75, 1.2, 0.75]}><dodecahedronGeometry args={[0.09, 0]} /><meshBasicMaterial color="#ffd36a" /></mesh><pointLight color="#ffb84d" intensity={active ? 1.9 : 0.8} distance={active ? 3.8 : 2.2} decay={2} /></group>
}

function Player({ team, active }) {
  const position = mazePosition(team)
  const x = position.x - 4
  const z = position.y - 4
  const color = TEAM_COLORS[team.token] || '#fff'
  return <group position={[x, 0.42, z]} scale={active ? 1.08 : 0.92}><mesh castShadow><cylinderGeometry args={[0.24, 0.3, 0.62, 6]} /><meshStandardMaterial color={color} emissive={active ? color : '#111522'} emissiveIntensity={active ? 0.55 : 0.12} roughness={0.55} /></mesh><mesh position={[0, 0.38, 0]} castShadow><sphereGeometry args={[0.16, 10, 8]} /><meshStandardMaterial color="#f0c4a0" roughness={0.9} /></mesh><Torch active={active} />{active && <pointLight color="#ffd27b" intensity={1.1} distance={2.8} decay={2} />}</group>
}

function Floor({ maze }) {
  const tiles = useMemo(() => Array.from({ length: maze.width * maze.height }, (_, index) => { const x = index % maze.width - maze.width / 2 + 0.5; const z = Math.floor(index / maze.width) - maze.height / 2 + 0.5; return [x, z] }), [maze])
  return <><mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[maze.width, maze.height]} /><meshStandardMaterial color="#0d1422" roughness={0.96} /></mesh>{tiles.map(([x, z], index) => <mesh key={index} position={[x, -0.065, z]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.92, 0.92]} /><meshBasicMaterial color={index % 2 ? '#111b2b' : '#0f1827'} transparent opacity={0.42} /></mesh>)}</>
}

function ExitMarker({ maze }) {
  const exitX = maze.exit.x - 4
  const exitZ = maze.exit.y - 4
  return <group position={[exitX, 0.08, exitZ]}><mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.28, 0.43, 12]} /><meshBasicMaterial color="#f7ce72" transparent opacity={0.9} /></mesh><mesh position={[0, 0.42, 0]}><torusGeometry args={[0.28, 0.045, 8, 16, Math.PI]} /><meshBasicMaterial color="#ffe6a0" /></mesh><pointLight color="#f6b94b" intensity={1.2} distance={2.8} decay={2} /></group>
}

function MazeContent({ maze, teams, currentTeamId, quality }) {
  return <><ambientLight intensity={quality === 'low' ? 0.12 : 0.18} color="#536487" /><directionalLight position={[-3, 8, 4]} intensity={quality === 'low' ? 0.22 : 0.42} color="#a5b9e8" castShadow={quality !== 'low'} shadow-mapSize={[256, 256]} /><MazeWalls maze={maze} /><Floor maze={maze} /><ExitMarker maze={maze} />{teams.map((team) => <Player key={team.id} team={team} active={team.id === currentTeamId} />)}</>
}

export default function MazeScene({ maze: rawMaze, teams = [], currentTeamId, quality = 'high' }) {
  const maze = normalizeMaze(rawMaze)
  if (!maze) return <div className="maze-fallback">Đang dựng mê cung…</div>
  return <div className={`maze-canvas maze-quality-${quality}`} aria-label="Mê cung 3D Treasure Race"><Canvas camera={{ position: [0, 8.8, 7.6], fov: 46 }} shadows={quality !== 'low'} dpr={quality === 'low' ? 1 : [1, 1.25]} gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}><color attach="background" args={['#08101d']} /><fog attach="fog" args={['#08101d', 5.5, 12.5]} /><MazeContent maze={maze} teams={teams} currentTeamId={currentTeamId} quality={quality} /></Canvas></div>
}
