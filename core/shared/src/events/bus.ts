import { EventEmitter } from 'node:events';
import { createLogger } from '../logger/logger.js';
import type { OrbisEvents, OrbisEventName } from '../types/events.js';

const logger = createLogger('shared');

/**
 * Global Event Bus using native EventEmitter
 */
export class OrbisEventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Increase limit if needed, though we encourage cleanup
    this.emitter.setMaxListeners(100);
  }

  /**
   * Register a listener for an event
   */
  on<K extends OrbisEventName>(event: K, listener: (payload: OrbisEvents[K]) => void | Promise<void>): void {
    // Wrapper to catch errors and avoid crashing
    const safeListener = async (payload: OrbisEvents[K]) => {
      try {
        await listener(payload);
      } catch (error: any) {
        logger.warn(`Error in event listener for "${event}": ${error.message}`, error);
      }
    };

    // Store the original listener on the wrapper to allow off() to work
    (safeListener as any)._original = listener;
    this.emitter.on(event, safeListener);
  }

  /**
   * Remove a listener for an event
   */
  off<K extends OrbisEventName>(event: K, listener: (payload: OrbisEvents[K]) => void | Promise<void>): void {
    // We need to find the wrapper that contains this original listener
    const listeners = this.emitter.listeners(event);
    for (const l of listeners) {
      if ((l as any)._original === listener) {
        this.emitter.removeListener(event, l);
        break;
      }
    }
  }

  /**
   * Emit an event with typed payload
   */
  emit<K extends OrbisEventName>(event: K, payload: OrbisEvents[K]): void {
    this.emitter.emit(event, payload);
  }
}

let instance: OrbisEventBus | null = null;

/**
 * Singleton getter for the Event Bus
 */
export function getEventBus(): OrbisEventBus {
  if (!instance) {
    instance = new OrbisEventBus();
  }
  return instance;
}
