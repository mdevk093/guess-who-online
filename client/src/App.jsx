import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Lobby from './components/Lobby';
import CharacterSelect from './components/CharacterSelect';
import GameBoard from './components/GameBoard';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './supabaseClient';

const GameRouter = () => {
  const { room, session, isGuest } = useGame();

  if (!session && !isGuest) {
    return <Auth />;
  }

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
      <ErrorBoundary>
        <GameRouter />
      </ErrorBoundary>
    </GameProvider>
  );
}

export default App;
