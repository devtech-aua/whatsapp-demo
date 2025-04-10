const mongoose = require('mongoose');

const userStateSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    currentState: {
        type: String,
        enum: ['awaiting_command', 'selecting_locations', 'selecting_sources', 'awaiting_review_question'],
        default: 'awaiting_command'
    },
    selections: {
        locations: [String],
        sources: [String]
    },
    lastInteraction: {
        type: Date,
        default: Date.now
    },
    lastMessage: {
        content: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        direction: {
            type: String,
            enum: ['incoming', 'outgoing']
        }
    },
    sessionStarted: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Add method to update last message
userStateSchema.methods.updateLastMessage = function(content, direction) {
    this.lastMessage = {
        content,
        timestamp: new Date(),
        direction
    };
    this.lastInteraction = new Date();
    return this.save();
};

// Add method to clear selections
userStateSchema.methods.clearSelections = function() {
    this.selections = {
        locations: [],
        sources: []
    };
    return this.save();
};

// Add method to end session
userStateSchema.methods.endSession = function() {
    this.isActive = false;
    this.currentState = 'awaiting_command';
    return this.save();
};

module.exports = mongoose.model('UserState', userStateSchema);
