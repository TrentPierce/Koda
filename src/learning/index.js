/**
 * Reinforcement Learning Module
 * Exports all learning-related classes
 */

const ReinforcementAgent = require('./reinforcementAgent');
const QLearning = require('./qLearning');
const RewardSystem = require('./rewardSystem');
const ExperienceReplay = require('./experienceReplay');
const PolicyGradient = require('./policyGradient');
const LearningDatabase = require('./learningDatabase');
const StateRepresentation = require('./stateRepresentation');

module.exports = {
    ReinforcementAgent,
    QLearning,
    RewardSystem,
    ExperienceReplay,
    PolicyGradient,
    LearningDatabase,
    StateRepresentation
};
