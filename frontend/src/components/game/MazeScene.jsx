import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mazePosition, normalizeMaze } from '../../lib/maze.js'

const TEAM_COLORS = { blue: '#5d8cff', green: '#56d69a', purple: '#b38cff', orange: '#ffad68', pink: '#ff83b0', cyan: '#64dff1', red: '#ff6f72', gold: '#f6cc63' }

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
  return <instancedMesh ref={meshRef} args={[null, null, wallMatrices.length]} castShadow receiveShadow><boxGeometry args={[1, 1.25, 0.18]} /><meshStandardMaterial color="#263246" roughness={0.93} /></instancedMesh>
}

function Player({ team, active }) {
  const position = mazePosition(team)
  const x = position.x - 4
  const z = position.y - 4
  const color = TEAM_COLORS[team.token] || '#fff'
  return <group position={[x, 0.42, z]}><mesh castShadow><cylinderGeometry args={[0.24, 0.3, 0.62, 6]} /><meshStandardMaterial color={color} emissive={active ? color : '#000'} emissiveIntensity={active ? 0.45 : 0.05} /></mesh>{active && <pointLight color="#ffc76a" intensity={1.7} distance={3.3} decay={2} />}</group>
}

function MazeContent({ maze, teams, currentTeamId, quality }) {
  const exitX = maze.exit.x - 4
  const exitZ = maze.exit.y - 4
  return <><ambientLight intensity={quality === 'low' ? 0.08 : 0.13} color="#33415e" /><directionalLight position={[0, 7, 2]} intensity={quality === 'low' ? 0.25 : 0.5} castShadow={quality !== 'low'} shadow-mapSize={[256, 256]} /><MazeWalls maze={maze} /><mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[maze.width, maze.height]} /><meshStandardMaterial color="#070b14" roughness={1} /></mesh><mesh position={[exitX, 0.04, exitZ]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.32, 8]} /><meshBasicMaterial color="#f6b94b" transparent opacity={0.45} /></mesh><pointLight position={[exitX, 0.5, exitZ]} color="#f6b94b" intensity={0.8} distance={2.3} decay={2} />{teams.map((team) => <Player key={team.id} team={team} active={team.id === currentTeamId} />)}</>
}

export default function MazeScene({ maze: rawMaze, teams = [], currentTeamId, quality = 'high' }) {
  const maze = normalizeMaze(rawMaze)
  if (!maze) return <div className="maze-fallback">Đang dựng mê cung…</div>
  return <div className={`maze-canvas maze-quality-${quality}`} aria-label="Mê cung 3D Treasure Race"><Canvas camera={{ position: [0, 10.5, 8.7], fov: 48 }} shadows={quality !== 'low'} dpr={quality === 'low' ? 1 : [1, 1.25]} gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}><color attach="background" args={['#050810']} /><fog attach="fog" args={['#050810', 6, 13]} /><MazeContent maze={maze} teams={teams} currentTeamId={currentTeamId} quality={quality} /></Canvas></div>
}
