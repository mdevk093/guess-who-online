import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Landing from './components/Landing';
import CharacterSelect from './components/CharacterSelect';
import GameBoard from './components/GameBoard';
import ErrorBoundary from './components/ErrorBoundary';

const GameRouter = () => {
  const { room, session, isGuest } = useGame();

  // If not in a room, ALWAYS show landing page.
  // The Landing page itself handles rendering the Auth modal if the user clicks "Sign In".
  // It also handles creating/joining rooms.
  if (!room) {
    return <Landing />;
  }

  // Once in a room, route based on game state
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
      <ErrorBoundary>
        <GameRouter />
      </ErrorBoundary>
    </GameProvider>
  );
}

export default App;
