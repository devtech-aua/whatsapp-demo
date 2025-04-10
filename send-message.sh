curl -i -X POST 'https://graph.facebook.com/v17.0/639020895956705/messages' \
-H 'Authorization: Bearer EAAMNqN5RhI8BO9TZBp1P6S7V0gSUjq60hDQ64iRl99QACyy1rZC3o55X5ac3aLJztkCvIScqLSJIciVuuAcZAXWPfC8QHL6ZBfB1s3bOagSVrv4PDM5cjoGMMoAPS5gTgRSxzNWyAMeq3gEo2oxDnFGZAKKfYT352iNCzFuSAvKYkkwCxwoEVaVYZB7TEETyPtDFPUDsIWebZCjDVDXqB6OHpX0IUrf9vI2ZBtgZD' \
-H 'Content-Type: application/json' \
-d '{"messaging_product":"whatsapp","to":"923454096036","type":"text","text":{"body":"Test message with new token"}}'
