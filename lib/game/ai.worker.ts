/// <reference lib="webworker" />
import { chooseAiCommand, type AiRequest } from './ai';

self.onmessage = (event: MessageEvent<AiRequest>) => {
  self.postMessage(chooseAiCommand(event.data));
};

export {};
