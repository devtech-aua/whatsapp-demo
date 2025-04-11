const axios = require('axios');
const { LPQ_LOCATIONS, SOURCES } = require('./constants');

// Function to send WhatsApp message
async function sendWhatsAppMessage(to, content, type = 'text', interactive = null) {
    try {
        const message = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: type
        };

        if (type === 'text') {
            message.text = { body: content };
        } else if (type === 'image') {
            message.image = { link: content };
        } else if (type === 'interactive' && interactive) {
            message.interactive = interactive;
        }

        const response = await axios.post(
            `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`,
            message,
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
        console.error('Error sending WhatsApp message:', error.response?.data || error.message);
        throw error;
    }
}

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

// Function to send help message
async function sendHelpMessage(to) {
    const helpText = `*Available Commands:*\n\n` +
        `1. *org lpq* - Start review analysis for Le Pain Quotidien\n` +
        `2. *clear* - Reset your current session\n` +
        `3. *help* - Show this help message\n` +
        `4. *bye* - End conversation`;
    
    await sendWhatsAppMessage(to, helpText);
}

module.exports = {
    sendWhatsAppMessage,
    sendLocationOptions,
    sendSourceOptions,
    sendHelpMessage
};
