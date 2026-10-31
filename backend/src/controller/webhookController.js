const crypto = require('crypto');
const Payment = require('../models/Payment');

exports.handleChapaWebhook = async (req, res) => {
    try {
        // 1. Get the signature from the header
        const signature = req.headers['x-chapa-signature'];
        if (!signature) {
            return res.status(400).send('Missing signature');
        }

        // 2. Get the secret from your .env
        const secret = process.env.CHAPA_WEBHOOK_SECRET;

        // 3. IMPORTANT: Use the RAW body to calculate the hash
        const rawBody = req.body; // This must be a Buffer or raw string

        // 4. Create HMAC SHA256 hash
        const hash = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        // 5. Compare the hashes securely
        if (hash !== signature) {
            console.warn('⚠️ Invalid Chapa webhook signature');
            return res.status(401).send('Invalid signature');
        }

        // 6. Signature is valid! Process the event
        const payload = JSON.parse(rawBody.toString());
        console.log('✅ Verified Chapa Webhook:', payload);

        if (payload.status === 'success') {
            const { tx_ref, reference } = payload;
            
            // Update your Payment document
            await Payment.findOneAndUpdate(
                { tx_ref: tx_ref, status: 'pending' },
                { status: 'success', chapa_reference: reference }
            );
            
            // TODO: Also update the corresponding Rent/Agreement record
        }

        // 7. Always respond with 200 OK so Chapa knows you received it
        res.status(200).send('Webhook received');

    } catch (error) {
        console.error('Webhook Error:', error);
        res.status(500).send('Server Error');
    }
};