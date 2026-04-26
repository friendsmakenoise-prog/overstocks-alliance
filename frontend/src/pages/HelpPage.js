import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const GUIDES = {
  retailer: {
    label: 'Retailer',
    colour: 'var(--navy)',
    intro: 'Welcome to Overstocks Alliance. As an authorised retailer you can browse and purchase overstock from verified brand suppliers — privately, professionally, and at competitive prices.',
    sections: [
      {
        icon: '🔐',
        title: 'Getting started',
        steps: [
          { heading: 'Your account is approved', body: 'You\'ll receive a confirmation once our team has verified your application. Until then your account sits in a pending state.' },
          { heading: 'Apply for brand access', body: 'Head to the Brands page in the navigation bar. Search the full platform brand list and tick any brands you are authorised to sell. Submit your application — we verify eligibility with brand suppliers before granting access.' },
          { heading: 'Your identity is always protected', body: 'You trade under a unique anonymous codename generated per transaction. No other member ever sees your company name or contact details during trading.' },
        ]
      },
      {
        icon: '🔍',
        title: 'Browsing listings',
        steps: [
          { heading: 'Your brand feed', body: 'The Browse page shows active listings for all brands you\'re approved for. Use the search bar and filters to narrow by brand, price range, or keywords.' },
          { heading: 'Show all brands', body: 'Toggle "Show all brands" to see listings across the entire platform. Brands you\'re not yet authorised for appear greyed out with a 🔒 badge. Tap "Apply for access" directly from the card to start the application without leaving the page.' },
          { heading: 'Open to all listings', body: 'Listings marked ⭐ Open to all are available to any verified retailer regardless of brand authorisations — no application needed. Filter for these specifically using the ⭐ button in the filter bar.' },
          { heading: 'Brand quick-search', body: 'From the Brands page, tap "Browse [Brand] listings →" next to any approved brand to jump straight to a filtered view of that brand\'s stock.' },
        ]
      },
      {
        icon: '🤝',
        title: 'Making an offer',
        steps: [
          { heading: 'Buy now or make an offer', body: 'On any listing detail page, tap the gold button to open the offer panel. You can buy at the listed price for the full quantity, or negotiate a different price or quantity.' },
          { heading: 'Offer accepted', body: 'When the seller accepts, you\'ll see a "Ready to pay" status in your dashboard. Tap Pay now to be taken to secure checkout via Stripe.' },
          { heading: 'Countering', body: 'Sellers may counter your offer with a different price. You\'ll be notified on your dashboard and can accept, decline, or counter back.' },
          { heading: 'Messaging', body: 'Once an offer is accepted and payment made, a private message thread opens between you and the seller — both parties remain anonymous throughout.' },
        ]
      },
      {
        icon: '📊',
        title: 'Your dashboard',
        steps: [
          { heading: 'Needs attention', body: 'The amber "Needs attention" count shows offers waiting on you — a seller has countered, or an accepted offer is ready to pay. Tap the card to scroll straight to them.' },
          { heading: 'Brand notifications', body: 'When a brand application is approved or declined, a notification banner appears at the top of your dashboard. Tap "Browse listings" on an approved notification to go straight to that brand\'s stock. Dismiss notifications with the × button.' },
          { heading: 'Payment settings', body: 'Connect your Stripe account via the Payment settings link in your dashboard or profile page. This is required to make purchases.' },
        ]
      },
    ]
  },

  supplier: {
    label: 'Supplier',
    colour: 'var(--gold)',
    intro: 'As a verified brand supplier you have oversight of all listings trading under your brands. Your role is to verify retailer eligibility, manage open market access, and monitor your brand\'s presence on the platform.',
    sections: [
      {
        icon: '🏷️',
        title: 'Registering your brands',
        steps: [
          { heading: 'Submit your brands on signup', body: 'During signup, use the "Add a brand or tier" field to list all brands and dealership tiers you distribute. If your brand uses tiered dealerships (Gold, Platinum, Premier etc.) add each as a separate entry so retailers can apply for the correct level.' },
          { heading: 'Adding brands later', body: 'Head to the Brands page in the navigation. Your currently registered brands are shown with green ticks. Use the text field to add new brands or tiers at any time — these go to our team for review.' },
          { heading: 'Brand approval', body: 'Our team reviews every brand submission and may contact you to verify your distribution rights before the brand goes live on the platform.' },
        ]
      },
      {
        icon: '✅',
        title: 'Reviewing retailer applications',
        steps: [
          { heading: 'Review requests from admin', body: 'When a retailer applies for access to one of your brands, our admin team may send you a review request. You\'ll see a notification on your dashboard with the applicant\'s company details — trading name, website, address, and contact.' },
          { heading: 'Approving tiers', body: 'If your brand has multiple tiers, each tier appears as a separate checkbox. Tick only the tiers this retailer is authorised for — for example a Silver dealer might get the base tier but not Gold or Platinum.' },
          { heading: 'Your recommendation is advisory', body: 'Your input is sent back to our admin team who make the final decision. You can add notes to explain your recommendation.' },
          { heading: 'Approved retailers list', body: 'From the Brands page, tap the "Approved retailers" stat card to see a full list of all retailers currently approved for your brands, along with their contact details for account management purposes.' },
        ]
      },
      {
        icon: '📦',
        title: 'Managing brand listings',
        steps: [
          { heading: 'Brand listings page', body: 'The Brand listings page (in the nav) shows all active listings across every brand you distribute — not just your own listings, but any retailer\'s stock trading under your brands.' },
          { heading: 'Open to all', body: 'For any active listing, toggle ⭐ Open to all to make it visible to all verified retailers on the platform, regardless of their brand authorisations. Use this for clearance or discontinued lines to maximise reach. Toggle it off at any time to restore normal brand-gated access.' },
          { heading: 'Filtering', body: 'Filter brand listings by status (Live, Pending, Sold), by brand if you distribute multiple, or show only Open to all listings to see what\'s currently in open market mode.' },
          { heading: 'Creating your own listings', body: 'Use + New listing in the navigation to list your own overstock directly. Set the Open to all option during creation if appropriate — this option is only available to suppliers, not retailers.' },
        ]
      },
      {
        icon: '📊',
        title: 'Your dashboard',
        steps: [
          { heading: 'At a glance', body: 'Your dashboard shows Active brand listings, Pending review count, and any Brand reviews awaiting your input highlighted in amber.' },
          { heading: 'Brand review notifications', body: 'When admin requests your input on a retailer application, a notification appears on your dashboard with the applicant\'s full details. Respond directly from the card.' },
          { heading: 'Payment settings', body: 'Connect your Stripe account to receive payouts when your listings sell. Go to Payment settings from the dashboard or your profile page.' },
        ]
      },
    ]
  },

  admin: {
    label: 'Administrator',
    colour: 'var(--green)',
    intro: 'As a platform administrator you have full oversight of all users, brands, listings, orders, and finances. This guide covers the main workflows you\'ll use day to day.',
    sections: [
      {
        icon: '👥',
        title: 'Approving new users',
        steps: [
          { heading: 'Pending approvals', body: 'New registrations appear in your dashboard under "Pending approvals" and in the Control panel under the Pending tab. Click any user to open their full profile.' },
          { heading: 'Reviewing a retailer', body: 'On the user page you can see their company name, contact details, website, trading address, and any brand applications they\'ve submitted. Grant brand access using the toggle next to each brand before approving the account.' },
          { heading: 'Reviewing a supplier', body: 'Supplier pages show their brand submissions under "Brand submissions". For each brand: if it already exists on the platform you can approve them as a distributor in one click. If the brand is new, confirm the name and click "Create brand & approve" — this adds it to the platform brand list automatically.' },
          { heading: 'Approve, suspend or cancel', body: 'Use the action buttons in the top-right of the user page. Suspending blocks login immediately. Cancelling permanently closes the account. All actions are logged in the audit trail.' },
        ]
      },
      {
        icon: '🏷️',
        title: 'Managing brands',
        steps: [
          { heading: 'Adding brands', body: 'Go to Control panel → Brands tab. Use the "Add a brand" form on the right. Use consistent naming for tiered brands — e.g. "Gibson", "Gibson — Acoustic", "Gibson Gold" so the family matching system works correctly.' },
          { heading: 'Family matching', body: 'When a supplier types a parent brand name (e.g. "Roland"), the system automatically creates applications for all brands that start with that prefix — "Roland", "Roland — Keys", "Roland — Drums" etc. The supplier then ticks which tiers to approve during the eligibility review.' },
          { heading: 'Granting and revoking access', body: 'On any retailer\'s user page, toggle brand access on or off using the Grant/Revoke buttons. Changes take effect immediately — the retailer\'s Browse page updates on their next visit.' },
        ]
      },
      {
        icon: '📋',
        title: 'Brand applications',
        steps: [
          { heading: 'Dashboard widget', body: 'The Brand applications widget on your dashboard shows two priority levels: applications where a supplier has already responded (green border, shown first) and new applications awaiting supplier review (amber). Click any item to go straight to the applications page.' },
          { heading: 'Sending to supplier for review', body: 'Open a brand application and expand it. If suppliers are registered for that brand, you\'ll see them listed with a "Send review request" button. If no suppliers are registered yet, a dropdown of all approved supplier accounts lets you send to any of them.' },
          { heading: 'Approving an application', body: 'Once a supplier has responded (or if you\'re making the call yourself), use the Approve or Decline buttons. Approving grants the retailer brand_permission immediately and they can start browsing and buying.' },
          { heading: 'Unregistered brands', body: 'Applications for brands not yet on the platform are flagged as "Unregistered". Use the link-brand controls to either create the brand on the fly or link to an existing one. "Link all family brands" creates applications for all brands in the same family.' },
        ]
      },
      {
        icon: '📦',
        title: 'Listings & orders',
        steps: [
          { heading: 'Reviewing listings', body: 'New listings from suppliers and retailers go to pending_review status. Review them in the Control panel → Listing review tab, or via the Listings & orders page. Approve to make them live, or remove with a reason.' },
          { heading: 'Admin editing', body: 'From the Listings & orders page, expand any listing\'s edit panel to adjust title, price, quantity, description, or the Open to all setting. Changes save immediately.' },
          { heading: 'Flagging suspicious activity', body: 'Use the 🚩 Flag button on any listing or order to mark it for investigation. Flagged listings are hidden from buyers. Add a reason — this is logged in the audit trail. Clear flags with the Reactivate button once resolved.' },
          { heading: 'Cancelling orders', body: 'Paid orders can be cancelled from the Orders tab. A clear warning reminds you that Stripe refunds must be processed manually. The reason is logged against the order.' },
          { heading: 'User reports', body: 'Reports submitted by members appear in the Control panel → Reports tab and your dashboard. Each report shows the listing, reason, and reporter. Review the listing directly, then either remove it or dismiss the report.' },
        ]
      },
      {
        icon: '💰',
        title: 'Finance',
        steps: [
          { heading: 'Transaction history', body: 'The Finance page shows all completed paid orders with goods value, platform fee, and seller payout. Columns collapse on mobile to show the essentials.' },
          { heading: 'Fee tiers', body: 'Edit fee percentages in the Fee tiers panel. Changes apply to new transactions only — existing accepted offers use the fee calculated at offer time. Always save before leaving the page.' },
          { heading: 'Platform fees', body: 'Fees are calculated on goods value only. Shipping costs pass 100% to the seller and are never included in the fee calculation.' },
        ]
      },
    ]
  }
}

export default function HelpPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Default to the user's own role, but allow switching
  const defaultRole = profile?.role === 'admin' ? 'admin'
    : profile?.role === 'supplier' ? 'supplier'
    : 'retailer'

  const [activeRole, setActiveRole] = useState(defaultRole)
  const [openSection, setOpenSection] = useState(null)

  const guide = GUIDES[activeRole]

  const ROLE_CONFIG = {
    retailer: { label: 'Retailer guide',     border: 'var(--navy)' },
    supplier: { label: 'Supplier guide',     border: 'var(--gold)' },
    admin:    { label: 'Administrator guide', border: 'var(--green)' },
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 760 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 8 }}>
            Help & getting started
          </h1>
          <p style={{ color: 'var(--slate)', fontSize: 15, lineHeight: 1.7 }}>
            Everything you need to know to get the most from Overstocks Alliance.
            <br />
            <em style={{ color: 'var(--muted)', fontSize: 13 }}>Private trading for authorised brand partners.</em>
          </p>
        </div>

        {/* Role switcher */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 28,
          background: 'var(--surface)', padding: 6,
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          flexWrap: 'wrap'
        }}>
          {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
            <button
              key={role}
              onClick={() => { setActiveRole(role); setOpenSection(null) }}
              style={{
                flex: '1 1 auto',
                padding: '10px 16px',
                borderRadius: 'var(--radius)',
                border: activeRole === role ? `2px solid ${cfg.border}` : '2px solid transparent',
                background: activeRole === role ? 'var(--white)' : 'transparent',
                color: activeRole === role ? 'var(--navy)' : 'var(--muted)',
                fontWeight: activeRole === role ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-body)',
                boxShadow: activeRole === role ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Intro card */}
        <div style={{
          padding: '20px 24px',
          background: 'var(--navy)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 24,
          borderLeft: `4px solid ${guide.colour}`
        }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.8, margin: 0 }}>
            {guide.intro}
          </p>
        </div>

        {/* Sections — accordion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {guide.sections.map((section, si) => {
            const isOpen = openSection === si
            return (
              <div key={si} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                {/* Section header */}
                <button
                  onClick={() => setOpenSection(isOpen ? null : si)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12,
                    padding: '16px 20px',
                    background: isOpen ? 'var(--surface)' : 'var(--white)',
                    border: 'none', cursor: 'pointer',
                    borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>{section.icon}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--navy)' }}>
                      {section.title}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 500,
                      color: 'var(--muted)', background: 'var(--surface)',
                      padding: '2px 8px', borderRadius: 100,
                      border: '1px solid var(--border)'
                    }}>
                      {section.steps.length} topics
                    </span>
                  </div>
                  <span style={{
                    color: 'var(--muted)', fontSize: 18, lineHeight: 1,
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                    flexShrink: 0
                  }}>›</span>
                </button>

                {/* Steps */}
                {isOpen && (
                  <div style={{ padding: '8px 0' }}>
                    {section.steps.map((step, i) => (
                      <div key={i} style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1fr',
                        gap: '0 12px',
                        padding: '14px 20px',
                        borderBottom: i < section.steps.length - 1 ? '1px solid var(--border)' : 'none',
                        alignItems: 'start'
                      }}>
                        {/* Step number */}
                        <div style={{
                          width: 28, height: 28,
                          borderRadius: '50%',
                          background: guide.colour,
                          color: activeRole === 'supplier' ? 'var(--navy)' : 'var(--white)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                          flexShrink: 0, marginTop: 1
                        }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>
                            {step.heading}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--slate)', lineHeight: 1.7 }}>
                            {step.body}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer CTA */}
        <div style={{
          marginTop: 32, padding: '20px 24px',
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', textAlign: 'center'
        }}>
          <p style={{ fontSize: 14, color: 'var(--slate)', marginBottom: 16 }}>
            Can't find what you're looking for? Contact the platform admin directly.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to dashboard
          </button>
        </div>

      </div>
    </div>
  )
}
