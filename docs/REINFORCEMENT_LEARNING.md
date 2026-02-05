# Reinforcement Learning Guide

Comprehensive guide for using Koda's reinforcement learning capabilities.

## Table of Contents

- [Overview](#overview)
- [Algorithms](#algorithms)
- [Quick Start](#quick-start)
- [Q-Learning](#q-learning)
- [Policy Gradient](#policy-gradient)
- [Experience Replay](#experience-replay)
- [Reward System](#reward-system)
- [State Representation](#state-representation)
- [Persistent Learning](#persistent-learning)
- [Examples](#examples)

## Overview

Koda includes a comprehensive reinforcement learning system that enables the agent to learn and improve from experience. The system supports:

- **Q-Learning**: Value-based learning for discrete actions
- **Policy Gradient**: Direct policy optimization
- **Experience Replay**: Batch learning from past experiences
- **Reward Shaping**: Intelligent reward calculation
- **Persistent Learning**: Database storage for continuous improvement

## Algorithms

### Available Algorithms

1. **Q-Learning** (`qlearning`)
   - Best for: Discrete action spaces, simple environments
   - Learns action-value function (Q-values)
   - Uses epsilon-greedy exploration

2. **Policy Gradient** (`policy`)
   - Best for: Complex action sequences, continuous control
   - Directly learns policy (action probabilities)
   - Uses REINFORCE and Actor-Critic methods

3. **Hybrid** (`hybrid`)
   - Best for: Complex environments requiring both
   - Combines Q-learning and Actor-Critic
   - Balances exploration and exploitation

## Quick Start

### Basic Setup

```javascript
const { ReinforcementAgent } = require('@trentpierce/browser-agent/learning');

// Create RL agent
const agent = new ReinforcementAgent({
    algorithm: 'qlearning',
    platform: 'web',
    enableDatabase: true
});

// Initialize
await agent.initialize();

// Use in learning loop
for (let episode = 0; episode < 100; episode++) {
    let state = getCurrentState();
    let done = false;

    while (!done) {
        // Choose action
        const action = agent.chooseAction(state);

        // Execute action
        const { reward, nextState, done: isDone } = await executeAction(action);

        // Learn from experience
        await agent.learn(state, action, reward, nextState, isDone);

        state = nextState;
        done = isDone;
    }
}

// Save learned knowledge
await agent.close();
```

## Q-Learning

### Configuration

```javascript
const agent = new ReinforcementAgent({
    algorithm: 'qlearning',
    qLearningConfig: {
        learningRate: 0.1,          // How fast to learn (0-1)
        discountFactor: 0.95,       // Future reward importance (0-1)
        explorationRate: 0.3,       // Random action probability (0-1)
        explorationDecay: 0.995,    // Decay rate per step
        minExplorationRate: 0.05    // Minimum exploration
    }
});
```

### Usage

```javascript
// Choose action (epsilon-greedy)
const action = agent.chooseAction(state);

// Get best known action
const bestAction = agent.getBestAction(state);

// Get Q-value for state-action pair
const qValue = agent.getQValue(state, 'click');

// Manual update
agent.qLearning.update(state, action, reward, nextState, done);

// Batch update
const experiences = [
    { state: s1, action: a1, reward: r1, nextState: ns1, done: false },
    { state: s2, action: a2, reward: r2, nextState: ns2, done: true }
];
agent.qLearning.batchUpdate(experiences);
```

### Q-Table Management

```javascript
// Export Q-table
const qTableData = agent.qLearning.export();

// Import Q-table
agent.qLearning.import(qTableData);

// Get Q-table size
const size = agent.qLearning.getSize();

// Get statistics for state
const stats = agent.qLearning.getStateStats(state);
console.log('Actions:', stats.actions);
console.log('Max Q-value:', stats.max);
```

## Policy Gradient

### Configuration

```javascript
const agent = new ReinforcementAgent({
    algorithm: 'policy',
    policyConfig: {
        learningRate: 0.001,        // Policy update rate
        gamma: 0.99,                // Discount factor
        entropyCoefficient: 0.01,   // Exploration bonus
        valueCoefficient: 0.5       // Value function weight
    }
});
```

### Usage

```javascript
// Sample action from policy
const action = agent.policyGradient.sampleAction(state);

// Get policy for state
const policy = agent.getPolicy(state);
console.log('Action probabilities:', policy);

// Get policy statistics
const stats = agent.policyGradient.getPolicyStats(state);
console.log('Best action:', stats.bestAction);
console.log('Entropy:', stats.entropy);
console.log('State value:', stats.value);

// Store transition for episode
agent.policyGradient.storeTransition(state, action, reward, nextState, done);

// Update policy (at end of episode)
agent.policyGradient.updateReinforce();
// or
agent.policyGradient.updateActorCritic();
```

## Experience Replay

### Configuration

```javascript
const agent = new ReinforcementAgent({
    replayConfig: {
        maxSize: 10000,             // Maximum experiences to store
        batchSize: 32,              // Batch size for sampling
        priorityAlpha: 0.6,         // Priority exponent
        usePriority: true           // Use prioritized replay
    }
});
```

### Usage

```javascript
const replay = agent.experienceReplay;

// Add experience
replay.add({
    state,
    action,
    reward,
    nextState,
    done
});

// Sample batch
const batch = replay.sample(32);

// Get successful experiences
const successful = replay.getSuccessful(5.0);

// Get failed experiences
const failed = replay.getFailed(-3.0);

// Get recent experiences
const recent = replay.getRecent(100);

// Get statistics
const stats = replay.getStats();
console.log('Buffer size:', stats.size);
console.log('Success rate:', stats.successRate);
console.log('Average reward:', stats.avgReward);
```

## Reward System

### Configuration

```javascript
const agent = new ReinforcementAgent({
    rewardConfig: {
        successReward: 10.0,        // Goal achieved
        progressReward: 5.0,        // Made progress
        neutralReward: 0.0,         // No change
        failurePenalty: -5.0,       // Action failed
        errorPenalty: -10.0,        // Error occurred
        stuckPenalty: -3.0,         // Stuck in loop
        efficiencyBonus: 2.0,       // Fast completion
        timeoutPenalty: -8.0        // Action timeout
    }
});
```

### Reward Calculation

```javascript
const outcome = {
    action: 'click',
    success: true,
    error: null,
    stateChange: {
        from: 'LOGIN',
        to: 'HOME'
    },
    goalProgress: 'progress',
    timeTaken: 1500,
    isStuck: false,
    timeout: false,
    
    // Action-specific
    elementVisible: true,
    inputAccepted: true,
    newContentRevealed: true
};

const reward = agent.calculateReward(outcome);
console.log('Calculated reward:', reward);
```

### Reward Shaping

```javascript
// Get shaping reward for intermediate steps
const progress = {
    currentStep: 5,
    totalSteps: 10,
    distanceToGoal: 3,
    previousDistance: 5
};

const shapingReward = agent.rewardSystem.getShapingReward(progress);
```

### Goal Completion Reward

```javascript
const outcome = {
    goalAchieved: true,
    stepsCount: 15,
    timeElapsed: 45000,
    errorsCount: 2,
    optimalSteps: 12
};

const goalReward = agent.rewardSystem.calculateGoalReward(outcome);
```

## State Representation

### Creating States

```javascript
const { StateRepresentation } = require('@trentpierce/browser-agent/learning');

// For web
const webState = new StateRepresentation('web');
const state = webState.createState({
    url: 'https://example.com/login',
    title: 'Login Page',
    dom: '<div>...</div>',
    viewport: { width: 1920, height: 1080 },
    loadState: 'complete'
});

// For mobile
const mobileState = new StateRepresentation('android');
const state = mobileState.createState({
    screenType: 'LOGIN',
    elements: [...],
    navigationContext: { hasBackButton: true },
    hasModal: false
});
```

### State Features

```javascript
const representation = new StateRepresentation('web');

// Extract features for learning
const features = representation.extractFeatures(state);
console.log('Features:', features);

// Calculate similarity between states
const similarity = representation.calculateSimilarity(state1, state2);
console.log('Similarity:', similarity);

// Create compact state key
const key = representation.createStateKey(state);
console.log('State key:', key);
```

## Persistent Learning

### Database Setup

```javascript
const { LearningDatabase } = require('@trentpierce/browser-agent/learning');

const db = new LearningDatabase('./learning_memory.db');
await db.initialize();
```

### Saving and Loading

```javascript
// Automatic saving with RL agent
const agent = new ReinforcementAgent({
    enableDatabase: true,
    dbPath: './learning_memory.db',
    saveFrequency: 100  // Save every 100 steps
});

await agent.initialize();  // Automatically loads

// Manual saving
await agent.saveToDatabase();

// Export all learning data
const data = await agent.database.exportAll();
```

### Database Operations

```javascript
// Q-values
db.saveQValue(stateKey, action, qValue);
const qValue = db.loadQValue(stateKey, action);
const qTable = db.loadQTable();

// Policy
db.savePolicy(stateKey, action, probability);
const policy = db.loadPolicy(stateKey);

// Experiences
db.saveExperience({ state, action, reward, nextState, done });
const experiences = db.loadRecentExperiences(1000);
const successful = db.loadSuccessfulExperiences(5.0, 500);

// Sessions
const sessionId = db.startSession('qlearning', 'web', 'Login test');
db.endSession(sessionId, 50, 125.5, true);

// Statistics
const stats = db.getStatistics();
console.log('Learning stats:', stats);

// Cleanup
db.cleanOldExperiences(30);  // Remove old negative experiences
```

## Examples

### Complete Web Automation with RL

```javascript
const puppeteer = require('puppeteer');
const { ReinforcementAgent, StateRepresentation } = require('@trentpierce/browser-agent/learning');

async function learnWebNavigation() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    const rlAgent = new ReinforcementAgent({
        algorithm: 'qlearning',
        platform: 'web',
        enableDatabase: true
    });
    
    const stateRep = new StateRepresentation('web');
    await rlAgent.initialize();
    
    try {
        for (let episode = 0; episode < 50; episode++) {
            await page.goto('https://example.com');
            
            let state = stateRep.createState({
                url: page.url(),
                title: await page.title(),
                dom: await page.content(),
                viewport: page.viewport(),
                loadState: 'complete'
            });
            
            let done = false;
            let steps = 0;
            
            while (!done && steps < 20) {
                // Choose action
                const validActions = ['click', 'type', 'scroll', 'navigate'];
                const action = rlAgent.chooseAction(state, validActions);
                
                // Execute action
                let outcome;
                try {
                    if (action === 'click') {
                        await page.click('a');
                        outcome = { success: true, elementVisible: true };
                    } else if (action === 'scroll') {
                        await page.evaluate(() => window.scrollBy(0, 500));
                        outcome = { success: true, newContentRevealed: true };
                    }
                    
                    await page.waitForTimeout(1000);
                } catch (error) {
                    outcome = { success: false, error: error.message };
                }
                
                // Get next state
                const nextState = stateRep.createState({
                    url: page.url(),
                    title: await page.title(),
                    dom: await page.content(),
                    viewport: page.viewport(),
                    loadState: 'complete'
                });
                
                // Calculate reward
                const reward = rlAgent.calculateReward({
                    action,
                    ...outcome,
                    stateChange: {
                        from: state.pageType,
                        to: nextState.pageType
                    },
                    goalProgress: nextState.pageType === 'SUCCESS' ? 'complete' : 'progress'
                });
                
                // Learn
                done = nextState.pageType === 'SUCCESS';
                await rlAgent.learn(state, action, reward, nextState, done);
                
                state = nextState;
                steps++;
            }
            
            console.log(`Episode ${episode + 1} complete`);
        }
        
        // Print statistics
        console.log('Learning complete:', rlAgent.getStats());
    } finally {
        await rlAgent.close();
        await browser.close();
    }
}

learnWebNavigation();
```

### Mobile App Learning

```javascript
const { MobileAgent } = require('@trentpierce/browser-agent/mobile');
const { ReinforcementAgent } = require('@trentpierce/browser-agent/learning');

async function learnMobileApp() {
    const mobileAgent = new MobileAgent({
        platform: 'android',
        deviceName: 'Pixel_6_API_33',
        appPackage: 'com.example.app',
        enableLearning: true
    });
    
    const rlAgent = new ReinforcementAgent({
        algorithm: 'hybrid',
        platform: 'android',
        enableDatabase: true
    });
    
    await mobileAgent.initialize();
    await rlAgent.initialize();
    
    try {
        for (let episode = 0; episode < 100; episode++) {
            await mobileAgent.launchApp();
            
            let state = await mobileAgent.getState();
            let done = false;
            let steps = 0;
            
            while (!done && steps < 30) {
                // Choose action
                const validActions = ['tap', 'swipe', 'type', 'longPress'];
                const action = rlAgent.chooseAction(state, validActions);
                
                // Execute action
                const outcome = await mobileAgent.executeAction(action, {
                    selector: '~nextButton',
                    direction: 'up',
                    text: 'test input'
                });
                
                // Get next state
                const nextState = await mobileAgent.getState();
                
                // Check if stuck
                outcome.isStuck = mobileAgent.isStuck();
                
                // Calculate reward
                const reward = rlAgent.calculateReward({
                    ...outcome,
                    stateChange: {
                        from: state.screenType,
                        to: nextState.screenType
                    }
                });
                
                // Learn
                done = nextState.screenType === 'SUCCESS';
                await rlAgent.learn(state, action, reward, nextState, done);
                
                state = nextState;
                steps++;
            }
            
            await mobileAgent.closeApp();
            console.log(`Episode ${episode + 1}: Steps=${steps}, Reward=${rlAgent.episodeRewards.reduce((a,b)=>a+b, 0).toFixed(2)}`);
        }
        
        const stats = rlAgent.getStats();
        console.log('\nFinal Statistics:');
        console.log('Total Steps:', stats.totalSteps);
        console.log('Episodes:', stats.episodes);
        console.log('Q-Table Size:', stats.qTableSize);
        console.log('Exploration Rate:', stats.explorationRate.toFixed(3));
    } finally {
        await rlAgent.close();
        await mobileAgent.close();
    }
}

learnMobileApp();
```

### Transfer Learning Between Platforms

```javascript
const { ReinforcementAgent } = require('@trentpierce/browser-agent/learning');

async function transferLearning() {
    // Train on web
    const webAgent = new ReinforcementAgent({
        algorithm: 'qlearning',
        platform: 'web',
        enableDatabase: true,
        dbPath: './web_learning.db'
    });
    
    await webAgent.initialize();
    // ... train on web ...
    
    // Export learned knowledge
    const learnedData = webAgent.export();
    await webAgent.close();
    
    // Transfer to mobile
    const mobileAgent = new ReinforcementAgent({
        algorithm: 'qlearning',
        platform: 'android',
        enableDatabase: true,
        dbPath: './mobile_learning.db'
    });
    
    await mobileAgent.initialize();
    
    // Import web knowledge (with adaptation)
    mobileAgent.import({
        ...learnedData,
        qLearning: {
            ...learnedData.qLearning,
            config: {
                ...learnedData.qLearning.config,
                explorationRate: 0.5  // Higher exploration for new platform
            }
        }
    });
    
    // Continue learning on mobile
    // ... train on mobile ...
    
    await mobileAgent.close();
}

transferLearning();
```

## Best Practices

1. **Start with Q-Learning**
   - Simpler to understand and debug
   - Works well for most automation tasks

2. **Use Experience Replay**
   - Improves sample efficiency
   - Stabilizes learning

3. **Enable Persistent Learning**
   - Always use database for continuous improvement
   - Agent gets better over time

4. **Tune Exploration Rate**
   - Start high (0.3-0.5) for new environments
   - Let it decay naturally
   - Keep minimum exploration (0.05-0.1)

5. **Design Good Rewards**
   - Positive rewards for progress
   - Penalties for errors and inefficiency
   - Bonus for goal achievement

6. **Monitor Statistics**
   - Check Q-table size growth
   - Watch success rate improve
   - Track average rewards

7. **Use Hybrid for Complex Tasks**
   - Combines benefits of both algorithms
   - Better for multi-step tasks

## Performance Tips

- Set appropriate `updateFrequency` (10-50)
- Use `saveFrequency` of 100-500 for efficiency
- Clean old experiences periodically
- Use prioritized replay for faster learning
- Start with smaller state representations

## Next Steps

- See [Mobile Automation Guide](./MOBILE_AUTOMATION.md) for mobile integration
- Check [API Reference](./API_REFERENCE.md) for detailed API
- Explore [Examples](../examples/) for more use cases
