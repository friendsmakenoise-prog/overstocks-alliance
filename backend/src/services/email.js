// ============================================================
// EMAIL SERVICE — Overstocks Alliance
// Powered by Resend (resend.com)
// Set RESEND_API_KEY in Railway environment variables
// Set EMAIL_FROM in Railway e.g. "Overstocks Alliance <noreply@yourdomain.com>"
// ============================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'Overstocks Alliance <noreply@overstocksalliance.com>'
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://overstocks-alliance.vercel.app'

// ── Core send function ────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL SKIPPED — no RESEND_API_KEY] To: ${to} | Subject: ${subject}`)
    return { skipped: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM, to, subject, html })
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('Resend error:', data)
      return { error: data }
    }

    console.log(`[EMAIL SENT] To: ${to} | Subject: ${subject} | ID: ${data.id}`)
    return { id: data.id }
  } catch (err) {
    console.error('Email send failed:', err.message)
    return { error: err.message }
  }
}

// ── Shared layout wrapper ─────────────────────────────────────
function layout(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Overstocks Alliance</title>
</head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr>
          <td style="padding:0 0 28px;">
            <span style="font-size:22px;font-family:Georgia,serif;color:#0B1628;font-weight:normal;">
              Overstocks <span style="color:#C9973A;">Alliance</span>
            </span>
          </td>
        </tr>

        <!-- Content card -->
        <tr>
          <td style="background:#ffffff;border-radius:12px;border:1px solid #E2E8F0;padding:32px 36px;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0;font-size:12px;color:#8896A7;line-height:1.6;">
            Overstocks Alliance — Private B2B Stock Trading Network<br>
            This is an automated message. Please do not reply to this email.<br>
            <a href="${FRONTEND_URL}/terms" style="color:#8896A7;">Terms and Conditions</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Button component ──────────────────────────────────────────
function btn(url, label, colour = '#0B1628') {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background:${colour};border-radius:8px;">
          <a href="${url}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-family:Georgia,serif;font-size:15px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`
}

// ── Divider ───────────────────────────────────────────────────
function divider() {
  return `<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;">`
}

// ── Key/value row ─────────────────────────────────────────────
function detail(label, value) {
  return `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#8896A7;width:140px;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;font-size:13px;color:#0B1628;font-weight:500;">${value}</td>
    </tr>`
}

function detailTable(rows) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${rows.map(([k, v]) => detail(k, v)).join('')}
    </table>`
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

/**
 * 1. Account approved
 */
async function sendAccountApproved({ email, companyName, anonymousHandle }) {
  return sendEmail({
    to: email,
    subject: 'Your Overstocks Alliance account has been approved',
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        Welcome to Overstocks Alliance
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 16px;">
        Your application has been reviewed and your account is now active. You can sign in and start exploring the platform.
      </p>
      ${detailTable([
        ['Company', companyName],
        ['Your handle', anonymousHandle],
      ])}
      <p style="font-size:14px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        You'll be identified to other members only by your anonymous handle. Your company name and contact details remain private.
      </p>
      ${btn(`${FRONTEND_URL}/`, 'Sign in to your account')}
      ${divider()}
      <p style="font-size:13px;color:#8896A7;margin:0;">
        If you have any questions about using the platform, please contact our team.
      </p>
    `)
  })
}

/**
 * 2. New offer received (seller notification)
 */
async function sendNewOfferReceived({ email, listingTitle, offerType, quantity, pricePounds, buyerHandle, offerId }) {
  const isDirect = offerType === 'direct'
  return sendEmail({
    to: email,
    subject: isDirect
      ? `Direct purchase request on your listing — ${listingTitle}`
      : `New offer on your listing — ${listingTitle}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        ${isDirect ? 'Someone wants to buy your listing' : 'You have a new offer'}
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        ${isDirect
          ? 'A buyer has made a direct purchase request at your listed price.'
          : 'A buyer has submitted an offer on one of your listings. You can accept, decline, or make a single counter-offer.'
        }
      </p>
      ${detailTable([
        ['Listing', listingTitle],
        ['Type', isDirect ? 'Direct purchase' : 'Offer'],
        ['Quantity', `${quantity} unit${quantity !== 1 ? 's' : ''}`],
        ['Price per unit', `£${pricePounds}`],
        ['From', buyerHandle],
      ])}
      ${btn(`${FRONTEND_URL}/`, 'View and respond')}
      ${divider()}
      <p style="font-size:13px;color:#8896A7;margin:0;">
        Log in to your dashboard to respond. Offers expire after 48 hours if not actioned.
      </p>
    `)
  })
}

/**
 * 3. Offer accepted — notify buyer to pay
 */
async function sendOfferAccepted({ email, listingTitle, agreedPricePounds, quantity, sellerHandle, offerId }) {
  const total = (parseFloat(agreedPricePounds) * quantity).toFixed(2)
  return sendEmail({
    to: email,
    subject: `Your offer was accepted — payment required`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        Your offer has been accepted
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        The seller has accepted your offer. Please complete payment to confirm the transaction.
      </p>
      ${detailTable([
        ['Listing', listingTitle],
        ['Quantity', `${quantity} unit${quantity !== 1 ? 's' : ''}`],
        ['Agreed price', `£${agreedPricePounds}/unit`],
        ['Total', `£${total}`],
        ['Seller', sellerHandle],
      ])}
      <p style="font-size:14px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        Once payment is confirmed, a private message thread will open between you and the seller to coordinate delivery.
      </p>
      ${btn(`${FRONTEND_URL}/`, 'Complete payment', '#C9973A')}
      ${divider()}
      <p style="font-size:13px;color:#8896A7;margin:0;">
        If you do not complete payment, the offer may be cancelled and the listing returned to availability.
      </p>
    `)
  })
}

/**
 * 4. Counter-offer received — notify buyer
 */
async function sendCounterOfferReceived({ email, listingTitle, originalPricePounds, counterPricePounds, quantity, sellerHandle, counterMessage, offerId }) {
  return sendEmail({
    to: email,
    subject: `Counter-offer received on ${listingTitle}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        The seller has made a counter-offer
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        You can accept or decline this counter. No further negotiation is available after this round.
      </p>
      ${detailTable([
        ['Listing', listingTitle],
        ['Quantity', `${quantity} unit${quantity !== 1 ? 's' : ''}`],
        ['Your offer', `£${originalPricePounds}/unit`],
        ['Counter price', `£${counterPricePounds}/unit`],
        ['From', sellerHandle],
        ...(counterMessage ? [['Note', counterMessage]] : []),
      ])}
      ${btn(`${FRONTEND_URL}/`, 'Accept or decline')}
      ${divider()}
      <p style="font-size:13px;color:#8896A7;margin:0;">
        Log in to your dashboard to respond. This counter-offer will expire after 48 hours.
      </p>
    `)
  })
}

/**
 * 5. Offer declined
 */
async function sendOfferDeclined({ email, listingTitle, perspective }) {
  const isBuyer = perspective === 'buyer'
  return sendEmail({
    to: email,
    subject: `Offer declined — ${listingTitle}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        ${isBuyer ? 'Your offer was declined' : 'You declined an offer'}
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 16px;">
        ${isBuyer
          ? `The seller has declined your offer on <strong>${listingTitle}</strong>. The listing remains available — you are welcome to browse other stock or submit a new offer.`
          : `You declined an offer on <strong>${listingTitle}</strong>. Your listing remains active.`
        }
      </p>
      ${btn(`${FRONTEND_URL}/listings`, 'Browse listings')}
    `)
  })
}

/**
 * 6. Payment confirmed — both parties
 */
async function sendPaymentConfirmed({ email, listingTitle, totalPounds, feePounds, payoutPounds, perspective, orderId }) {
  const isBuyer = perspective === 'buyer'
  return sendEmail({
    to: email,
    subject: `Payment confirmed — ${listingTitle}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        Payment confirmed
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        ${isBuyer
          ? 'Your payment has been received and the transaction is confirmed. You can now message the seller to coordinate delivery.'
          : 'Payment has been received for your listing. Your payout will be processed to your connected bank account.'
        }
      </p>
      ${detailTable([
        ['Listing', listingTitle],
        ...(isBuyer
          ? [['Total paid', `£${totalPounds}`]]
          : [
              ['Goods value', `£${totalPounds}`],
              ['Platform fee', `£${feePounds}`],
              ['Your payout', `£${payoutPounds}`],
            ]
        ),
      ])}
      <p style="font-size:14px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        A private message thread is now open between you and the ${isBuyer ? 'seller' : 'buyer'} to coordinate logistics. All communication remains anonymous.
      </p>
      ${btn(`${FRONTEND_URL}/orders/${orderId}`, 'View order and messages')}
    `)
  })
}

/**
 * 7. New message received
 */
async function sendNewMessage({ email, senderHandle, listingTitle, orderId }) {
  return sendEmail({
    to: email,
    subject: `New message on your order — ${listingTitle}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        You have a new message
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 16px;">
        <strong>${senderHandle}</strong> has sent you a message regarding <strong>${listingTitle}</strong>.
      </p>
      <p style="font-size:14px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        Log in to read and reply. All messages are kept within the platform to protect both parties' anonymity.
      </p>
      ${btn(`${FRONTEND_URL}/orders/${orderId}`, 'Read message')}
      ${divider()}
      <p style="font-size:13px;color:#8896A7;margin:0;">
        Do not share personal contact details, company names, or any information that could identify you outside of the platform.
      </p>
    `)
  })
}

/**
 * 8. Brand eligibility review request (supplier)
 */
async function sendBrandReviewRequest({ email, brandName, applicantRole, reviewId }) {
  return sendEmail({
    to: email,
    subject: `Brand eligibility review requested — ${brandName}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        Your input is requested
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        The Overstocks Alliance admin team has requested your input on a new member application for access to one of your brands.
      </p>
      ${detailTable([
        ['Brand', brandName],
        ['Applicant type', applicantRole.charAt(0).toUpperCase() + applicantRole.slice(1)],
      ])}
      <p style="font-size:14px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        Your response is advisory — the final decision rests with the platform admin. Log in to your dashboard to recommend approval or decline.
      </p>
      ${btn(`${FRONTEND_URL}/`, 'Review application')}
      ${divider()}
      <p style="font-size:13px;color:#8896A7;margin:0;">
        This request will expire in 7 days. If you do not respond, the admin will make the decision independently.
      </p>
    `)
  })
}

/**
 * 9. Listing approved
 */
async function sendListingApproved({ email, listingTitle }) {
  return sendEmail({
    to: email,
    subject: `Your listing is now live — ${listingTitle}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        Your listing is live
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 16px;">
        Your listing <strong>${listingTitle}</strong> has been reviewed and is now visible to authorised buyers on the platform.
      </p>
      ${btn(`${FRONTEND_URL}/my-listings`, 'View my listings')}
    `)
  })
}

/**
 * 10. Listing removed by admin
 */
async function sendListingRemoved({ email, listingTitle, reason }) {
  return sendEmail({
    to: email,
    subject: `Your listing has been removed — ${listingTitle}`,
    html: layout(`
      <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;color:#0B1628;font-family:Georgia,serif;">
        Listing removed
      </h1>
      <p style="font-size:15px;line-height:1.7;color:#4A5568;margin:0 0 16px;">
        Your listing <strong>${listingTitle}</strong> has been removed from the platform by our moderation team.
      </p>
      ${reason ? `<p style="font-size:14px;line-height:1.7;color:#4A5568;background:#FDF0EE;border-left:3px solid #C0392B;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px;">
        Reason: ${reason}
      </p>` : ''}
      <p style="font-size:14px;line-height:1.7;color:#4A5568;margin:0 0 4px;">
        If you believe this was done in error, please contact the platform admin.
      </p>
      ${btn(`${FRONTEND_URL}/my-listings`, 'View my listings')}
    `)
  })
}

module.exports = {
  sendAccountApproved,
  sendNewOfferReceived,
  sendOfferAccepted,
  sendCounterOfferReceived,
  sendOfferDeclined,
  sendPaymentConfirmed,
  sendNewMessage,
  sendBrandReviewRequest,
  sendListingApproved,
  sendListingRemoved
}
