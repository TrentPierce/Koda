/**
 * Complete Example: Mobile Automation with Reinforcement Learning
 * 
 * This example demonstrates:
 * 1. Mobile app automation on Android
 * 2. Reinforcement learning integration
 * 3. Persistent learning across sessions
 * 4. Cross-platform capabilities
 */

const { MobileAgent } = require('../src/mobile');
const { ReinforcementAgent } = require('../src/learning');

/**
 * Example 1: Basic Mobile Automation
 */
async function basicMobileAutomation() {
    console.log('\n=== Example 1: Basic Mobile Automation ===\n');
    
    const agent = new MobileAgent({
        platform: 'android',
        deviceName: 'Pixel_6_API_33',
        platformVersion: '13.0',
        appPackage: 'com.android.settings',
        appActivity: '.Settings'
    });

    try {
        await agent.initialize();
        console.log('Mobile agent initialized');

        // Navigate through settings
        await agent.tap('About phone');
        console.log('Tapped About phone');

        await agent.scroll({ direction: 'down' });
        console.log('Scrolled down');

        // Take screenshot
        await agent.screenshot('./screenshots/settings.png');
        console.log('Screenshot saved');

        // Get current state
        const state = await agent.getState();
        console.log('Current screen:', state.screenType);
        console.log('Elements found:', state.elementCount);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await agent.close();
        console.log('Agent closed');
    }
}

/**
 * Example 2: Q-Learning for Web Automation
 */
async function qLearningWebAutomation() {
    console.log('\n=== Example 2: Q-Learning for Web Automation ===\n');
    
    const puppeteer = require('puppeteer');
    const { StateRepresentation } = require('../src/learning');
    
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    const rlAgent = new ReinforcementAgent({
        algorithm: 'qlearning',
        platform: 'web',
        enableDatabase: true,
        dbPath: './learning_web.db',
        qLearningConfig: {
            learningRate: 0.1,
            explorationRate: 0.3
        }
    });
    
    const stateRep = new StateRepresentation('web');
    await rlAgent.initialize();
    
    console.log('Starting Q-learning training...');
    
    try {
        for (let episode = 0; episode < 10; episode++) {
            await page.goto('https://example.com');
            
            let state = stateRep.createState({
                url: page.url(),
                title: await page.title(),
                dom: await page.content(),
                viewport: page.viewport(),
                loadState: 'complete'
            });
            
            let episodeReward = 0;
            let steps = 0;
            
            while (steps < 10) {
                // Choose action
                const action = rlAgent.chooseAction(state, ['click', 'scroll']);
                
                // Execute
                let success = true;
                try {
                    if (action === 'click') {
                        await page.click('a');
                    } else {
                        await page.evaluate(() => window.scrollBy(0, 500));
                    }
                } catch (e) {
                    success = false;
                }
                
                await page.waitForTimeout(500);
                
                // Next state
                const nextState = stateRep.createState({
                    url: page.url(),
                    title: await page.title(),
                    dom: await page.content(),
                    viewport: page.viewport(),
                    loadState: 'complete'
                });
                
                // Reward
                const reward = success ? 1.0 : -1.0;
                episodeReward += reward;
                
                // Learn
                await rlAgent.learn(state, action, reward, nextState, false);
                
                state = nextState;
                steps++;
            }
            
            console.log(`Episode ${episode + 1}: Reward=${episodeReward.toFixed(2)}, Steps=${steps}`);
        }
        
        const stats = rlAgent.getStats();
        console.log('\nTraining complete!');
        console.log('Q-Table size:', stats.qTableSize);
        console.log('Exploration rate:', stats.explorationRate.toFixed(3));
        
    } finally {
        await rlAgent.close();
        await browser.close();
    }
}

/**
 * Example 3: Mobile App with Reinforcement Learning
 */
async function mobileWithRL() {
    console.log('\n=== Example 3: Mobile App with RL ===\n');
    
    const mobileAgent = new MobileAgent({
        platform: 'android',
        deviceName: 'Pixel_6_API_33',
        platformVersion: '13.0',
        appPackage: 'com.android.settings',
        appActivity: '.Settings',
        enableLearning: true
    });
    
    const rlAgent = new ReinforcementAgent({
        algorithm: 'qlearning',
        platform: 'android',
        enableDatabase: true,
        dbPath: './learning_mobile.db'
    });
    
    await mobileAgent.initialize();
    await rlAgent.initialize();
    
    console.log('Starting mobile RL training...');
    
    try {
        for (let episode = 0; episode < 5; episode++) {
            let state = await mobileAgent.getState();
            let episodeReward = 0;
            let steps = 0;
            
            while (steps < 10) {
                // Choose action
                const validActions = ['tap', 'swipe', 'scroll'];
                const action = rlAgent.chooseAction(state, validActions);
                
                // Execute
                const outcome = await mobileAgent.executeAction(action, {
                    selector: 'Network & internet',
                    direction: 'down'
                });
                
                // Next state
                const nextState = await mobileAgent.getState();
                
                // Calculate reward
                const reward = rlAgent.calculateReward({
                    ...outcome,
                    stateChange: {
                        from: state.screenType,
                        to: nextState.screenType
                    },
                    isStuck: mobileAgent.isStuck()
                });
                
                episodeReward += reward;
                
                // Learn
                await rlAgent.learn(state, action, reward, nextState, false);
                
                state = nextState;
                steps++;
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            console.log(`Episode ${episode + 1}: Reward=${episodeReward.toFixed(2)}`);
        }
        
        console.log('\nTraining complete!');
        console.log('Stats:', rlAgent.getStats());
        
    } finally {
        await rlAgent.close();
        await mobileAgent.close();
    }
}

/**
 * Example 4: Policy Gradient Method
 */
async function policyGradientExample() {
    console.log('\n=== Example 4: Policy Gradient ===\n');
    
    const rlAgent = new ReinforcementAgent({
        algorithm: 'policy',
        platform: 'web',
        enableDatabase: true,
        policyConfig: {
            learningRate: 0.001,
            gamma: 0.99
        }
    });
    
    await rlAgent.initialize();
    
    console.log('Training with policy gradient...');
    
    // Simulate training
    for (let episode = 0; episode < 5; episode++) {
        const state = {
            platform: 'web',
            pageType: 'HOME',
            elementCount: 20,
            hasModal: false
        };
        
        let episodeReward = 0;
        
        for (let step = 0; step < 10; step++) {
            // Sample action from policy
            const action = rlAgent.chooseAction(state);
            
            // Simulate outcome
            const reward = Math.random() > 0.5 ? 1.0 : -0.5;
            episodeReward += reward;
            
            const nextState = { ...state, pageType: 'LIST' };
            
            // Learn
            await rlAgent.learn(state, action, reward, nextState, step === 9);
        }
        
        console.log(`Episode ${episode + 1}: Reward=${episodeReward.toFixed(2)}`);
    }
    
    // Get policy for state
    const testState = {
        platform: 'web',
        pageType: 'HOME',
        elementCount: 20,
        hasModal: false
    };
    
    const policy = rlAgent.getPolicy(testState);
    console.log('\nLearned policy:', policy);
    
    await rlAgent.close();
}

/**
 * Example 5: Experience Replay
 */
async function experienceReplayExample() {
    console.log('\n=== Example 5: Experience Replay ===\n');
    
    const { ExperienceReplay } = require('../src/learning');
    
    const replay = new ExperienceReplay({
        maxSize: 1000,
        batchSize: 32,
        usePriority: true
    });
    
    // Add experiences
    for (let i = 0; i < 100; i++) {
        replay.add({
            state: { id: i },
            action: 'click',
            reward: Math.random() * 10 - 5,
            nextState: { id: i + 1 },
            done: false
        });
    }
    
    console.log('Added 100 experiences');
    
    // Sample batch
    const batch = replay.sample(10);
    console.log('Sampled batch size:', batch.length);
    
    // Get statistics
    const stats = replay.getStats();
    console.log('\nReplay Buffer Stats:');
    console.log('Size:', stats.size);
    console.log('Avg Reward:', stats.avgReward.toFixed(2));
    console.log('Success Rate:', (stats.successRate * 100).toFixed(1) + '%');
    
    // Get successful experiences
    const successful = replay.getSuccessful(3.0);
    console.log('Successful experiences:', successful.length);
}

/**
 * Main execution
 */
async function main() {
    console.log('Koda Mobile & RL Examples\n');
    console.log('=' .repeat(50));
    
    try {
        // Run examples
        // await basicMobileAutomation();
        // await qLearningWebAutomation();
        // await mobileWithRL();
        await policyGradientExample();
        await experienceReplayExample();
        
        console.log('\n' + '='.repeat(50));
        console.log('All examples completed!');
    } catch (error) {
        console.error('Error running examples:', error);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    basicMobileAutomation,
    qLearningWebAutomation,
    mobileWithRL,
    policyGradientExample,
    experienceReplayExample
};
