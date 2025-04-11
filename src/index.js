const express = require('express');
const bodyParser = require('body-parser');
const { connectWithRetry } = require('./models/db');
const UserState = require('./models/UserState');
const { sendWhatsAppMessage, sendLocationOptions, sendSourceOptions, sendHelpMessage } = require('./utils/whatsappHelper');
const { analyzeReviews } = require('./utils/reviewAnalyzer');
const { LPQ_LOCATIONS, SOURCES } = require('./utils/constants');

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Connect to MongoDB with retry mechanism
connectWithRetry().catch(err => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        const { entry } = req.body;
        if (!entry || !Array.isArray(entry) || entry.length === 0) {
            return res.status(400).json({ error: 'Invalid request body' });
        }

        const { changes } = entry[0];
        if (!changes || !Array.isArray(changes) || changes.length === 0) {
            return res.status(400).json({ error: 'Invalid request format' });
        }

        const { value } = changes[0];
        if (!value) {
            return res.status(400).json({ error: 'No value in changes' });
        }

        // Handle messages
        if (value.messages && Array.isArray(value.messages)) {
            const message = value.messages[0];
            const from = message.from;
            
            try {
                // Get or create user state with timeout handling
                let userState = await Promise.race([
                    UserState.findOne({ phoneNumber: from }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('MongoDB query timeout')), 10000)
                    )
                ]);

                if (!userState) {
                    userState = new UserState({ phoneNumber: from });
                }

                // Handle different message types
                if (message.type === 'text') {
                    const text = message.text.body.toLowerCase();
                    await handleTextMessage(text, userState, from);
                }
                // Handle interactive responses
                else if (message.type === 'interactive' && message.interactive.type === 'list_reply') {
                    await handleInteractiveMessage(message.interactive.list_reply, userState, from);
                }
            } catch (messageError) {
                console.error('Error processing message:', messageError);
                await sendWhatsAppMessage(from, '❌ Sorry, we\'re having technical difficulties. Please try again in a few moments.');
                return res.status(500).json({ error: 'Message processing error' });
            }
        }
        // Handle status updates
        else if (value.statuses && Array.isArray(value.statuses)) {
            try {
                const status = value.statuses[0];
                console.log('Message Status Update:', {
                    recipientId: status.recipient_id,
                    status: status.status,
                    timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
                    conversationId: status.conversation?.id
                });
            } catch (statusError) {
                console.error('Error processing status update:', statusError);
            }
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to handle text messages
async function handleTextMessage(text, userState, from) {
    try {
        // Update last message
        await userState.updateLastMessage(text, 'incoming');
        
        if (text === 'obenan') {
            userState.currentState = 'awaiting_command';
            await userState.save();
            await sendWhatsAppMessage(from, '*Welcome to Organization Assistant* 🤖\n\nHow can I help you today?\n\n*Available Commands:*\n1. *org <orgname>* - View organization options\n2. *help* - Show all commands');
        }
        else if (text === 'hello' || text === 'hi') {
            userState.currentState = 'awaiting_command';
            userState.isActive = true;
            await userState.save();
            await sendWhatsAppMessage(from, '👋 Hello! How can I assist you today? Type *help* to see available commands.');
        }
        else if (text === 'clear') {
            await userState.clearSelections();
            userState.currentState = 'awaiting_command';
            await userState.save();
            await sendWhatsAppMessage(from, '🔄 Session cleared! You can start fresh now.');
        }
        else if (text === 'bye') {
            await userState.endSession();
            await sendWhatsAppMessage(from, '👋 Goodbye! Have a great day! Type *hello* or *hi* when you want to chat again.');
        }
        else if (text === 'help') {
            await sendHelpMessage(from);
        }
        else if (text.startsWith('org lpq')) {
            await handleOrgLpqCommand(userState, from);
        }
        else if (userState.currentState === 'selecting_locations') {
            await handleLocationSelection(text, userState, from);
        }
        else if (userState.currentState === 'selecting_sources') {
            await handleSourceSelection(text, userState, from);
        }
        else if (userState.currentState === 'awaiting_review_question' || userState.currentState === 'processing_review') {
            await handleReviewQuestion(text, userState, from);
        }
        else if (userState.currentState === 'awaiting_command') {
            await sendWhatsAppMessage(from, "❓ I didn't understand that command. Here are some things you can try:\n\n• Type *hello* or *hi* to start\n• Type *help* to see all commands\n• Type *org lpq* to start selecting locations\n• Type *clear* to reset your session\n• Type *bye* to end the conversation");
        }
    } catch (error) {
        console.error('Error handling text message:', error);
        throw error;
    }
}

// Helper function to handle interactive messages
async function handleInteractiveMessage(listReply, userState, from) {
    try {
        console.log("selectedOption.id", listReply.id);
        switch(listReply.id) {
            case 'projection':
                const graphUrl = 'https://www.slidegeeks.com/media/catalog/product/cache/1280x720/F/i/Financial_Projection_Graph_Template_1_Ppt_PowerPoint_Presentation_Professional_Example_Introduction_Slide_1.jpg';
                await sendWhatsAppMessage(from, graphUrl, 'image');
                userState.currentState = 'awaiting_command';
                await userState.save();
                break;
                
            case 'username':
                await sendWhatsAppMessage(from, 'Current username: QLP\nPlease enter your new username:');
                userState.currentState = 'awaiting_new_username';
                await userState.save();
                break;
        }
    } catch (error) {
        console.error('Error handling interactive message:', error);
        throw error;
    }
}

// Helper function to handle org lpq command
async function handleOrgLpqCommand(userState, from) {
    try {
        userState.currentState = 'selecting_locations';
        await userState.save();
        await sendLocationOptions(from);
    } catch (error) {
        console.error('Error handling org lpq command:', error);
        throw error;
    }
}

// Helper function to handle location selection
async function handleLocationSelection(text, userState, from) {
    try {
        if (text === '9') {
            userState.selectedLocations = LPQ_LOCATIONS;
        } else {
            const selectedIndices = text.split(',').map(num => parseInt(num.trim()) - 1);
            userState.selectedLocations = selectedIndices
                .filter(i => i >= 0 && i < LPQ_LOCATIONS.length)
                .map(i => LPQ_LOCATIONS[i]);
        }

        if (userState.selectedLocations.length > 0) {
            userState.currentState = 'selecting_sources';
            await userState.save();
            await sendSourceOptions(from);
        } else {
            await sendWhatsAppMessage(from, '❌ Invalid selection. Please try again.');
        }
    } catch (error) {
        console.error('Error handling location selection:', error);
        throw error;
    }
}

// Helper function to handle source selection
async function handleSourceSelection(text, userState, from) {
    try {
        if (text === '9') {
            userState.selectedSources = SOURCES;
        } else {
            const selectedIndices = text.split(',').map(num => parseInt(num.trim()) - 1);
            userState.selectedSources = selectedIndices
                .filter(i => i >= 0 && i < SOURCES.length)
                .map(i => SOURCES[i]);
        }

        if (userState.selectedSources.length > 0) {
            userState.currentState = 'awaiting_review_question';
            await userState.save();
            await sendWhatsAppMessage(from, '🎯 Great! Now you can ask me anything about the reviews. For example:\n• What is the average rating?\n• What are the common complaints?\n• What do people like the most?\n• Summarize the reviews');
        } else {
            await sendWhatsAppMessage(from, '❌ Invalid selection. Please try again.');
        }
    } catch (error) {
        console.error('Error handling source selection:', error);
        throw error;
    }
}

// Helper function to handle review questions
async function handleReviewQuestion(text, userState, from) {
    try {
        userState.currentState = 'processing_review';
        await userState.save();

        await sendWhatsAppMessage(from, '🔄 Processing your request...');
        const result = await analyzeReviews(text, userState.selectedLocations, userState.selectedSources);
        
        await sendWhatsAppMessage(from, result);
        userState.currentState = 'awaiting_review_question';
        await userState.save();
    } catch (error) {
        console.error('Error handling review question:', error);
        userState.currentState = 'awaiting_review_question';
        await userState.save();
        throw error;
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
