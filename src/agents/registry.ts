/**
 * Agent Registry
 *
 * Registry for agent registration and lookup.
 */

import type { AgentType } from '../types.js';
import type { IAgent, AgentFactory, AgentMetadata } from './types.js';
import { getFeatureFlags } from '../core/feature-flags.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'agent-registry' });

/**
 * Registry entry for an agent
 */
interface RegistryEntry {
  metadata: AgentMetadata;
  factory: AgentFactory;
  instance?: IAgent;
}

/**
 * Agent registry for managing agent registration and instantiation
 */
export class AgentRegistry {
  private agents: Map<AgentType, RegistryEntry>;
  private singletonMode: boolean;

  constructor(singletonMode: boolean = true) {
    this.agents = new Map();
    this.singletonMode = singletonMode;
    log.debug('AgentRegistry initialized', { singletonMode });
  }

  /**
   * Register an agent with the registry
   */
  register(factory: AgentFactory): void {
    // Create a temporary instance to get metadata
    const tempInstance = factory();
    const metadata = tempInstance.metadata;

    if (this.agents.has(metadata.type)) {
      log.warn('Agent already registered, overwriting', { type: metadata.type });
    }

    this.agents.set(metadata.type, {
      metadata,
      factory,
    });

    log.info('Agent registered', {
      type: metadata.type,
      name: metadata.name,
      phase: metadata.phase,
    });
  }

  /**
   * Unregister an agent
   */
  unregister(type: AgentType): boolean {
    const removed = this.agents.delete(type);
    if (removed) {
      log.info('Agent unregistered', { type });
    }
    return removed;
  }

  /**
   * Get an agent instance
   */
  get(type: AgentType): IAgent | undefined {
    const entry = this.agents.get(type);
    if (!entry) {
      log.warn('Agent not found', { type });
      return undefined;
    }

    // Check if agent is enabled via feature flags
    const flags = getFeatureFlags();
    const flagKey = `agents.${type.replace(/-/g, '')}`;
    if (!flags.isEnabled(flagKey)) {
      log.debug('Agent disabled by feature flag', { type, flagKey });
      return undefined;
    }

    // Return singleton or create new instance
    if (this.singletonMode) {
      if (!entry.instance) {
        entry.instance = entry.factory();
      }
      return entry.instance;
    }

    return entry.factory();
  }

  /**
   * Get agent metadata
   */
  getMetadata(type: AgentType): AgentMetadata | undefined {
    return this.agents.get(type)?.metadata;
  }

  /**
   * Check if an agent is registered
   */
  isRegistered(type: AgentType): boolean {
    return this.agents.has(type);
  }

  /**
   * Check if an agent is available (registered and enabled)
   */
  isAvailable(type: AgentType): boolean {
    if (!this.isRegistered(type)) {
      return false;
    }

    const flags = getFeatureFlags();
    const flagKey = `agents.${type.replace(/-/g, '')}`;
    return flags.isEnabled(flagKey);
  }

  /**
   * Get all registered agent types
   */
  getRegisteredTypes(): AgentType[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get all available agent types (enabled via feature flags)
   */
  getAvailableTypes(): AgentType[] {
    return this.getRegisteredTypes().filter((type) => this.isAvailable(type));
  }

  /**
   * Get all agents for a specific phase
   */
  getByPhase(phase: string): AgentMetadata[] {
    return Array.from(this.agents.values())
      .map((entry) => entry.metadata)
      .filter((metadata) => metadata.phase === phase);
  }

  /**
   * Get agents that can operate in a specific state
   */
  getForState(state: string): AgentMetadata[] {
    return Array.from(this.agents.values())
      .map((entry) => entry.metadata)
      .filter((metadata) => metadata.validStates.includes(state) || metadata.validStates.length === 0);
  }

  /**
   * Get agents with a specific capability
   */
  getByCapability(capability: string): AgentMetadata[] {
    return Array.from(this.agents.values())
      .map((entry) => entry.metadata)
      .filter((metadata) => metadata.capabilities.includes(capability));
  }

  /**
   * Get registry statistics
   */
  getStats(): Record<string, unknown> {
    const registered = this.getRegisteredTypes();
    const available = this.getAvailableTypes();
    const byPhase: Record<string, number> = {};

    for (const entry of this.agents.values()) {
      const phase = entry.metadata.phase;
      byPhase[phase] = (byPhase[phase] ?? 0) + 1;
    }

    return {
      totalRegistered: registered.length,
      totalAvailable: available.length,
      byPhase,
      singletonMode: this.singletonMode,
    };
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.agents.clear();
    log.info('Registry cleared');
  }

  /**
   * Reset singleton instances (useful for testing)
   */
  resetInstances(): void {
    for (const entry of this.agents.values()) {
      entry.instance = undefined;
    }
    log.debug('Singleton instances reset');
  }
}

// Singleton instance
let instance: AgentRegistry | null = null;

/**
 * Get the agent registry singleton
 */
export function getAgentRegistry(): AgentRegistry {
  if (!instance) {
    instance = new AgentRegistry();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetAgentRegistry(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}
