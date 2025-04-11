# WhatsApp Integration

A Node.js application that integrates with WhatsApp to handle incoming messages and respond automatically.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- WhatsApp Business API access
- ngrok (for local development)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

4. Get your WhatsApp API credentials:
   - Go to [Meta Developer Portal](https://developers.facebook.com/)
   - Create a new app or use an existing one
   - Set up WhatsApp messaging
   - Get your WhatsApp Access Token and Phone Number ID
   - Add these to your .env file

5. Start the server:
   ```bash
   npm run dev
   ```

6. Use ngrok to expose your local server:
   ```bash
   ngrok http 3000
   ```

7. Configure your webhook URL in the Meta Developer Portal using the ngrok URL

## Usage

Send a message "hey" to your WhatsApp business number, and the application will respond with "How can I help you today?"


---------


1.

curl -i -X POST \
  https://graph.facebook.com/v22.0/639020895956705/messages \
  -H 'Authorization: Bearer EAAMNqN5RhI8BOylKSCLZCAUKUzfPIOaam536ZCmukib5evThzj9qnpkglvbKO61wdUu6c59Tp4XNPbiQu7MFxlPL3tELeVoRaHKlMBwljP7ecgEm6ddEGNnSkIVlNVw9Y0zvoSZB8MCtjY4O15peeZANztwDPVvD6kyO1fPdlPnSW59WxPihbfdrISn5QVkJJlOZARhfcr0beDLC8IMjmdYKfZCo5oZCkCPNU4ZD' \
  -H 'Content-Type: application/json' \
  -d '{ "messaging_product": "whatsapp", "to": "+923217742462", "type": "template", "template": { "name": "hello_world", "language": { "code": "en_US" } } }'







curl -i -X POST \
  https://graph.facebook.com/v22.0/639020895956705/messages \
  -H 'Authorization: Bearer EAAMNqN5RhI8BOylKSCLZCAUKUzfPIOaam536ZCmukib5evThzj9qnpkglvbKO61wdUu6c59Tp4XNPbiQu7MFxlPL3tELeVoRaHKlMBwljP7ecgEm6ddEGNnSkIVlNVw9Y0zvoSZB8MCtjY4O15peeZANztwDPVvD6kyO1fPdlPnSW59WxPihbfdrISn5QVkJJlOZARhfcr0beDLC8IMjmdYKfZCo5oZCkCPNU4ZD' \
  -H 'Content-Type: application/json' \
  -d '{ "messaging_product": "whatsapp", "to": "+923454096036", "type": "text", "text": { "body": "hey from gsoft" } }'






curl -i -X POST https://graph.facebook.com/v22.0/639020895956705/messages \
-H 'Authorization: Bearer EAAMNqN5RhI8BOylKSCLZCAUKUzfPIOaam536ZCmukib5evThzj9qnpkglvbKO61wdUu6c59Tp4XNPbiQu7MFxlPL3tELeVoRaHKlMBwljP7ecgEm6ddEGNnSkIVlNVw9Y0zvoSZB8MCtjY4O15peeZANztwDPVvD6kyO1fPdlPnSW59WxPihbfdrISn5QVkJJlOZARhfcr0beDLC8IMjmdYKfZCo5oZCkCPNU4ZD' \
-H 'Content-Type: application/json' \
-d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "+923454096036",
    "type": "interactive",
    "interactive": {
        "type": "list",
        "header": {
            "type": "text",
            "text": "Choose an option"
        },
        "body": {
            "text": "Please select from the following options:"
        },
        "action": {
            "button": "Select Option",
            "sections": [
                {
                    "title": "Available Options",
                    "rows": [
                        {
                            "id": "option_1",
                            "title": "Option 1",
                            "description": "Description for option 1"
                        },
                        {
                            "id": "option_2",
                            "title": "Option 2",
                            "description": "Description for option 2"
                        }
                    ]
                }
            ]
        }
    }
}'




brew install ngrok

ngrok http 3000# whatsapp-demo
