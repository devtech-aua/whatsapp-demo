const express = require('express');
const bodyParser = require('body-parser');
const { connectWithRetry } = require('./models/db');
const UserState = require('./models/UserState');
const { sendWhatsAppMessage, sendLocationOptions, sendSourceOptions } = require('./utils/whatsappHelper');
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
                        if (userState.currentState === 'awaiting_review_question') {
                            // If user starts a new selection while waiting for question, clear previous state
                            await userState.clearSelections();
                        }
                        userState.currentState = 'selecting_locations';
                        userState.isActive = true;  // Set user as active
                        await userState.save();
                        await sendLocationOptions(from);
                    }
                    else if (userState.currentState === 'selecting_locations') {
                        const selections = text.split(',').map(num => num.trim());
                        
                        // Check if user wants to select all locations
                        if (selections.includes('9')) {
                            userState.selections.locations = [...LPQ_LOCATIONS];
                            userState.currentState = 'selecting_sources';
                            await userState.save();
                            await sendSourceOptions(from);
                            return;
                        }
                        
                        const validSelections = selections.every(num => !isNaN(num) && num > 0 && num <= LPQ_LOCATIONS.length);
                        
                        if (validSelections) {
                            const selectedLocations = selections.map(num => LPQ_LOCATIONS[parseInt(num) - 1]);
                            userState.selections.locations = selectedLocations;
                            userState.currentState = 'selecting_sources';
                            await userState.save();
                            await sendSourceOptions(from);
                        } else {
                            await sendWhatsAppMessage(from, '❌ Invalid selection. Please enter valid location numbers separated by commas (e.g., 1,3,4) or 9 for all locations');
                            await sendLocationOptions(from);
                        }
                    }
                    else if (userState.currentState === 'selecting_sources') {
                        const selections = text.split(',').map(num => num.trim());
                        
                        // Check if user wants to select all sources
                        if (selections.includes('9')) {
                            userState.selections.sources = [...SOURCES];
                            
                            // Print selections
                            const userSelection = userState.selections;
                            const summary = `*Selected Options:*\n\n*Locations:*\n${userSelection.locations.map((loc, i) => `${i + 1}. ${loc}`).join('\n')}\n\n*Sources:*\n${userSelection.sources.map((src, i) => `${i + 1}. ${src}`).join('\n')}`;
                            await sendWhatsAppMessage(from, summary);

                            userState.currentState = 'awaiting_review_question';
                            userState.isActive = true;
                            await userState.save();
                            await sendWhatsAppMessage(from, '❓ What would you like to know about these reviews? (e.g., "When was the last review posted?" or "What is the average rating?")');
                            return;
                        }
                        
                        const validSelections = selections.every(num => !isNaN(num) && num > 0 && num <= SOURCES.length);
                        
                        if (validSelections) {
                            const selectedSources = selections.map(num => SOURCES[parseInt(num) - 1]);
                            userState.selections.sources = selectedSources;
                            
                            // Print selections
                            const userSelection = userState.selections;
                            const summary = `*Selected Options:*\n\n*Locations:*\n${userSelection.locations.map((loc, i) => `${i + 1}. ${loc}`).join('\n')}\n\n*Sources:*\n${userSelection.sources.map((src, i) => `${i + 1}. ${src}`).join('\n')}`;
                            await sendWhatsAppMessage(from, summary);

                            userState.currentState = 'awaiting_review_question';
                            userState.isActive = true;
                            await userState.save();
                            await sendWhatsAppMessage(from, '❓ What would you like to know about these reviews? (e.g., "When was the last review posted?" or "What is the average rating?")');
                        } else {
                            await sendWhatsAppMessage(from, '❌ Invalid selection. Please enter valid source numbers separated by commas (e.g., 1,3,4) or 9 for all sources');
                            await sendSourceOptions(from);
                        }
                    }
                    else if (userState.currentState === 'awaiting_review_question' || userState.currentState === 'processing_review') {
                        const question = text.toLowerCase();
                        
                        // Check if user wants to stop
                        if (question === 'no' || question === 'clear' || question === 'stop') {
                            userState.currentState = 'awaiting_command';
                            await userState.save();
                            await sendWhatsAppMessage(from, "👋 Thank you for using our review analysis service. Type *obenan* anytime to start again!");
                            return;
                        }

                        // Check if we can process this request (5-second cooldown)
                        if (!userState.canProcess()) {
                            console.log('Request ignored due to cooldown');
                            return res.sendStatus(200);
                        }

                        try {
                            // Set state to processing and update processing time
                            userState.currentState = 'processing_review';
                            userState.updateProcessingTime();
                            await userState.save();

                            // Validate selections before making the API call
                            if (!userState.selections.locations || userState.selections.locations.length === 0) {
                                throw new Error('Please select locations first using "org lpq" command');
                            }
                            if (!userState.selections.sources || userState.selections.sources.length === 0) {
                                throw new Error('Please select review sources after selecting locations');
                            }

                            // Call review analyzer with the user's question
                            await sendWhatsAppMessage(from, '🔄 Analyzing reviews, please wait...');
                            
                            try {
                                const analysis = await analyzeReviews(userState.selections.locations, userState.selections.sources, question);
                                
                                // Always send the text response
                                await sendWhatsAppMessage(from, `*Analysis Result:*\n\n${analysis.text}`);
                                
                                // Only try to send chart if we have graph data
                                if (analysis.hasGraph && analysis.chartUrl) {
                                    await sendWhatsAppMessage(from, analysis.chartUrl, 'image');
                                }

                                // Ask if they want to continue
                                await sendWhatsAppMessage(from, `\n🤔 Would you like to ask another question about the reviews?\n\n• Ask your question directly\n• Type *no* to finish\n• Type *clear* to start over`);
                                
                                // Keep the state as awaiting_review_question to allow more questions
                                userState.currentState = 'awaiting_review_question';
                                await userState.save();
                            } catch (analysisError) {
                                console.error('Review analysis error:', analysisError);
                                
                                // Handle specific error cases
                                let errorMessage = '❌ ' + (analysisError.message || 'Sorry, there was an error analyzing the reviews.');
                                
                                if (analysisError.message?.includes('Could not connect') || 
                                    analysisError.message?.includes('taking too long') ||
                                    analysisError.message?.includes('endpoint was not found') ||
                                    analysisError.message?.includes('access was denied')) {
                                    // Service-level errors - reset state to awaiting_command
                                    userState.currentState = 'awaiting_command';
                                    await userState.save();
                                    await sendWhatsAppMessage(from, errorMessage + '\n\nType *org lpq* to try again.');
                                } else if (analysisError.message?.includes('select locations')) {
                                    // Location selection needed
                                    userState.currentState = 'selecting_locations';
                                    await userState.save();
                                    await sendWhatsAppMessage(from, errorMessage);
                                    await sendLocationOptions(from);
                                } else if (analysisError.message?.includes('select review sources')) {
                                    // Source selection needed
                                    userState.currentState = 'selecting_sources';
                                    await userState.save();
                                    await sendWhatsAppMessage(from, errorMessage);
                                    await sendSourceOptions(from);
                                } else {
                                    // Unknown error - keep current state and allow retry
                                    await sendWhatsAppMessage(from, errorMessage + '\n\nYou can try asking your question again, or type *clear* to start over.');
                                    userState.currentState = 'awaiting_review_question';
                                    await userState.save();
                                }
                            }
                        } catch (error) {
                            console.error('Error in review question handling:', error);
                            let errorMessage = '❌ Sorry, something went wrong. Please try again later.';
                            await sendWhatsAppMessage(from, errorMessage);
                            
                            // Reset to awaiting_command on serious errors
                            userState.currentState = 'awaiting_command';
                            await userState.save();
                        }
                    }
                    else if (userState.currentState === 'awaiting_command') {
                        // Only show the help message for unrecognized commands in awaiting_command state
                        await sendWhatsAppMessage(from, "❓ I didn't understand that command. Here are some things you can try:\n\n• Type *hello* or *hi* to start\n• Type *help* to see all commands\n• Type *org lpq* to start selecting locations\n• Type *clear* to reset your session\n• Type *bye* to end the conversation");
                    }
                    // Handle unrecognized commands based on current state
                    else if (!userState.isActive || userState.currentState === 'awaiting_command') {
                        await sendWhatsAppMessage(from, "❓ I didn't understand that command. Here are some things you can try:\n\n• Type *hello* or *hi* to start\n• Type *help* to see all commands\n• Type *org lpq* to start selecting locations\n• Type *clear* to reset your session\n• Type *bye* to end the conversation");
                    }
                    // If in a selection state, show the appropriate options again
                    else if (userState.currentState === 'selecting_locations') {
                        await sendWhatsAppMessage(from, '❌ Invalid selection. Please enter valid location numbers separated by commas (e.g., 1,3,4)');
                        await sendLocationOptions(from);
                    }
                    else if (userState.currentState === 'selecting_sources') {
                        await sendWhatsAppMessage(from, '❌ Invalid selection. Please enter valid source numbers separated by commas (e.g., 1,3,4)');
                        await sendSourceOptions(from);
                    }
                }
                // Handle interactive responses
                else if (message.type === 'interactive' && message.interactive.type === 'list_reply') {
                    try {
                        const selectedOption = message.interactive.list_reply;
                        console.log("selectedOption.id", selectedOption.id);
                        switch(selectedOption.id) {
                            case 'projection':
                                // Send 6-month projection graph
                                const graphUrl = 'https://www.slidegeeks.com/media/catalog/product/cache/1280x720/F/i/Financial_Projection_Graph_Template_1_Ppt_PowerPoint_Presentation_Professional_Example_Introduction_Slide_1.jpg'; // Replace with actual graph URL
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
                    } catch (interactiveError) {
                        console.error('Error handling interactive response:', interactiveError);
                        await sendWhatsAppMessage(from, '❌ Sorry, something went wrong. Please try again.');
                        userState.currentState = 'awaiting_command';
                        await userState.save();
                    }
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

// Function to send location options
async function sendLocationOptions(to) {
    const locationList = LPQ_LOCATIONS.map((loc, i) => `${i + 1}. ${loc}`).join('\n');
    await sendWhatsAppMessage(to, `Please select locations (enter numbers separated by commas):\n\n${locationList}\n\n9. Select All Locations`);
}

// Function to send source options
async function sendSourceOptions(to) {
    const sourceList = SOURCES.map((src, i) => `${i + 1}. ${src}`).join('\n');
    await sendWhatsAppMessage(to, `Please select review sources (enter numbers separated by commas):\n\n${sourceList}\n\n9. Select All Sources`);
}

// Function to send WhatsApp message
async function sendWhatsAppMessage(to, message, type = 'text', additionalData = {}) {
    try {
        console.log('Using token:', process.env.WHATSAPP_TOKEN?.substring(0, 10) + '...');
        
        let messageData = {
            messaging_product: 'whatsapp',
            to: to,
            type: type
        };

        if (type === 'text') {
            messageData.text = { body: message };
        } else if (type === 'interactive') {
            messageData = { ...messageData, ...additionalData };
        } else if (type === 'image') {
            messageData.image = { link: message };
        }

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            messageData,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Message sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending message:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

// Function to send help message
async function sendHelpMessage(to) {
    const helpText = `*Available Commands:*\n\n` +
        `1. *org <orgname>* - View organization options\n` +
        `2. *help* - Show this help message\n` +
        `3. *hello* or *hi* - Start interaction\n` +
        `4. *clear* - Reset your current session\n` +
        `5. *bye* - End conversation\n\n` +
        `Example: org lpq`;
    
    await sendWhatsAppMessage(to, helpText);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
