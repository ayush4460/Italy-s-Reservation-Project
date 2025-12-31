// import fetch from 'node-fetch'; // Using global fetch for Node 18+

const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY || '';
const GUPSHUP_APP_NAME = process.env.GUPSHUP_APP_NAME || '';
const GUPSHUP_SRC_PHONE = process.env.GUPSHUP_SRC_PHONE || '';
// User provided WABA ID: 857692136862408
// User provided Phone Number in image: 919211637872 (from screenshot upload)
// Let's use 919211637872 as the source number.

export const sendReservationConfirmation = async (
    to: string,
    params: string[]
) => {
    // Expected Params order for 'brunch_di_gala_reservation_confirmation':
    // 0: Name {{1}}
    // 1: Date {{2}}
    // 2: Day {{3}}
    // 3: Batch {{4}}
    // 4: Time {{5}}
    // 5: Guests {{6}}
    // 6: Contact {{7}}
    // 7: Food Preparation {{8}}

    // Ensure 'to' number has 91 prefix
    let destination = to.trim();
    if (!destination.startsWith('91') && !destination.startsWith('+91')) {
        destination = `91${destination}`;
    }
    if (destination.startsWith('+')) {
        destination = destination.substring(1);
    }

    const url = 'https://api.gupshup.io/wa/api/v1/template/msg';
    
    // Construct params JSON
    const templateParams = JSON.stringify(params);

    const body = new URLSearchParams();
    body.append('channel', 'whatsapp');
    body.append('source', GUPSHUP_SRC_PHONE);
    body.append('destination', destination);
    body.append('src.name', GUPSHUP_APP_NAME);
    body.append('template', 'brunch_di_gala_reservation_confirmation');
    body.append('message.template.params', templateParams);

    // Using `message` override for template params is the standard way for many integrations,
    // but the `message.template.params` form field is specific to Gupshup's simplified API.
    // If that fails, we might need the JSON `template` field method used previously.
    // Let's stick to the method that is most standard for Gupshup:
    // `template` = JSON string with `id` and `params`.
    
    // Resetting body to use the JSON template object approach which is more robust
    const bodyJsonApproach = new URLSearchParams();
    bodyJsonApproach.append('channel', 'whatsapp');
    bodyJsonApproach.append('source', GUPSHUP_SRC_PHONE);
    bodyJsonApproach.append('destination', destination);
    bodyJsonApproach.append('src.name', GUPSHUP_APP_NAME);
    
    const templateData = {
        id: "brunch_di_gala_reservation_confirmation",
        params: params
    };
    bodyJsonApproach.append('template', JSON.stringify(templateData));

    console.log(`[Gupshup] API URL: ${url}`);
    console.log(`[Gupshup] Sending to ${destination} with params:`, params);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/x-www-form-urlencoded',
                'apikey': GUPSHUP_API_KEY
            },
            body: bodyJsonApproach
        });

        const data = await response.json();
        console.log('[Gupshup] Response:', data);
        return data;
    } catch (error) {
        console.error('[Gupshup] Error sending message:', error);
        return null;
    }
};
