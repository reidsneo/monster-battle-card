'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    modelContext?: {
      registerTool: (tool: { name: string; description: string; inputSchema: object; execute: (input: { deck?: string; difficulty?: string }) => Promise<{ content: Array<{ type: 'text'; text: string }> }> }) => void;
      unregisterTool?: (name: string) => void;
    };
  }
}

export function useGameTools() {
  useEffect(() => {
    if (!window.modelContext?.registerTool) return;
    window.modelContext.registerTool({
      name: 'start_local_match',
      description: 'Start a private local Monster Rancher Battle Card match with a starter deck and AI difficulty.',
      inputSchema: {
        type: 'object',
        properties: {
          deck: { type: 'string', enum: ['miracle', 'speed', 'powerful'] },
          difficulty: { type: 'string', enum: ['easy', 'normal', 'hard'] },
        },
      },
      async execute(input) {
        const deck = ['miracle', 'speed', 'powerful'].includes(input.deck ?? '') ? input.deck : 'miracle';
        const difficulty = ['easy', 'normal', 'hard'].includes(input.difficulty ?? '') ? input.difficulty : 'normal';
        window.location.assign(`/play?deck=${deck}&difficulty=${difficulty}`);
        return { content: [{ type: 'text', text: `Starting ${deck} against a ${difficulty} rival.` }] };
      },
    });
    return () => window.modelContext?.unregisterTool?.('start_local_match');
  }, []);
}
