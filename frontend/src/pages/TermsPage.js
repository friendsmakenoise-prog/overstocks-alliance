import { Link } from 'react-router-dom'

const LAST_UPDATED = 'April 2026'
const PLATFORM_NAME = 'Overstocks Alliance'
const COMPANY_NAME = 'Overstocks Alliance Ltd'
const CONTACT_EMAIL = 'legal@overstocksalliance.com'

export default function TermsPage() {
  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 760 }}>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 8 }}>
            Terms and Conditions
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Last updated: {LAST_UPDATED} · <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--navy)' }}>{CONTACT_EMAIL}</a>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

          <Section title="1. About this platform">
            <p>{PLATFORM_NAME} is a private, invitation-only B2B trading platform operated by {COMPANY_NAME}. It facilitates the trading of overstock inventory between authorised retailers and suppliers. Access is strictly controlled and granted at our sole discretion.</p>
            <p>By registering for and using this platform, you agree to be bound by these Terms and Conditions in full. If you do not accept these terms, you must not use the platform.</p>
          </Section>

          <Section title="2. Eligibility and access">
            <p>This platform is available to registered businesses only. By applying for access you confirm that:</p>
            <ul>
              <li>You are acting on behalf of a legally registered business entity</li>
              <li>You have the authority to bind that business to these terms</li>
              <li>Your business is authorised to trade in the brands and products you list or purchase</li>
              <li>You will only list or purchase goods for legitimate commercial purposes</li>
            </ul>
            <p>We reserve the right to reject any application, suspend any account, or revoke access at any time without notice or liability.</p>
          </Section>

          <Section title="3. Authorised brands and products">
            <p>Each user is granted access to specific brands by the platform administrator. You may only list, browse, or purchase products relating to brands for which you have been explicitly authorised.</p>
            <p>By listing a product, you warrant that:</p>
            <ul>
              <li>You are an authorised retailer or supplier of that brand</li>
              <li>The goods are genuine, legally obtained, and accurately described</li>
              <li>You have the right to sell the goods and transfer title to the buyer</li>
              <li>The listing does not infringe any third-party intellectual property rights</li>
            </ul>
          </Section>

          <Section title="4. Transactions and the obligation to complete">
            <p style={{ fontWeight: 500, color: 'var(--navy)' }}>Once an offer has been accepted and payment has been made through the platform, the transaction is binding on both parties. You are not permitted to complete, redirect, or attempt to redirect any transaction outside of the platform.</p>
            <p>Specifically, you agree that:</p>
            <ul>
              <li>All transactions introduced through this platform must be completed through the platform's payment system</li>
              <li>You will not contact the counterparty directly to arrange payment outside the platform for any transaction that originated here</li>
              <li>You will not attempt to identify, solicit, or transact with another platform member outside of the platform for goods that were listed here</li>
              <li>Any attempt to circumvent platform transactions constitutes a material breach of these terms</li>
            </ul>
            <p>Breach of this clause may result in immediate account suspension, recovery of any platform fees that would have been due, and potential legal action to recover losses.</p>
          </Section>

          <Section title="5. Platform fees">
            <p>A platform fee is charged on each completed transaction. The fee is calculated as a percentage of the agreed goods value (excluding shipping) according to the following tiered structure:</p>
            <ul>
              <li>Orders under £1,000 — 3%</li>
              <li>Orders £1,000 to £5,000 — 2%</li>
              <li>Orders over £5,000 — 1%</li>
            </ul>
            <p>Fee tiers are subject to change at the platform's discretion. Changes will be communicated to members in advance and will not affect transactions already in progress.</p>
            <p>Payments are processed by Stripe. By transacting on the platform, sellers agree to Stripe's Connected Account Agreement. The platform does not hold client funds beyond the period necessary to complete a transaction.</p>
          </Section>

          <Section title="6. Anonymity and data protection">
            <p>The platform is designed to protect the commercial identities of its members. Your company name, contact details, and personal information will not be disclosed to other members in the normal course of trading.</p>
            <p>However, you acknowledge that:</p>
            <ul>
              <li>The platform operator retains full visibility of all member identities and transaction details for compliance and dispute resolution purposes</li>
              <li>In the event of a legal dispute, fraud investigation, or regulatory requirement, member identities may be disclosed to relevant authorities</li>
              <li>You are responsible for not voluntarily disclosing your own identity in listing descriptions or messages in ways that compromise the platform's anonymity model</li>
            </ul>
            <p>We process personal data in accordance with our Privacy Policy and applicable UK data protection legislation including the UK GDPR.</p>
          </Section>

          <Section title="7. Listings and content">
            <p>You are responsible for the accuracy of all listings you create. Listings must not:</p>
            <ul>
              <li>Contain false, misleading, or exaggerated descriptions</li>
              <li>Include counterfeit, stolen, or illegally obtained goods</li>
              <li>Violate any brand's authorised dealer agreement or resale restrictions</li>
              <li>Include your contact details, company name, or any information that could identify you to other members</li>
            </ul>
            <p>We reserve the right to remove any listing at our discretion without notice or liability.</p>
          </Section>

          <Section title="8. Disputes between members">
            <p>In the event of a dispute between a buyer and seller, both parties agree to first attempt resolution through the platform's messaging system. The platform operator may assist in facilitating resolution but is not obliged to do so and accepts no liability for the outcome of disputes between members.</p>
            <p>The platform operator's decision in any dispute relating to platform fees, access, or compliance with these terms shall be final.</p>
          </Section>

          <Section title="9. Liability">
            <p>The platform is provided as a trading facilitation service. We are not a party to transactions between members and accept no liability for:</p>
            <ul>
              <li>The quality, condition, or legality of any goods traded</li>
              <li>The failure of either party to complete a transaction</li>
              <li>Any loss of profit, business, or opportunity arising from use of the platform</li>
              <li>Platform downtime, technical errors, or data loss</li>
            </ul>
            <p>Our total liability to you in connection with the platform shall not exceed the platform fees paid by you in the 12 months preceding the relevant claim.</p>
          </Section>

          <Section title="10. Governing law">
            <p>These terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </Section>

          <Section title="11. Changes to these terms">
            <p>We may update these terms from time to time. We will notify registered members of material changes by email. Continued use of the platform following notification of changes constitutes acceptance of the updated terms.</p>
          </Section>

          <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--muted)' }}>
            <p>Questions about these terms? Contact us at <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--navy)' }}>{CONTACT_EMAIL}</a></p>
            <p style={{ marginTop: 8 }}>
              <Link to="/login" style={{ color: 'var(--navy)', fontWeight: 500 }}>← Back to sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 12, color: 'var(--navy)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--slate)', lineHeight: 1.7, fontSize: 15 }}>
        {children}
      </div>
    </div>
  )
}
