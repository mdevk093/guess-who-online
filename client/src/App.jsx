import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Lobby from './components/Lobby';
import CharacterSelect from './components/CharacterSelect';
import GameBoard from './components/GameBoard';

const GameRouter = () => {
  const { room, playerName } = useGame();

  if (!room) {
    return <Lobby />;
  }

  if (room.gameState === 'LOBBY' || room.gameState === 'SELECTING') {
    return <CharacterSelect />;
  }

  if (room.gameState === 'PLAYING' || room.gameState === 'GAME_OVER') {
    return <GameBoard />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-2xl">Game Over or Loading...</h1>
    </div>
  );
};

function App() {
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

export default App;
