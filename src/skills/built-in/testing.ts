/**
 * Testing Skill Pack
 *
 * Skills for test writing and TDD practices.
 */

import type { SkillPack, Skill } from '../types.js';

/**
 * TDD principles skill
 */
const tddSkill: Skill = {
  id: 'tdd-principles',
  name: 'TDD Principles',
  description: 'Test-Driven Development workflow and practices',
  category: 'testing',
  priority: 'high',
  version: '1.0.0',
  tokenEstimate: 400,
  conditions: [
    { field: 'taskType', operator: 'contains', value: ['feature', 'bugfix'] },
  ],
  dependencies: [],
  conflicts: [],
  content: `## Test-Driven Development

### TDD Cycle
1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass
3. **Refactor**: Improve code, keep tests passing

### Test First Benefits
- Forces clear requirements thinking
- Ensures testable code design
- Documents expected behavior
- Prevents over-engineering

### Writing Tests First
- Start with the simplest case
- One assertion per test concept
- Test behavior, not implementation
- Name tests as specifications

### When to Refactor
- After each green phase
- When duplication appears
- When names aren't clear
- Never skip this step`,
  examples: [
    {
      title: 'Test-first example',
      input: 'Add function',
      output: 'test("add returns sum of two numbers", () => expect(add(2, 3)).toBe(5))',
    },
  ],
  tags: ['tdd', 'testing', 'workflow'],
  enabled: true,
};

/**
 * Unit testing skill
 */
const unitTestSkill: Skill = {
  id: 'unit-testing',
  name: 'Unit Testing Patterns',
  description: 'Patterns for effective unit tests',
  category: 'testing',
  priority: 'high',
  version: '1.0.0',
  tokenEstimate: 450,
  conditions: [],  // Always applicable
  dependencies: [],
  conflicts: [],
  content: `## Unit Testing Patterns

### Test Structure (AAA)
- **Arrange**: Set up test data and conditions
- **Act**: Execute the code under test
- **Assert**: Verify the expected outcome

### Test Naming
- describe: noun (the unit being tested)
- it/test: verb phrase (the behavior)
- Example: describe("Calculator") it("should add two numbers")

### Test Isolation
- Each test independent
- No shared mutable state
- Reset mocks between tests
- Use beforeEach for common setup

### What to Test
- Public API behavior
- Edge cases and boundaries
- Error conditions
- State transitions

### What NOT to Test
- Private implementation details
- Third-party library internals
- Trivial code (getters/setters)
- Configuration files`,
  examples: [
    {
      title: 'AAA pattern',
      input: 'Test user creation',
      output: 'const user = createUser("test"); expect(user.name).toBe("test");',
    },
  ],
  tags: ['unit-tests', 'testing', 'patterns'],
  enabled: true,
};

/**
 * Vitest patterns skill
 */
const vitestSkill: Skill = {
  id: 'vitest-patterns',
  name: 'Vitest Patterns',
  description: 'Patterns specific to Vitest testing framework',
  category: 'testing',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 350,
  conditions: [
    { field: 'frameworks', operator: 'contains', value: 'vitest' },
  ],
  dependencies: ['unit-testing'],
  conflicts: ['jest-patterns'],
  content: `## Vitest Patterns

### Setup
- Use describe/it/expect from 'vitest'
- Configure in vitest.config.ts
- Use workspace for monorepos

### Mocking
- vi.fn() for function mocks
- vi.mock() for module mocks
- vi.spyOn() for method spies
- vi.restoreAllMocks() in afterEach

### Async Testing
- Return promises or use async/await
- Use waitFor for async assertions
- Set timeout for long operations

### Snapshot Testing
- Use toMatchSnapshot() sparingly
- toMatchInlineSnapshot() for small outputs
- Update with --update flag

### Coverage
- Configure coverage in config
- Use c8 or v8 provider
- Set thresholds for CI`,
  examples: [
    {
      title: 'Mock module',
      input: 'Mock fs module',
      output: "vi.mock('fs', () => ({ readFileSync: vi.fn() }))",
    },
  ],
  tags: ['vitest', 'testing', 'mocking'],
  enabled: true,
};

/**
 * Jest patterns skill (conflicts with Vitest)
 */
const jestSkill: Skill = {
  id: 'jest-patterns',
  name: 'Jest Patterns',
  description: 'Patterns specific to Jest testing framework',
  category: 'testing',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 350,
  conditions: [
    { field: 'frameworks', operator: 'contains', value: 'jest' },
  ],
  dependencies: ['unit-testing'],
  conflicts: ['vitest-patterns'],
  content: `## Jest Patterns

### Setup
- Configure in jest.config.js
- Use setupFilesAfterEnv for globals
- Transform TypeScript with ts-jest

### Mocking
- jest.fn() for function mocks
- jest.mock() for module mocks
- jest.spyOn() for method spies
- jest.clearAllMocks() in afterEach

### Async Testing
- Return promises or use async/await
- Use done callback for callbacks
- Set timeout with jest.setTimeout()

### Matchers
- Use toBe for primitives
- Use toEqual for objects
- Use toMatchObject for partial match
- Use toThrow for exceptions`,
  examples: [
    {
      title: 'Mock implementation',
      input: 'Mock with return value',
      output: 'jest.fn().mockReturnValue(42)',
    },
  ],
  tags: ['jest', 'testing', 'mocking'],
  enabled: true,
};

/**
 * Integration testing skill
 */
const integrationTestSkill: Skill = {
  id: 'integration-testing',
  name: 'Integration Testing',
  description: 'Patterns for integration tests',
  category: 'testing',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 300,
  conditions: [
    { field: 'taskType', operator: 'equals', value: 'feature' },
  ],
  dependencies: ['unit-testing'],
  conflicts: [],
  content: `## Integration Testing

### Scope
- Test multiple units together
- Verify module interactions
- Test API endpoints end-to-end
- Include database operations

### Setup
- Use test databases
- Seed with known data
- Clean up after tests
- Isolate from external services

### Best Practices
- Fewer than unit tests
- Test critical paths
- Use realistic data
- Test error scenarios

### Test Environment
- Separate from production
- Reproducible state
- Fast reset capability
- Mock external APIs`,
  examples: [
    {
      title: 'API test',
      input: 'Test endpoint',
      output: 'const res = await request(app).get("/users"); expect(res.status).toBe(200);',
    },
  ],
  tags: ['integration', 'testing', 'api'],
  enabled: true,
};

/**
 * Mocking patterns skill
 */
const mockingSkill: Skill = {
  id: 'mocking-patterns',
  name: 'Mocking Patterns',
  description: 'Patterns for test doubles and mocks',
  category: 'testing',
  priority: 'medium',
  version: '1.0.0',
  tokenEstimate: 350,
  conditions: [],
  dependencies: ['unit-testing'],
  conflicts: [],
  content: `## Mocking Patterns

### Test Doubles Types
- **Stub**: Returns canned values
- **Mock**: Verifies interactions
- **Spy**: Records calls, passes through
- **Fake**: Working implementation

### When to Mock
- External services (APIs, DBs)
- Time-dependent code
- Random/non-deterministic
- Expensive operations

### When NOT to Mock
- The unit under test
- Value objects
- Simple utilities
- Things that are fast and reliable

### Mock Verification
- Verify important interactions
- Don't over-specify
- Check call arguments when relevant
- Prefer output verification over mocks`,
  examples: [
    {
      title: 'Stub example',
      input: 'Stub API response',
      output: 'vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => data })',
    },
  ],
  tags: ['mocking', 'testing', 'doubles'],
  enabled: true,
};

/**
 * Testing skill pack
 */
export const testingSkillPack: SkillPack = {
  id: 'built-in-testing',
  name: 'Testing Skills',
  description: 'Built-in skills for test writing and TDD',
  version: '1.0.0',
  skills: [
    tddSkill,
    unitTestSkill,
    vitestSkill,
    jestSkill,
    integrationTestSkill,
    mockingSkill,
  ],
  author: 'Aigentflow',
};

export default testingSkillPack;
