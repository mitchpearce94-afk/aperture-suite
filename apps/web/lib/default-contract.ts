export const DEFAULT_CONTRACT = `PHOTOGRAPHY SERVICES AGREEMENT

This Photography Services Agreement ("Agreement") is entered into on {{today_date}} between:

Photographer: {{business_name}}, operated by {{photographer_name}}
Client: {{client_name}} ({{client_email}})


1. SERVICES

The Photographer agrees to provide professional photography services as follows:

    Date:       {{job_date}}
    Time:       {{job_time}}
    Location:   {{job_location}}
    Package:    {{package_name}}


2. COMPENSATION

The total fee for the services described above is {{package_amount}} (inclusive of GST where applicable).

{{#if deposit}}
DEPOSIT & PAYMENT SCHEDULE:
A non-refundable deposit of {{deposit_amount}} ({{deposit_percent}}% of the total fee) is required to confirm and secure the booking. The deposit is due within 14 days of booking. The remaining balance of {{final_amount}} will be invoiced 28 days before the scheduled date and is due no later than 14 days before the scheduled date. Failure to pay the remaining balance by the due date may result in cancellation of services, with the deposit forfeited.
{{/if}}

{{#if no_deposit}}
PAYMENT:
Full payment of {{package_amount}} is due no later than 14 days prior to the session date. Payment must be received before the scheduled date for services to proceed.
{{/if}}

Accepted payment methods include bank transfer, credit card, or any method made available through the Photographer's invoicing system.


3. IMAGE DELIVERY

The Photographer will deliver {{included_images}} professionally edited images via a private online gallery with download access.

Delivery timeline:
    - Standard sessions: within 2-3 weeks of the session date.
    - Weddings and full-day events: within 4-6 weeks of the event date.

The Photographer reserves creative discretion over the style, composition, and final selection of images delivered. RAW or unedited files are not included and will not be provided.


4. WHAT'S INCLUDED

The selected package ({{package_name}}) includes:
    - Professional photography coverage for the duration specified in the package.
    - Professional editing and colour grading of all delivered images.
    - A private online gallery for viewing and downloading.
    - A personal-use license for all delivered images.

{{#if second_shooter}}
SECOND SHOOTER:
A qualified second photographer is included in this package. The Photographer is responsible for coordinating, directing, and editing all second shooter imagery.
{{/if}}


5. COPYRIGHT & IMAGE USAGE

The Photographer retains full copyright of all images produced under this agreement, in accordance with the Copyright Act 1968 (Cth).

The Client is granted a non-exclusive, non-transferable, personal-use license for all delivered images. This means the Client may:
    - Print images for personal display.
    - Share images on personal social media accounts.
    - Use images for personal, non-commercial purposes.

The Client may NOT:
    - Sell, license, or sublicense any images.
    - Use images for commercial or promotional purposes without prior written consent.
    - Edit, alter, or apply filters to images in a way that misrepresents the Photographer's work.

The Photographer may use selected images from the session for portfolio, website, social media, marketing, print materials, and competition entries, unless the Client requests otherwise in writing prior to the session.


6. CANCELLATION & RESCHEDULING

BY THE CLIENT:
    - 30+ days before the scheduled date: {{#if deposit}}Deposit forfeited. No further payment required.{{/if}}{{#if no_deposit}}Full refund minus a $50 administration fee.{{/if}}
    - 14-29 days before: 50% of the total fee is due.
    - Less than 14 days before: the full fee is due.
    - No-show without notice: the full fee is due, no refund.

{{#if deposit}}
Note: The deposit amount ({{deposit_percent}}% of the total fee) is non-refundable in all cancellation scenarios.
{{/if}}

BY THE PHOTOGRAPHER:
    - If the Photographer must cancel for any reason, the Client will receive a full refund of all payments made, or the option to reschedule at no additional cost.

RESCHEDULING:
    - The Client may reschedule once at no additional charge with a minimum of 14 days written notice, subject to the Photographer's availability.
    - Additional rescheduling requests may incur a $50 rebooking fee.

WEATHER (OUTDOOR SESSIONS):
    - In the event of severe weather that would significantly impact the quality of the session, the Photographer may offer to reschedule at no additional cost. This decision is at the Photographer's reasonable discretion.


7. LIABILITY

The Photographer carries professional indemnity insurance and takes all reasonable precautions, including the use of backup equipment and storage, to ensure the safety and delivery of images.

However, the Photographer's total liability under this agreement is limited to the total fee paid by the Client. The Photographer is not liable for:
    - Images not captured due to guest interference, venue restrictions, lighting conditions, or timeline changes outside the Photographer's control.
    - Loss, damage, or corruption of images after delivery to the Client.
    - Circumstances beyond the Photographer's reasonable control.


8. FORCE MAJEURE

If the scheduled session or event cannot proceed due to circumstances beyond either party's reasonable control — including but not limited to natural disasters, pandemics, government restrictions, severe weather events, or personal emergencies — the parties agree to work together in good faith to reschedule at a mutually agreeable date.

If rescheduling is not possible within 12 months of the original date, the Photographer will refund all payments made minus any reasonable expenses already incurred (such as travel bookings or subcontractor fees).


9. PRIVACY

The Photographer will handle all personal information in accordance with the Australian Privacy Principles. Client contact details and images are stored securely and are not shared with third parties without consent, except as required to deliver the services described in this agreement (e.g. online gallery hosting, printing partners).

{{#if minors}}
MINORS:
A parent or legal guardian must be present for all sessions involving children under 18. By signing this agreement, the Client confirms they have the authority to consent on behalf of any minors being photographed.
{{/if}}


10. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the Photographer and the Client. Any amendments must be made in writing and agreed upon by both parties.


AGREED AND ACCEPTED:


Client: {{client_name}}
Signature: ___________________________
Date: {{today_date}}


Photographer: {{photographer_name}}
Signature: ___________________________
Date: {{today_date}}`;
