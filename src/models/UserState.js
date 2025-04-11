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
        enum: ['awaiting_command', 'selecting_locations', 'selecting_sources', 'awaiting_review_question', 'processing_review'],
        default: 'awaiting_command'
    },
    isActive: {
        type: Boolean,
        default: false
    },
    lastMessageTime: {
        type: Date,
        default: Date.now
    },
    lastProcessingTime: {
        type: Date
    },
    selections: {
        locations: [String],
        sources: [String]
    },
    messages: [{
        content: String,
        direction: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    lastInteraction: {
        type: Date,
        default: Date.now
    },
    sessionStarted: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Add method to update last message
userStateSchema.methods.updateLastMessage = async function(content, direction) {
    this.messages.push({ content, direction });
    this.lastMessageTime = new Date();
    this.lastInteraction = new Date();
    await this.save();
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

// Add method to check if can process
userStateSchema.methods.canProcess = function() {
    if (!this.lastProcessingTime) return true;
    const now = new Date();
    const timeDiff = now - this.lastProcessingTime;
    return timeDiff > 5000; // 5 seconds cooldown
};

// Add method to update processing time
userStateSchema.methods.updateProcessingTime = function() {
    this.lastProcessingTime = new Date();
};

module.exports = mongoose.model('UserState', userStateSchema);
