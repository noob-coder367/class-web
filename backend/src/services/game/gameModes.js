import { randomInt } from 'node:crypto'
import { GAME_PHASES, generateMaze, nextTurnIndex, rankTeamsAtFinish, shortestPathDistance } from './treasureRace.engine.js'
import { createMinigameSchedule, rankQuizPartyTeams, scoreQuizPartyAnswer } from './quizParty.engine.js'

// This is deliberately a small registry, rather than a plugin system.  A mode owns
// only its rules and persistent game state; rooms, players and auth stay shared.
const treasureRace = Object.freeze({
  id: 'treasure_race',
  aliases: ['treasure-race'],
  defaultTitle: 'Phòng đua kho báu',
  createRpc: 'create_game_room_atomic',
  start({ ordered, teams, seed }) {
    const maze = generateMaze(seed, 9, 9, teams.length)
    return {
      gameLayout: maze,
      teamLayout: ordered.map((item, index) => {
        const originalIndex = teams.findIndex((team) => team.id === item.teamId)
        const spawn = maze.spawns[originalIndex % maze.spawns.length] || maze.spawns[0]
        return { team_id: item.teamId, turn_order: index, maze_x: spawn[0], maze_y: spawn[1] }
      }),
    }
  },
  scoreAnswer({ game, teams, currentTeam, isCorrect, responseTime }) {
    const updatedTeam = { ...currentTeam, correct_count: currentTeam.correct_count + (isCorrect ? 1 : 0), wrong_count: currentTeam.wrong_count + (isCorrect ? 0 : 1), total_response_time: (currentTeam.total_response_time || 0) + responseTime }
    const nextTeams = teams.map((team) => (team.id === currentTeam.id ? updatedTeam : team))
    if (isCorrect) {
      const diceResult = randomInt(1, 7)
      return { nextTeams, gamePatch: { phase: GAME_PHASES.DICE_ROLL, dice_result: diceResult, remaining_moves: diceResult } }
    }
    const nextQuestionIndex = game.question_index + 1
    const isFinished = nextQuestionIndex >= game.total_questions
    const winnerId = isFinished ? rankTeamsAtFinish(nextTeams, game.maze_layout)[0]?.id || null : null
    return { nextTeams, gamePatch: { current_turn: nextTurnIndex(game.current_turn, teams.length), question_index: nextQuestionIndex, phase: isFinished ? GAME_PHASES.FINISHED : GAME_PHASES.QUESTION, status: isFinished ? 'finished' : 'playing', winner_team_id: isFinished ? winnerId : null, remaining_moves: 0, dice_result: null, ...(isFinished ? { finished_at: new Date().toISOString() } : {}) } }
  },
  ranking(teams, game) {
    return game.maze_layout ? rankTeamsAtFinish(teams, game.maze_layout).map((team) => ({ team_id: team.id, distance: shortestPathDistance(game.maze_layout, { x: team.maze_x, y: team.maze_y }) })) : []
  },
  supportsMovement: true,
})

const quizParty = Object.freeze({
  id: 'quiz_party',
  defaultTitle: 'Quiz Party',
  createRpc: 'create_game_room_atomic_v2',
  createRpcArgs: (mode) => ({ p_game_mode: mode.id }),
  start({ ordered, questionLimit }) {
    return {
      gameLayout: { mode: 'quiz_party', version: 1, minigame_schedule: createMinigameSchedule(questionLimit, (size) => randomInt(size)) },
      teamLayout: ordered.map((item, index) => ({ team_id: item.teamId, turn_order: index, maze_x: 0, maze_y: 0 })),
    }
  },
  scoreAnswer({ game, teams, isCorrect, responseTime }) {
    return scoreQuizPartyAnswer({ game, teams, isCorrect, responseTime })
  },
  ranking(teams) {
    return rankQuizPartyTeams(teams).map((team, index) => ({ team_id: team.id, rank: index + 1, score: team.correct_count || 0, correct_count: team.correct_count || 0, wrong_count: team.wrong_count || 0 }))
  },
  skipAnswerIdempotencyPreflight: true,
  supportsMovement: false,
})

export const GAME_MODES = Object.freeze([treasureRace, quizParty])
export const GAME_MODE_IDS = new Set(GAME_MODES.map((mode) => mode.id))

export function getGameMode(value) {
  const id = String(value || '').trim()
  return GAME_MODES.find((mode) => mode.id === id || mode.aliases?.includes(id)) || null
}
