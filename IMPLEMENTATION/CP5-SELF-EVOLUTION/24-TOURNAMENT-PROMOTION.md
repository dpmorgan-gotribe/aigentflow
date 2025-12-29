# Step 24: Tournament & Promotion

## Overview

This step implements competitive evaluation of agents using TrueSkill-inspired rating systems, tournament-style matchups, and automated promotion of superior agents to production.

## Dependencies

- Step 23: Agent Generation (candidate agents)
- Step 22: Pattern Detection (evaluation criteria)
- Step 21: Execution Tracing (performance data)

---

## Part 1: Rating System Schema

### TrueSkill-Inspired Rating

```typescript
import { z } from 'zod';

// Rating represents skill level with uncertainty
export const RatingSchema = z.object({
  mu: z.number().default(25.0),       // Mean skill estimate
  sigma: z.number().default(8.333),   // Uncertainty (standard deviation)
});

export type Rating = z.infer<typeof RatingSchema>;

// Agent rating with metadata
export const AgentRatingSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  rating: RatingSchema,
  matches: z.number().default(0),
  wins: z.number().default(0),
  losses: z.number().default(0),
  draws: z.number().default(0),
  lastUpdated: z.number(),
  history: z.array(z.object({
    timestamp: z.number(),
    mu: z.number(),
    sigma: z.number(),
    opponent: z.string(),
    result: z.enum(['win', 'loss', 'draw']),
  })),
});

export type AgentRating = z.infer<typeof AgentRatingSchema>;

// Match result
export const MatchResultSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number(),
  taskId: z.string(),
  taskDescription: z.string(),
  agents: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    score: z.number(),
    metrics: z.object({
      latency: z.number(),
      cost: z.number(),
      tokenCount: z.number(),
      correctness: z.number(), // 0-1 score
      completeness: z.number(), // 0-1 score
    }),
    output: z.unknown(),
  })),
  winner: z.string().optional(), // agentId or undefined for draw
  judgement: z.object({
    method: z.enum(['automated', 'llm_judge', 'human']),
    reasoning: z.string(),
    confidence: z.number(),
  }),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;
```

### Tournament Schema

```typescript
export const TournamentStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'cancelled',
]);

export type TournamentStatus = z.infer<typeof TournamentStatusSchema>;

export const TournamentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: TournamentStatusSchema,
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),

  config: z.object({
    matchesPerPair: z.number().default(3),
    taskCount: z.number().default(10),
    minConfidence: z.number().default(0.7),
    promotionThreshold: z.number().default(0.6), // Win rate needed for promotion
  }),

  participants: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    initialRating: RatingSchema,
  })),

  matches: z.array(MatchResultSchema),

  standings: z.array(z.object({
    agentId: z.string(),
    agentName: z.string(),
    rating: RatingSchema,
    wins: z.number(),
    losses: z.number(),
    draws: z.number(),
    winRate: z.number(),
    avgScore: z.number(),
  })),

  promotions: z.array(z.object({
    agentId: z.string(),
    promotedAt: z.number(),
    reason: z.string(),
  })),
});

export type Tournament = z.infer<typeof TournamentSchema>;
```

---

## Part 2: TrueSkill Rating Engine

### Rating Calculator

```typescript
export class TrueSkillRating {
  // TrueSkill parameters
  private readonly beta: number = 4.166;  // Performance variance
  private readonly tau: number = 0.083;   // Dynamics factor
  private readonly drawProbability: number = 0.1;

  constructor(config?: {
    beta?: number;
    tau?: number;
    drawProbability?: number;
  }) {
    if (config?.beta) this.beta = config.beta;
    if (config?.tau) this.tau = config.tau;
    if (config?.drawProbability) this.drawProbability = config.drawProbability;
  }

  createRating(mu: number = 25.0, sigma: number = 8.333): Rating {
    return { mu, sigma };
  }

  // Calculate the conservative skill estimate (mu - 3*sigma)
  conservativeRating(rating: Rating): number {
    return rating.mu - 3 * rating.sigma;
  }

  // Update ratings after a match
  updateRatings(
    winner: Rating,
    loser: Rating,
    isDraw: boolean = false
  ): { winner: Rating; loser: Rating } {
    const c = Math.sqrt(2 * this.beta ** 2 + winner.sigma ** 2 + loser.sigma ** 2);

    const winnerMu = winner.mu;
    const loserMu = loser.mu;

    // Calculate v and w functions (approximations)
    const t = (winnerMu - loserMu) / c;
    const epsilon = this.drawMargin() / c;

    let v: number, w: number;

    if (isDraw) {
      // Draw case
      v = this.vDraw(t, epsilon);
      w = this.wDraw(t, epsilon);
    } else {
      // Win case
      v = this.vWin(t, epsilon);
      w = this.wWin(t, epsilon);
    }

    // Update winner
    const winnerMuMultiplier = winner.sigma ** 2 / c;
    const winnerSigmaMultiplier = winner.sigma ** 2 / (c ** 2);

    const newWinnerMu = winnerMu + winnerMuMultiplier * v;
    const newWinnerSigma = Math.sqrt(
      winner.sigma ** 2 * (1 - winnerSigmaMultiplier * w)
    );

    // Update loser
    const loserMuMultiplier = loser.sigma ** 2 / c;
    const loserSigmaMultiplier = loser.sigma ** 2 / (c ** 2);

    const newLoserMu = loserMu - loserMuMultiplier * v;
    const newLoserSigma = Math.sqrt(
      loser.sigma ** 2 * (1 - loserSigmaMultiplier * w)
    );

    // Apply dynamics factor (tau) to sigma
    return {
      winner: {
        mu: newWinnerMu,
        sigma: Math.sqrt(newWinnerSigma ** 2 + this.tau ** 2),
      },
      loser: {
        mu: newLoserMu,
        sigma: Math.sqrt(newLoserSigma ** 2 + this.tau ** 2),
      },
    };
  }

  // Calculate win probability
  winProbability(player: Rating, opponent: Rating): number {
    const deltaMu = player.mu - opponent.mu;
    const sumSigmaSq = player.sigma ** 2 + opponent.sigma ** 2;
    const denominator = Math.sqrt(2 * this.beta ** 2 + sumSigmaSq);

    return this.phi(deltaMu / denominator);
  }

  // Calculate match quality (how close the match is expected to be)
  matchQuality(player1: Rating, player2: Rating): number {
    const deltaMu = player1.mu - player2.mu;
    const sumSigmaSq = player1.sigma ** 2 + player2.sigma ** 2;

    const sqrtPart = Math.sqrt(
      (2 * this.beta ** 2) / (2 * this.beta ** 2 + sumSigmaSq)
    );

    const expPart = Math.exp(
      -(deltaMu ** 2) / (2 * (2 * this.beta ** 2 + sumSigmaSq))
    );

    return sqrtPart * expPart;
  }

  private drawMargin(): number {
    return this.inversePhi((1 + this.drawProbability) / 2) * Math.sqrt(2) * this.beta;
  }

  // Gaussian CDF approximation
  private phi(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  // Inverse Gaussian CDF approximation
  private inversePhi(p: number): number {
    return Math.sqrt(2) * this.inverseErf(2 * p - 1);
  }

  // Error function approximation
  private erf(x: number): number {
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  // Inverse error function approximation
  private inverseErf(x: number): number {
    const a = 0.147;
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const ln1MinusXSq = Math.log(1 - x * x);
    const term1 = 2 / (Math.PI * a) + ln1MinusXSq / 2;
    const term2 = ln1MinusXSq / a;

    return sign * Math.sqrt(Math.sqrt(term1 * term1 - term2) - term1);
  }

  // V function for win
  private vWin(t: number, epsilon: number): number {
    const denominator = this.phi(t - epsilon);
    if (denominator < 1e-10) return -t + epsilon;
    return this.normalPdf(t - epsilon) / denominator;
  }

  // W function for win
  private wWin(t: number, epsilon: number): number {
    const v = this.vWin(t, epsilon);
    return v * (v + t - epsilon);
  }

  // V function for draw
  private vDraw(t: number, epsilon: number): number {
    const phiMinus = this.phi(-epsilon - t);
    const phiPlus = this.phi(epsilon - t);
    const denominator = phiPlus - phiMinus;

    if (denominator < 1e-10) return 0;

    return (this.normalPdf(-epsilon - t) - this.normalPdf(epsilon - t)) / denominator;
  }

  // W function for draw
  private wDraw(t: number, epsilon: number): number {
    const v = this.vDraw(t, epsilon);
    const phiMinus = this.phi(-epsilon - t);
    const phiPlus = this.phi(epsilon - t);

    return v ** 2 +
      ((-epsilon - t) * this.normalPdf(-epsilon - t) -
       (epsilon - t) * this.normalPdf(epsilon - t)) /
      (phiPlus - phiMinus);
  }

  // Standard normal PDF
  private normalPdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }
}
```

---

## Part 3: Match Evaluation

### Match Evaluator

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { GeneratedAgentSpec, AgentRegistry } from './23-AGENT-GENERATION';

export interface MatchTask {
  id: string;
  description: string;
  input: unknown;
  expectedOutput?: unknown;
  evaluationCriteria: string[];
}

export class MatchEvaluator {
  private client: Anthropic;
  private registry: AgentRegistry;

  constructor(apiKey: string, registry: AgentRegistry) {
    this.client = new Anthropic({ apiKey });
    this.registry = registry;
  }

  async runMatch(
    agent1Id: string,
    agent2Id: string,
    task: MatchTask
  ): Promise<MatchResult> {
    const agent1 = await this.registry.getSpec(agent1Id);
    const agent2 = await this.registry.getSpec(agent2Id);

    if (!agent1 || !agent2) {
      throw new Error('Agent not found');
    }

    // Run both agents on the task
    const [result1, result2] = await Promise.all([
      this.runAgent(agent1, task),
      this.runAgent(agent2, task),
    ]);

    // Evaluate outputs
    const judgement = await this.judgeOutputs(task, result1, result2);

    // Calculate scores
    const score1 = this.calculateScore(result1, task);
    const score2 = this.calculateScore(result2, task);

    // Determine winner
    let winner: string | undefined;
    if (judgement.winner === 'agent1') {
      winner = agent1Id;
    } else if (judgement.winner === 'agent2') {
      winner = agent2Id;
    }
    // undefined means draw

    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      taskId: task.id,
      taskDescription: task.description,
      agents: [
        {
          agentId: agent1Id,
          agentName: agent1.name,
          score: score1,
          metrics: result1.metrics,
          output: result1.output,
        },
        {
          agentId: agent2Id,
          agentName: agent2.name,
          score: score2,
          metrics: result2.metrics,
          output: result2.output,
        },
      ],
      winner,
      judgement: {
        method: 'llm_judge',
        reasoning: judgement.reasoning,
        confidence: judgement.confidence,
      },
    };
  }

  private async runAgent(
    agent: GeneratedAgentSpec,
    task: MatchTask
  ): Promise<{
    output: unknown;
    metrics: MatchResult['agents'][0]['metrics'];
  }> {
    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: agent.config.model,
        max_tokens: agent.config.maxTokens,
        temperature: agent.config.temperature,
        system: agent.config.systemPrompt,
        messages: [{
          role: 'user',
          content: JSON.stringify(task.input),
        }],
      });

      const latency = Date.now() - startTime;
      const content = response.content[0];

      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      let output: unknown;
      try {
        output = JSON.parse(content.text);
      } catch {
        output = content.text;
      }

      // Calculate correctness and completeness
      const { correctness, completeness } = await this.evaluateOutput(
        output,
        task
      );

      return {
        output,
        metrics: {
          latency,
          cost: this.calculateCost(
            agent.config.model,
            response.usage?.input_tokens || 0,
            response.usage?.output_tokens || 0
          ),
          tokenCount: (response.usage?.input_tokens || 0) +
                     (response.usage?.output_tokens || 0),
          correctness,
          completeness,
        },
      };
    } catch (error) {
      return {
        output: null,
        metrics: {
          latency: Date.now() - startTime,
          cost: 0,
          tokenCount: 0,
          correctness: 0,
          completeness: 0,
        },
      };
    }
  }

  private async evaluateOutput(
    output: unknown,
    task: MatchTask
  ): Promise<{ correctness: number; completeness: number }> {
    if (task.expectedOutput) {
      // Automated evaluation against expected output
      const similarity = this.calculateSimilarity(output, task.expectedOutput);
      return {
        correctness: similarity,
        completeness: similarity > 0.5 ? 1 : similarity * 2,
      };
    }

    // LLM-based evaluation
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'You are an expert evaluator. Rate the output on correctness (0-1) and completeness (0-1). Return JSON: {"correctness": number, "completeness": number}',
      messages: [{
        role: 'user',
        content: `Task: ${task.description}
Evaluation criteria: ${task.evaluationCriteria.join(', ')}
Output to evaluate: ${JSON.stringify(output)}`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { correctness: 0.5, completeness: 0.5 };
    }

    try {
      const scores = JSON.parse(content.text);
      return {
        correctness: Math.min(1, Math.max(0, scores.correctness)),
        completeness: Math.min(1, Math.max(0, scores.completeness)),
      };
    } catch {
      return { correctness: 0.5, completeness: 0.5 };
    }
  }

  private async judgeOutputs(
    task: MatchTask,
    result1: { output: unknown; metrics: MatchResult['agents'][0]['metrics'] },
    result2: { output: unknown; metrics: MatchResult['agents'][0]['metrics'] }
  ): Promise<{
    winner: 'agent1' | 'agent2' | 'draw';
    reasoning: string;
    confidence: number;
  }> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are an impartial judge comparing two AI agent outputs.
Evaluate based on: correctness, completeness, clarity, and efficiency.
Return JSON: {"winner": "agent1" | "agent2" | "draw", "reasoning": "string", "confidence": 0-1}`,
      messages: [{
        role: 'user',
        content: `Task: ${task.description}

Evaluation criteria: ${task.evaluationCriteria.join(', ')}

Agent 1 output:
${JSON.stringify(result1.output, null, 2)}
Metrics: latency=${result1.metrics.latency}ms, correctness=${result1.metrics.correctness}, completeness=${result1.metrics.completeness}

Agent 2 output:
${JSON.stringify(result2.output, null, 2)}
Metrics: latency=${result2.metrics.latency}ms, correctness=${result2.metrics.correctness}, completeness=${result2.metrics.completeness}

Which agent performed better? Consider both output quality and efficiency.`,
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return { winner: 'draw', reasoning: 'Unable to judge', confidence: 0 };
    }

    try {
      const judgement = JSON.parse(content.text);
      return {
        winner: judgement.winner,
        reasoning: judgement.reasoning,
        confidence: Math.min(1, Math.max(0, judgement.confidence)),
      };
    } catch {
      return { winner: 'draw', reasoning: content.text, confidence: 0.5 };
    }
  }

  private calculateScore(
    result: { output: unknown; metrics: MatchResult['agents'][0]['metrics'] },
    task: MatchTask
  ): number {
    // Weighted score combining metrics
    const weights = {
      correctness: 0.4,
      completeness: 0.3,
      latency: 0.15,
      cost: 0.15,
    };

    // Normalize latency (lower is better, assume 10s is bad)
    const latencyScore = Math.max(0, 1 - result.metrics.latency / 10000);

    // Normalize cost (lower is better, assume $0.1 is expensive)
    const costScore = Math.max(0, 1 - result.metrics.cost / 0.1);

    return (
      weights.correctness * result.metrics.correctness +
      weights.completeness * result.metrics.completeness +
      weights.latency * latencyScore +
      weights.cost * costScore
    );
  }

  private calculateSimilarity(output: unknown, expected: unknown): number {
    const outStr = JSON.stringify(output).toLowerCase();
    const expStr = JSON.stringify(expected).toLowerCase();

    // Simple Jaccard similarity on words
    const outWords = new Set(outStr.split(/\W+/).filter(w => w.length > 2));
    const expWords = new Set(expStr.split(/\W+/).filter(w => w.length > 2));

    const intersection = new Set([...outWords].filter(w => expWords.has(w)));
    const union = new Set([...outWords, ...expWords]);

    return intersection.size / union.size;
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
      'claude-opus-4-20250514': { input: 0.015, output: 0.075 },
      'claude-haiku-3-20250514': { input: 0.00025, output: 0.00125 },
    };

    const price = pricing[model] || pricing['claude-sonnet-4-20250514'];
    return (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
  }
}
```

---

## Part 4: Tournament Manager

### Tournament Runner

```typescript
export class TournamentManager {
  private ratingEngine: TrueSkillRating;
  private evaluator: MatchEvaluator;
  private registry: AgentRegistry;
  private ratings: Map<string, AgentRating> = new Map();

  constructor(
    apiKey: string,
    registry: AgentRegistry
  ) {
    this.ratingEngine = new TrueSkillRating();
    this.evaluator = new MatchEvaluator(apiKey, registry);
    this.registry = registry;
  }

  async createTournament(
    name: string,
    agentIds: string[],
    config?: Partial<Tournament['config']>
  ): Promise<Tournament> {
    const participants = await Promise.all(
      agentIds.map(async (id) => {
        const spec = await this.registry.getSpec(id);
        if (!spec) throw new Error(`Agent not found: ${id}`);

        // Initialize or get existing rating
        const rating = this.getOrCreateRating(id, spec.name);

        return {
          agentId: id,
          agentName: spec.name,
          initialRating: { ...rating.rating },
        };
      })
    );

    return {
      id: crypto.randomUUID(),
      name,
      status: 'pending',
      createdAt: Date.now(),
      config: {
        matchesPerPair: config?.matchesPerPair || 3,
        taskCount: config?.taskCount || 10,
        minConfidence: config?.minConfidence || 0.7,
        promotionThreshold: config?.promotionThreshold || 0.6,
      },
      participants,
      matches: [],
      standings: [],
      promotions: [],
    };
  }

  async runTournament(
    tournament: Tournament,
    tasks: MatchTask[]
  ): Promise<Tournament> {
    tournament.status = 'running';
    tournament.startedAt = Date.now();

    const pairs = this.generatePairs(tournament.participants);

    // Run matches for each pair
    for (const [agent1, agent2] of pairs) {
      for (let i = 0; i < tournament.config.matchesPerPair; i++) {
        // Select random task
        const task = tasks[Math.floor(Math.random() * tasks.length)];

        // Run match
        const match = await this.evaluator.runMatch(
          agent1.agentId,
          agent2.agentId,
          task
        );

        tournament.matches.push(match);

        // Update ratings
        await this.updateRatingsFromMatch(match);
      }
    }

    // Calculate final standings
    tournament.standings = this.calculateStandings(tournament);

    // Determine promotions
    tournament.promotions = await this.determinePromotions(tournament);

    tournament.status = 'completed';
    tournament.completedAt = Date.now();

    return tournament;
  }

  private generatePairs(
    participants: Tournament['participants']
  ): Array<[Tournament['participants'][0], Tournament['participants'][0]]> {
    const pairs: Array<[Tournament['participants'][0], Tournament['participants'][0]]> = [];

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        pairs.push([participants[i], participants[j]]);
      }
    }

    // Shuffle pairs for variety
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    return pairs;
  }

  private async updateRatingsFromMatch(match: MatchResult): Promise<void> {
    const agent1 = match.agents[0];
    const agent2 = match.agents[1];

    const rating1 = this.getOrCreateRating(agent1.agentId, agent1.agentName);
    const rating2 = this.getOrCreateRating(agent2.agentId, agent2.agentName);

    const isDraw = !match.winner;
    const agent1Wins = match.winner === agent1.agentId;

    // Update using TrueSkill
    const { winner: newWinnerRating, loser: newLoserRating } = this.ratingEngine.updateRatings(
      agent1Wins ? rating1.rating : rating2.rating,
      agent1Wins ? rating2.rating : rating1.rating,
      isDraw
    );

    // Apply new ratings
    if (agent1Wins) {
      this.updateAgentRating(agent1.agentId, newWinnerRating, 'win', agent2.agentId);
      this.updateAgentRating(agent2.agentId, newLoserRating, 'loss', agent1.agentId);
    } else if (isDraw) {
      this.updateAgentRating(agent1.agentId, newWinnerRating, 'draw', agent2.agentId);
      this.updateAgentRating(agent2.agentId, newLoserRating, 'draw', agent1.agentId);
    } else {
      this.updateAgentRating(agent2.agentId, newWinnerRating, 'win', agent1.agentId);
      this.updateAgentRating(agent1.agentId, newLoserRating, 'loss', agent2.agentId);
    }
  }

  private getOrCreateRating(agentId: string, agentName: string): AgentRating {
    let rating = this.ratings.get(agentId);

    if (!rating) {
      rating = {
        agentId,
        agentName,
        rating: this.ratingEngine.createRating(),
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastUpdated: Date.now(),
        history: [],
      };
      this.ratings.set(agentId, rating);
    }

    return rating;
  }

  private updateAgentRating(
    agentId: string,
    newRating: Rating,
    result: 'win' | 'loss' | 'draw',
    opponentId: string
  ): void {
    const rating = this.ratings.get(agentId)!;

    rating.history.push({
      timestamp: Date.now(),
      mu: rating.rating.mu,
      sigma: rating.rating.sigma,
      opponent: opponentId,
      result,
    });

    rating.rating = newRating;
    rating.matches++;

    if (result === 'win') rating.wins++;
    else if (result === 'loss') rating.losses++;
    else rating.draws++;

    rating.lastUpdated = Date.now();
  }

  private calculateStandings(tournament: Tournament): Tournament['standings'] {
    const standings: Tournament['standings'] = [];

    for (const participant of tournament.participants) {
      const rating = this.ratings.get(participant.agentId)!;

      // Calculate stats from tournament matches
      const matches = tournament.matches.filter(m =>
        m.agents.some(a => a.agentId === participant.agentId)
      );

      let wins = 0, losses = 0, draws = 0, totalScore = 0;

      for (const match of matches) {
        const agent = match.agents.find(a => a.agentId === participant.agentId)!;
        totalScore += agent.score;

        if (match.winner === participant.agentId) wins++;
        else if (!match.winner) draws++;
        else losses++;
      }

      standings.push({
        agentId: participant.agentId,
        agentName: participant.agentName,
        rating: { ...rating.rating },
        wins,
        losses,
        draws,
        winRate: matches.length > 0 ? wins / matches.length : 0,
        avgScore: matches.length > 0 ? totalScore / matches.length : 0,
      });
    }

    // Sort by conservative rating (mu - 3*sigma)
    return standings.sort((a, b) => {
      const conservativeA = this.ratingEngine.conservativeRating(a.rating);
      const conservativeB = this.ratingEngine.conservativeRating(b.rating);
      return conservativeB - conservativeA;
    });
  }

  private async determinePromotions(
    tournament: Tournament
  ): Promise<Tournament['promotions']> {
    const promotions: Tournament['promotions'] = [];

    for (const standing of tournament.standings) {
      // Check if agent meets promotion criteria
      if (standing.winRate >= tournament.config.promotionThreshold) {
        // Check against incumbent agents
        const spec = await this.registry.getSpec(standing.agentId);
        if (spec && spec.status === 'candidate') {
          await this.registry.promoteSpec(standing.agentId);

          promotions.push({
            agentId: standing.agentId,
            promotedAt: Date.now(),
            reason: `Win rate ${(standing.winRate * 100).toFixed(1)}% exceeds threshold ${(tournament.config.promotionThreshold * 100).toFixed(1)}%`,
          });
        }
      }
    }

    return promotions;
  }

  getAgentRating(agentId: string): AgentRating | undefined {
    return this.ratings.get(agentId);
  }

  getLeaderboard(): AgentRating[] {
    return Array.from(this.ratings.values())
      .sort((a, b) => {
        const conservativeA = this.ratingEngine.conservativeRating(a.rating);
        const conservativeB = this.ratingEngine.conservativeRating(b.rating);
        return conservativeB - conservativeA;
      });
  }
}
```

---

## Part 5: Promotion System

### Agent Promoter

```typescript
export interface PromotionCriteria {
  minWinRate: number;
  minMatches: number;
  minConfidence: number;  // 1 - sigma/mu
  mustBeatIncumbent: boolean;
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  minWinRate: 0.6,
  minMatches: 5,
  minConfidence: 0.7,
  mustBeatIncumbent: true,
};

export class AgentPromoter {
  private registry: AgentRegistry;
  private tournamentManager: TournamentManager;
  private criteria: PromotionCriteria;

  constructor(
    registry: AgentRegistry,
    tournamentManager: TournamentManager,
    criteria: Partial<PromotionCriteria> = {}
  ) {
    this.registry = registry;
    this.tournamentManager = tournamentManager;
    this.criteria = { ...DEFAULT_PROMOTION_CRITERIA, ...criteria };
  }

  async evaluateForPromotion(agentId: string): Promise<PromotionDecision> {
    const spec = await this.registry.getSpec(agentId);
    if (!spec) {
      return {
        eligible: false,
        reason: 'Agent not found',
        agentId,
      };
    }

    if (spec.status === 'promoted') {
      return {
        eligible: false,
        reason: 'Already promoted',
        agentId,
      };
    }

    const rating = this.tournamentManager.getAgentRating(agentId);
    if (!rating) {
      return {
        eligible: false,
        reason: 'No rating data available',
        agentId,
      };
    }

    // Check minimum matches
    if (rating.matches < this.criteria.minMatches) {
      return {
        eligible: false,
        reason: `Insufficient matches: ${rating.matches}/${this.criteria.minMatches}`,
        agentId,
      };
    }

    // Check win rate
    const winRate = rating.wins / rating.matches;
    if (winRate < this.criteria.minWinRate) {
      return {
        eligible: false,
        reason: `Win rate too low: ${(winRate * 100).toFixed(1)}% < ${(this.criteria.minWinRate * 100).toFixed(1)}%`,
        agentId,
      };
    }

    // Check confidence (rating certainty)
    const confidence = 1 - (rating.rating.sigma / rating.rating.mu);
    if (confidence < this.criteria.minConfidence) {
      return {
        eligible: false,
        reason: `Rating confidence too low: ${(confidence * 100).toFixed(1)}% < ${(this.criteria.minConfidence * 100).toFixed(1)}%`,
        agentId,
      };
    }

    // Check against incumbent if required
    if (this.criteria.mustBeatIncumbent) {
      const incumbent = await this.findIncumbent(spec.name);
      if (incumbent) {
        const incumbentRating = this.tournamentManager.getAgentRating(incumbent.id);
        if (incumbentRating) {
          const conservativeNew = rating.rating.mu - 3 * rating.rating.sigma;
          const conservativeOld = incumbentRating.rating.mu - 3 * incumbentRating.rating.sigma;

          if (conservativeNew <= conservativeOld) {
            return {
              eligible: false,
              reason: `Does not significantly outperform incumbent (${conservativeNew.toFixed(2)} vs ${conservativeOld.toFixed(2)})`,
              agentId,
              incumbentId: incumbent.id,
            };
          }
        }
      }
    }

    return {
      eligible: true,
      reason: 'All promotion criteria met',
      agentId,
      metrics: {
        winRate,
        confidence,
        rating: rating.rating,
        matches: rating.matches,
      },
    };
  }

  async promote(agentId: string): Promise<PromotionResult> {
    const decision = await this.evaluateForPromotion(agentId);

    if (!decision.eligible) {
      return {
        success: false,
        reason: decision.reason,
        agentId,
      };
    }

    // Deprecate incumbent if exists
    if (decision.incumbentId) {
      await this.registry.deprecateSpec(decision.incumbentId);
    }

    // Promote new agent
    await this.registry.promoteSpec(agentId);

    // Update agent version
    const spec = await this.registry.getSpec(agentId);
    if (spec) {
      const versionParts = spec.version.split('.');
      versionParts[1] = String(parseInt(versionParts[1]) + 1);
      versionParts[2] = '0';

      await this.registry.updateSpec(agentId, {
        version: versionParts.join('.'),
        metrics: {
          ...spec.metrics,
          tournamentScore: decision.metrics?.rating.mu,
        },
      });
    }

    return {
      success: true,
      reason: decision.reason,
      agentId,
      promotedAt: Date.now(),
      deprecatedIncumbent: decision.incumbentId,
    };
  }

  private async findIncumbent(agentName: string): Promise<GeneratedAgentSpec | null> {
    // Find promoted agent with similar name/capability
    const promoted = await this.registry.querySpecs({
      status: 'promoted',
      limit: 100,
    });

    // Simple name matching - could be improved with capability matching
    return promoted.find(a =>
      a.name.toLowerCase().includes(agentName.toLowerCase().replace('agent', ''))
    ) || null;
  }

  async batchEvaluate(): Promise<PromotionDecision[]> {
    const candidates = await this.registry.querySpecs({
      status: 'candidate',
      limit: 100,
    });

    const decisions = await Promise.all(
      candidates.map(c => this.evaluateForPromotion(c.id))
    );

    return decisions;
  }
}

export interface PromotionDecision {
  eligible: boolean;
  reason: string;
  agentId: string;
  incumbentId?: string;
  metrics?: {
    winRate: number;
    confidence: number;
    rating: Rating;
    matches: number;
  };
}

export interface PromotionResult {
  success: boolean;
  reason: string;
  agentId: string;
  promotedAt?: number;
  deprecatedIncumbent?: string;
}
```

---

## Part 6: Integration

### Self-Evolution Orchestrator

```typescript
import { PatternDetectionService } from './22-PATTERN-DETECTION';
import { AgentGenerationPipeline } from './23-AGENT-GENERATION';

export class SelfEvolutionOrchestrator {
  private patternService: PatternDetectionService;
  private generationPipeline: AgentGenerationPipeline;
  private tournamentManager: TournamentManager;
  private promoter: AgentPromoter;

  constructor(
    apiKey: string,
    traceStorage: TraceStorage,
    patternStorage: PatternStorage,
    agentRegistry: AgentRegistry,
    outputDir: string
  ) {
    this.patternService = new PatternDetectionService(
      traceStorage,
      patternStorage
    );

    this.generationPipeline = new AgentGenerationPipeline(
      apiKey,
      traceStorage,
      patternStorage,
      agentRegistry,
      outputDir
    );

    this.tournamentManager = new TournamentManager(apiKey, agentRegistry);
    this.promoter = new AgentPromoter(agentRegistry, this.tournamentManager);
  }

  async runEvolutionCycle(projectId: string): Promise<EvolutionCycleResult> {
    const startTime = Date.now();

    // Phase 1: Pattern Detection
    console.log('[EVOLUTION] Phase 1: Pattern Detection');
    const analysis = await this.patternService.runAnalysis(projectId);

    // Phase 2: Agent Generation
    console.log('[EVOLUTION] Phase 2: Agent Generation');
    const gaps = analysis.patterns.filter(p => p.type === 'gap');
    const generationResults = await this.generationPipeline.generateFromGaps(
      gaps as any,
      { optimize: true, generateCode: true }
    );

    const generatedAgents = generationResults
      .filter(r => r.success && r.spec)
      .map(r => r.spec!);

    // Phase 3: Testing
    console.log('[EVOLUTION] Phase 3: Testing');
    const testResults = await Promise.all(
      generatedAgents.map(spec =>
        this.generationPipeline.runTestsForSpec(spec.id)
      )
    );

    // Phase 4: Tournament
    console.log('[EVOLUTION] Phase 4: Tournament');
    const candidateIds = testResults
      .filter(r => r.successRate > 0.5)
      .map(r => r.specId);

    let tournament: Tournament | undefined;
    if (candidateIds.length >= 2) {
      // Get existing promoted agents to compete against
      const incumbents = await this.patternService['storage'].queryPatterns({
        type: 'gap',
        limit: 5,
      });

      const tasks = await this.generateTournamentTasks(gaps);

      tournament = await this.tournamentManager.createTournament(
        `Evolution Cycle ${new Date().toISOString()}`,
        candidateIds
      );

      tournament = await this.tournamentManager.runTournament(tournament, tasks);
    }

    // Phase 5: Promotion
    console.log('[EVOLUTION] Phase 5: Promotion');
    const promotionDecisions = await this.promoter.batchEvaluate();
    const promoted = promotionDecisions.filter(d => d.eligible);

    for (const decision of promoted) {
      await this.promoter.promote(decision.agentId);
    }

    return {
      duration: Date.now() - startTime,
      phases: {
        patternDetection: {
          patternsFound: analysis.patterns.length,
          gapsIdentified: gaps.length,
        },
        agentGeneration: {
          agentsGenerated: generatedAgents.length,
          generationFailures: generationResults.filter(r => !r.success).length,
        },
        testing: {
          agentsTested: testResults.length,
          passingAgents: testResults.filter(r => r.successRate > 0.5).length,
        },
        tournament: tournament ? {
          matchesPlayed: tournament.matches.length,
          standings: tournament.standings,
        } : undefined,
        promotion: {
          evaluated: promotionDecisions.length,
          promoted: promoted.length,
          promotedAgents: promoted.map(d => d.agentId),
        },
      },
    };
  }

  private async generateTournamentTasks(gaps: any[]): Promise<MatchTask[]> {
    // Generate tasks based on the gaps that drove agent generation
    return gaps.slice(0, 10).map((gap, i) => ({
      id: `task-${i}`,
      description: gap.attributes?.requestedCapability || gap.description,
      input: { query: gap.description },
      evaluationCriteria: [
        'Correctness of response',
        'Completeness of solution',
        'Code quality (if applicable)',
        'Response efficiency',
      ],
    }));
  }

  getLeaderboard(): AgentRating[] {
    return this.tournamentManager.getLeaderboard();
  }
}

export interface EvolutionCycleResult {
  duration: number;
  phases: {
    patternDetection: {
      patternsFound: number;
      gapsIdentified: number;
    };
    agentGeneration: {
      agentsGenerated: number;
      generationFailures: number;
    };
    testing: {
      agentsTested: number;
      passingAgents: number;
    };
    tournament?: {
      matchesPlayed: number;
      standings: Tournament['standings'];
    };
    promotion: {
      evaluated: number;
      promoted: number;
      promotedAgents: string[];
    };
  };
}
```

### CLI Commands

```typescript
export const evolutionCommands = {
  'evolve:run': async (orchestrator: SelfEvolutionOrchestrator, projectId: string) => {
    console.log('Starting evolution cycle...');
    const result = await orchestrator.runEvolutionCycle(projectId);

    console.log('\n=== Evolution Cycle Complete ===');
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`\nPattern Detection:`);
    console.log(`  Patterns: ${result.phases.patternDetection.patternsFound}`);
    console.log(`  Gaps: ${result.phases.patternDetection.gapsIdentified}`);
    console.log(`\nAgent Generation:`);
    console.log(`  Generated: ${result.phases.agentGeneration.agentsGenerated}`);
    console.log(`  Failures: ${result.phases.agentGeneration.generationFailures}`);
    console.log(`\nTesting:`);
    console.log(`  Tested: ${result.phases.testing.agentsTested}`);
    console.log(`  Passing: ${result.phases.testing.passingAgents}`);

    if (result.phases.tournament) {
      console.log(`\nTournament:`);
      console.log(`  Matches: ${result.phases.tournament.matchesPlayed}`);
      console.log(`  Top 3 agents:`);
      result.phases.tournament.standings.slice(0, 3).forEach((s, i) => {
        console.log(`    ${i + 1}. ${s.agentName} (${s.wins}W-${s.losses}L)`);
      });
    }

    console.log(`\nPromotion:`);
    console.log(`  Evaluated: ${result.phases.promotion.evaluated}`);
    console.log(`  Promoted: ${result.phases.promotion.promoted}`);

    return result;
  },

  'evolve:leaderboard': async (orchestrator: SelfEvolutionOrchestrator) => {
    const leaderboard = orchestrator.getLeaderboard();

    console.log('\n=== Agent Leaderboard ===');
    leaderboard.forEach((rating, i) => {
      const conservative = rating.rating.mu - 3 * rating.rating.sigma;
      console.log(
        `${i + 1}. ${rating.agentName.padEnd(30)} ` +
        `Rating: ${rating.rating.mu.toFixed(1)} ± ${rating.rating.sigma.toFixed(1)} ` +
        `(${conservative.toFixed(1)}) ` +
        `${rating.wins}W-${rating.losses}L-${rating.draws}D`
      );
    });

    return leaderboard;
  },
};
```

---

## Validation Checklist

- [ ] TrueSkill ratings initialized correctly (mu=25, sigma=8.333)
- [ ] Ratings update after each match based on outcome
- [ ] Win probability calculation matches expected values
- [ ] Match quality indicates how close matches are
- [ ] Matches run both agents on same tasks
- [ ] LLM judge provides reasoning and confidence
- [ ] Scores combine correctness, completeness, latency, cost
- [ ] Tournament generates all pairs of participants
- [ ] Standings sorted by conservative rating
- [ ] Promotion criteria enforced (win rate, matches, confidence)
- [ ] Incumbent comparison prevents premature promotion
- [ ] Deprecated agents marked correctly
- [ ] Evolution cycle runs all phases in order
- [ ] Leaderboard displays current agent rankings

---

## Completion

This completes **CP5: Self-Evolution** and the entire Aigentflow implementation plan.

### Summary of CP5

1. **Execution Tracing** (Step 21): Captures all agent behavior with spans, cost tracking, and decision points
2. **Pattern Detection** (Step 22): Mines success/failure patterns, bottlenecks, and capability gaps
3. **Agent Generation** (Step 23): Creates new agents from gaps using DSPy-inspired prompt optimization
4. **Tournament & Promotion** (Step 24): Evaluates agents competitively and promotes winners

### Full System Capabilities

The complete Aigentflow system now supports:

- CLI-first multi-agent orchestration
- Design system generation with UI mockups and tokens
- Git worktree isolation for parallel feature development
- TDD-based code generation with frontend and backend developers
- Automated testing, bug fixing, and code review
- Merge workflow with conflict resolution
- CI/CD pipeline integration
- Semantic versioning and release management
- Self-evolving agent ecosystem through pattern detection and competitive evaluation

Proceed to production deployment and monitoring.
