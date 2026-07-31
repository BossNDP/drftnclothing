'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, ShieldCheck, FileText, Landmark, Truck, RefreshCw, AlertCircle } from 'lucide-react';

interface PolicyData {
  title: string;
  icon: any;
  lastUpdated: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
}

const POLICIES: Record<string, PolicyData> = {
  'terms-and-conditions': {
    title: 'Terms & Conditions',
    icon: FileText,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        content: 'By accessing and purchasing from the DRFTN CLOTHING website (drftnclothing.in), you agree to comply with and be bound by these Terms & Conditions. If you do not agree, please refrain from using our platform.'
      },
      {
        heading: '2. User Accounts & Security',
        content: 'To place orders, you may register via our third-party authentication partner (Clerk). You are solely responsible for maintaining the confidentiality of your credentials and account access. Any activities under your account remain your direct liability.'
      },
      {
        heading: '3. Intellectual Property Rights',
        content: 'All designs, custom brand logo typography, drop themes, photographs, copy, visual layouts, and graphics are the exclusive intellectual property of DRFTN CLOTHING. Reproduction, theft, resale, or replication without express written authorization is strictly prohibited under intellectual property laws.'
      },
      {
        heading: '4. Limitation of Liability',
        content: 'DRFTN CLOTHING shall not be liable for any indirect, incidental, or consequential damages resulting from website downtime, product variation, delivery delays, or payment gateway transactions. Our total liability is limited to the exact transaction amount paid for the specific order.'
      },
      {
        heading: '5. Governing Law & Jurisdiction',
        content: 'These terms are governed by the laws of the Republic of India. Any disputes, claims, or legal proceedings arising out of this agreement shall fall under the exclusive jurisdiction of the courts of Bengaluru, Karnataka.'
      }
    ]
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    icon: ShieldCheck,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        content: 'We collect personal information necessary to fulfill your streetwear purchases. This includes your name, email address, phone number, shipping address, billing address, and payment information processed through secure tokenized transactions.'
      },
      {
        heading: '2. How We Use Your Data',
        content: 'Your data is strictly utilized to process transactions, generate invoice records, coordinate deliveries with shipping couriers, send transaction messages (via email, SMS, or WhatsApp), and deliver drop announcements (newsletter subscription options can be cancelled at any time).'
      },
      {
        heading: '3. Third-Party Data Sharing',
        content: 'To run our services, we share necessary data with trusted service providers: Razorpay (secure payment processor), Shiprocket (shipping and delivery dispatch), Clerk (user authorization), and Google Analytics (anonymous visitor behavior metrics). We never sell your data.'
      },
      {
        heading: '4. User Rights & Retention',
        content: 'You retain full rights to request access, rectification, or absolute deletion of your personal records. For inquiries, email support@drftn.in. We retain transaction data only as required to comply with financial accounting and regulatory standards.'
      }
    ]
  },
  'cookie-policy': {
    title: 'Cookie Policy',
    icon: ShieldCheck,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. What Are Cookies',
        content: 'Cookies are small text files stored on your device to make web browsing seamless. They help us remember items placed in your shopping bag, save your active sessions, and analyze overall site traffic patterns.'
      },
      {
        heading: '2. Types of Cookies We Use',
        content: '• Essential: Required for login states, cart preservation, and payment processing.\n• Analytics: Anonymized tracking of page visits and drop performance via Google Analytics.\n• Marketing: Setting personalization hooks to display relevant promotions across social feeds.'
      },
      {
        heading: '3. Managing Preferences',
        content: 'You can customize your cookie choices at any time using the preferences button on our banner, or by toggling cookie settings inside your browser. Restricting essential cookies may disrupt purchase workflows.'
      }
    ]
  },
  'refund-return-exchange-policy': {
    title: 'Return, Exchange & Refund Policy',
    icon: RefreshCw,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. 7-Day Easy Return Window',
        content: 'We offer a 7-day return and exchange policy from the date of package delivery. If you are not fully satisfied with the fit or style of your streetwear piece, you may request a return or exchange.'
      },
      {
        heading: '2. Conditions for Return',
        content: 'Items must be returned in their original condition: unworn, unwashed, with tags attached, and inside the original shipping packaging. Clearances, drop sales, and innerwear accessories are not eligible for returns due to hygiene standards.'
      },
      {
        heading: '3. Return Shipping Cost',
        content: 'Return pickups are fully covered by DRFTN CLOTHING for manufacturing defects or incorrect sizing dispatches. For normal returns or sizing swaps, a convenience pickup fee of ₹99 may be deducted from the refund balance.'
      },
      {
        heading: '4. Refund Processing',
        content: 'Once the returned item is inspected at our Bengaluru warehouse, refunds are initiated within 48 hours. The amount will reflect in your original payment method (bank account, card, or UPI) in 5-7 business days. COD orders are refunded as store credits or UPI transfer.'
      }
    ]
  },
  'shipping-and-delivery-policy': {
    title: 'Shipping & Delivery Policy',
    icon: Truck,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Processing Time',
        content: 'All orders are processed and packaged within 24-48 hours. Orders placed during drop launches may take slightly longer due to high volumes. Dispatches do not occur on Sundays or public holidays.'
      },
      {
        heading: '2. Shipping Fees & COD',
        content: '• Standard Delivery: Free across India for orders above ₹999. For orders under ₹999, a flat shipping fee of ₹99 applies.\n• Cash on Delivery (COD): Available for select PIN codes at a convenience fee of ₹50.'
      },
      {
        heading: '3. Delivery Timelines',
        content: '• Metro Cities (Bengaluru, Mumbai, Delhi, etc.): 3 to 5 business days.\n• Rest of India: 5 to 7 business days.\n• Deliveries are tracked securely via Shiprocket partners (Delhivery, BlueDart, etc.).'
      },
      {
        heading: '4. Delay and Force Majeure',
        content: 'DRFTN CLOTHING is not liable for delayed deliveries caused by courier logistics issues, extreme weather conditions, or local strikes. Real-time tracking notifications are sent via SMS and WhatsApp.'
      }
    ]
  },
  'cancellation-policy': {
    title: 'Cancellation Policy',
    icon: AlertCircle,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Pre-Shipment Cancellation',
        content: 'You can request to cancel your order at any time before the shipment is dispatched from our fulfillment center. Please request a cancellation by logging into your profile or contacting support@drftn.in.'
      },
      {
        heading: '2. Post-Shipment Cancellation',
        content: 'Once an order has been handed over to our shipping carrier, it cannot be cancelled. You must decline delivery when the package arrives, and it will be returned to us as RTO (Return to Origin). Normal refund timelines apply.'
      },
      {
        heading: '3. Refund Timelines',
        content: 'For cancelled pre-shipment orders, 100% of the payment is returned immediately, reflecting in your bank statement within 5-7 business days.'
      }
    ]
  },
  'grievance-redressal-policy': {
    title: 'Grievance Redressal Policy',
    icon: Landmark,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Consumer Protection Compliance',
        content: 'In compliance with the Consumer Protection (E-Commerce) Rules, 2020 under Indian legislation, DRFTN CLOTHING has appointed a dedicated Grievance Officer to resolve any customer escalations.'
      },
      {
        heading: '2. Grievance Officer Details',
        content: 'Name: Nagarjun D. P.\nTitle: Grievance Redressal Officer, DRFTN CLOTHING\nEmail: grievance@drftn.in\nAddress: 1st Floor, Kogilu Main Rd, above Sri Venkateshwar Vaibhava Veg Hotel, K B Sandra, Maruthi Nagar, Yelahanka, Bengaluru, Karnataka, India - 560064\nPhone: +91 74061 64512'
      },
      {
        heading: '3. Resolution Timeline',
        content: 'All complaints and escalations will be formally acknowledged within 48 hours of receipt. The grievance redressal team will make every effort to investigate and resolve the issue within 1 month from the date of submission.'
      }
    ]
  },
  'disclaimer': {
    title: 'Disclaimer',
    icon: AlertCircle,
    lastUpdated: 'July 2026',
    sections: [
      {
        heading: '1. Product Representation',
        content: 'Streetwear pieces displayed on our platform are representation-accurate. However, slight variation in wash patterns (e.g. acid wash, stone wash), fabric color hues, and graphics vibrancy may occur due to photography studio lighting and user screen calibrations.'
      },
      {
        heading: '2. Sizing Approximation',
        content: 'All sizing specifications (oversized drops, boxy fits) follow size chart guidelines. Please allow for a standard industry tolerance variance of +/- 0.5 inches in flat-laid garment measurements.'
      }
    ]
  }
};

// Aliases for Razorpay Compliance Standards
POLICIES['refund-policy'] = POLICIES['refund-return-exchange-policy'];
POLICIES['shipping-policy'] = POLICIES['shipping-and-delivery-policy'];
POLICIES['terms-of-service'] = POLICIES['terms-and-conditions'];
POLICIES['privacy'] = POLICIES['privacy-policy'];

export default function PolicyPage({ params }: { params: { slug: string } }) {
  const policy = POLICIES[params.slug];

  if (!policy) {
    notFound();
  }

  const IconComponent = policy.icon;

  return (
    <div className="py-12 px-6 md:px-12 max-w-4xl mx-auto w-full flex-1 flex flex-col animate-fade-in">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-8">
        <Link href="/" className="hover:text-brand-offwhite">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-zinc-400">Policies</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-brand-offwhite">{policy.title}</span>
      </div>

      {/* Header Panel */}
      <div className="border border-zinc-800 bg-zinc-900/10 p-6 md:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white">
            <IconComponent className="w-5 h-5" />
            <span className="text-[10px] tracking-[0.25em] uppercase font-bold font-mono">DRFTN Legal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold uppercase tracking-wider text-brand-offwhite">
            {policy.title}
          </h1>
          <p className="text-[10px] text-zinc-500 font-mono">LAST UPDATED: {policy.lastUpdated}</p>
        </div>
        <div className="bg-white/10 border border-white/20 px-4 py-2 rounded text-[10px] font-bold text-white uppercase tracking-wider">
          Official Store Policy
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-10">
        {policy.sections.map((section, idx) => (
          <div key={idx} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-brand-offwhite border-b border-zinc-850 pb-2">
              {section.heading}
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-light font-body whitespace-pre-line">
              {section.content}
            </p>
          </div>
        ))}
      </div>

      {/* Contact Support Footer */}
      <div className="mt-16 pt-8 border-t border-zinc-850 text-center space-y-4">
        <p className="text-xs text-zinc-500 font-body">Have any questions regarding our store policies?</p>
        <Link 
          href="/contact" 
          className="inline-block border border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 hover:bg-zinc-900/40 text-brand-offwhite px-6 py-3 text-[10px] uppercase font-bold tracking-widest transition-all"
        >
          Contact Support Team
        </Link>
      </div>
    </div>
  );
}
