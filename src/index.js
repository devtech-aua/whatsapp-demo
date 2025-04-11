require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require('axios');
const { LPQ_LOCATIONS, SOURCES } = require('./utils/constants');
const UserState = require('./models/UserState');
const { analyzeReviews } = require('./utils/reviewAnalyzer');
//ss
const app = express();
app.use(bodyParser.json());
console.log("Holla :: MONGODB_URI", process.env.MONGODB_URI);
// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-integration', {
    useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  keepAlive: true
}).then(() => {
    console.log('Connected to MongoDBd');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-integration');
});

// WhatsApp message webhook endpoint
app.post('/webhook', async (req, res) => {
    try {
        const { entry } = req.body;
        
        if (!entry || !entry[0]?.changes) {
            return res.sendStatus(400);
        }

        const change = entry[0].changes[0];
        const value = change.value;

        if (value.messages) {
            const message = value.messages[0];
            const from = message.from;
            
            // Get or create user state
            let userState = await UserState.findOne({ phoneNumber: from });
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
                    await userState.save();
                    await sendLocationOptions(from);
                }
                else if (userState.currentState === 'selecting_locations') {
                    const selections = text.split(',').map(num => num.trim());
                    const validSelections = selections.every(num => !isNaN(num) && num > 0 && num <= LPQ_LOCATIONS.length);
                    
                    if (validSelections) {
                        const selectedLocations = selections.map(num => LPQ_LOCATIONS[parseInt(num) - 1]);
                        userState.selections.locations = selectedLocations;
                        userState.currentState = 'selecting_sources';
                        await userState.save();
                        await sendSourceOptions(from);
                    } else {
                        await sendWhatsAppMessage(from, '❌ Invalid selection. Please enter valid location numbers separated by commas (e.g., 1,3,4)');
                        await sendLocationOptions(from);
                    }
                }
                else if (userState.currentState === 'selecting_sources') {
                    const selections = text.split(',').map(num => num.trim());
                    const validSelections = selections.every(num => !isNaN(num) && num > 0 && num <= SOURCES.length);
                    
                    if (validSelections) {
                        const selectedSources = selections.map(num => SOURCES[parseInt(num) - 1]);
                        userState.selections.sources = selectedSources;
                        
                        // Print selections
                        const userSelection = userState.selections;
                        const summary = `*Selected Options:*\n\n*Locations:*\n${userSelection.locations.map((loc, i) => `${i + 1}. ${loc}`).join('\n')}\n\n*Sources:*\n${userSelection.sources.map((src, i) => `${i + 1}. ${src}`).join('\n')}`;
                        await sendWhatsAppMessage(from, summary);

                        userState.currentState = 'awaiting_review_question';
                        await userState.save();
                        await sendWhatsAppMessage(from, '❓ What would you like to know about these reviews? (e.g., "When was the last review posted?" or "What is the average rating?")');
                    } else {
                        await sendWhatsAppMessage(from, '❌ Invalid selection. Please enter valid source numbers separated by commas (e.g., 1,3,4)');
                        await sendSourceOptions(from);
                    }
                }
                else if (userState.currentState === 'awaiting_review_question') {
                    const question = text;
                    
                    try {
                        // Call review analyzer with the user's question
                        await sendWhatsAppMessage(from, '🔄 Analyzing reviews, please wait...');
                        const analysis = await analyzeReviews(userState.selections.locations, userState.selections.sources, question);
                        
                        // Always send the text response
                        await sendWhatsAppMessage(from, `*Analysis Result:*\n\n${analysis.text}`);
                        
                        // Only try to send chart if we have graph data
                        if (analysis.hasGraph && analysis.chartUrl) {
                            await sendWhatsAppMessage(from, analysis.chartUrl, 'image');
                        }
                    } catch (error) {
                        console.error('Error analyzing reviews:', error);
                        let errorMessage = '❌ Sorry, there was an error analyzing the reviews.';
                        
                        if (error.response?.status === 404) {
                            errorMessage = '❌ Could not connect to the review analyzer service. Please try again later.';
                        } else if (error.message === 'Invalid response format from API') {
                            errorMessage = '❌ Received unexpected data format from the service.';
                        }
                        
                        await sendWhatsAppMessage(from, errorMessage);
                    } finally {
                        // Always reset state after handling the question, whether success or error
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
            }
        } else if (value.statuses) {
            // Handle status update
            const status = value.statuses[0];
            console.log('Message Status Update:', {
                recipientId: status.recipient_id,
                status: status.status,
                timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
                conversationId: status.conversation?.id
            });
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Function to send location options
async function sendLocationOptions(to) {
    const message = `*Please select locations* (enter numbers separated by commas):\n\n${LPQ_LOCATIONS.map((loc, i) => `${i + 1}. ${loc}`).join('\n')}`;
    await sendWhatsAppMessage(to, message);
}

// Function to send source options
async function sendSourceOptions(to) {
    const message = `*Please select sources* (enter numbers separated by commas):\n\n${SOURCES.map((src, i) => `${i + 1}. ${src}`).join('\n')}`;
    await sendWhatsAppMessage(to, message);
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

// Function to send organization options
async function sendOrgOptions(to, orgName = '') {
    const interactiveMessage = {
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: orgName ? `${orgName.toUpperCase()} Options` : "Organization Options"
            },
            body: {
                text: `Please select an option${orgName ? ` for ${orgName.toUpperCase()}` : ''}:`
            },
            action: {
                button: "Select Option",
                sections: [{
                    title: "Available Options",
                    rows: [
                        {
                            id: "projection",
                            title: "Show Projection",
                            description: "View your projection from last 6 months"
                        },
                        {
                            id: "username",
                            title: "Change Username",
                            description: "Update your username"
                        }
                    ]
                }]
            }
        }
    };

    await sendWhatsAppMessage(to, '', 'interactive', interactiveMessage);
}

// Verification endpoint for WhatsApp webhook
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
