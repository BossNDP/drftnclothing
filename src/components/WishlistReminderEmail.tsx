/* eslint-disable @next/next/no-head-element */
import * as React from 'react';

export interface WishlistEmailItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_price?: number | null;
  image: string;
  category: string;
  stockCount?: number;
  reason?: 'idle_reminder' | 'low_stock' | 'price_drop';
}

interface WishlistReminderEmailProps {
  customerName?: string;
  items: WishlistEmailItem[];
  siteUrl?: string;
}

function formatEmailPrice(val: number | null | undefined): string | null {
  if (val === null || val === undefined || isNaN(val) || val <= 0) {
    return null;
  }
  // If val is stored in paise (e.g. 600000 = ₹6,000, 129900 = ₹1,299), divide by 100.
  // If val is already in rupees (e.g. 6000, 1299, 60), keep as is.
  const inRupees = val >= 10000 ? Math.round(val / 100) : Math.round(val);
  return `₹${inRupees.toLocaleString('en-IN')}`;
}

export const WishlistReminderEmail: React.FC<WishlistReminderEmailProps> = ({
  customerName = 'Valued Customer',
  items,
  siteUrl = 'https://www.drftnclothing.in',
}) => {
  const isMultiItem = items.length > 1;
  const headline = isMultiItem
    ? `${items.length} GARMENTS WAITING IN YOUR WISHLIST`
    : `STILL THINKING ABOUT IT?`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{headline} | DRFTN</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#000000',
          color: '#FFFFFF',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <table
          role="presentation"
          width="100%"
          border={0}
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: '#000000', padding: '40px 10px' }}
        >
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="100%"
                style={{
                  maxWidth: '600px',
                  backgroundColor: '#0A0A0A',
                  border: '1px solid #27272A',
                  borderRadius: '16px',
                  overflow: 'hidden',
                }}
                border={0}
                cellPadding={0}
                cellSpacing={0}
              >
                {/* ── HEADER BRAND BAR ── */}
                <tr>
                  <td
                    align="center"
                    style={{
                      padding: '32px 24px 20px 24px',
                      borderBottom: '1px solid #18181B',
                      backgroundColor: '#000000',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '22px',
                        fontWeight: 900,
                        letterSpacing: '0.25em',
                        color: '#FFFFFF',
                        textTransform: 'uppercase',
                      }}
                    >
                      DRFTN™
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '9px',
                        letterSpacing: '0.3em',
                        color: '#71717A',
                        textTransform: 'uppercase',
                        marginTop: '4px',
                      }}
                    >
                      BORN IN YELAHANKA • INDUSTRIAL MINIMALISM
                    </div>
                  </td>
                </tr>

                {/* ── MAIN HERO INTRO ── */}
                <tr>
                  <td style={{ padding: '32px 28px 16px 28px' }}>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        color: '#FFFFFF',
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                      }}
                    >
                      WISHLIST REMINDER
                    </div>
                    <h1
                      style={{
                        margin: 0,
                        fontSize: '24px',
                        fontWeight: 900,
                        letterSpacing: '-0.02em',
                        color: '#FFFFFF',
                        textTransform: 'uppercase',
                        lineHeight: '1.25',
                      }}
                    >
                      {headline}
                    </h1>
                    <p
                      style={{
                        margin: '12px 0 0 0',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#A1A1AA',
                      }}
                    >
                      Hey {customerName}, your saved streetwear pieces are reserved in your wishlist. Stock is limited and demand is high — secure your sizes before they run out.
                    </p>
                  </td>
                </tr>

                {/* ── PRODUCTS LISTING CONTAINER ── */}
                <tr>
                  <td style={{ padding: '0 28px 24px 28px' }}>
                    {items.map((item, idx) => {
                      const priceFormatted = formatEmailPrice(item.price) || '₹0';
                      const comparePriceFormatted = formatEmailPrice(item.compare_price);
                      const productUrl = `${siteUrl}/shop/${item.slug}`;

                      return (
                        <table
                          key={item.id || idx}
                          role="presentation"
                          width="100%"
                          style={{
                            backgroundColor: '#121215',
                            border: '1px solid #27272A',
                            borderRadius: '12px',
                            marginBottom: idx === items.length - 1 ? 0 : '20px',
                            overflow: 'hidden',
                          }}
                          border={0}
                          cellPadding={0}
                          cellSpacing={0}
                        >
                          <tr>
                            <td
                              align="center"
                              style={{
                                backgroundColor: '#18181B',
                                padding: '16px',
                              }}
                            >
                              <a href={productUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  width="100%"
                                  style={{
                                    maxWidth: '480px',
                                    height: 'auto',
                                    borderRadius: '8px',
                                    display: 'block',
                                    objectFit: 'cover',
                                  }}
                                />
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '20px 24px' }}>
                              {/* Urgency Badge if Low Stock or Price Drop */}
                              {item.stockCount && item.stockCount <= 5 ? (
                                <div
                                  style={{
                                    display: 'inline-block',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontFamily: 'monospace',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#FFFFFF',
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    marginBottom: '10px',
                                  }}
                                >
                                  ONLY {item.stockCount} LEFT IN STOCK
                                </div>
                              ) : comparePriceFormatted ? (
                                <div
                                  style={{
                                    display: 'inline-block',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    padding: '3px 8px',
                                    fontFamily: 'monospace',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#FFFFFF',
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    marginBottom: '10px',
                                  }}
                                >
                                  PRICE DROP ALERT
                                </div>
                              ) : null}

                              <div
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '10px',
                                  color: '#71717A',
                                  letterSpacing: '0.15em',
                                  textTransform: 'uppercase',
                                  marginBottom: '4px',
                                }}
                              >
                                {item.category}
                              </div>

                              <h2
                                style={{
                                  margin: '0 0 8px 0',
                                  fontSize: '18px',
                                  fontWeight: 800,
                                  color: '#FFFFFF',
                                  textTransform: 'uppercase',
                                  letterSpacing: '-0.01em',
                                }}
                              >
                                {item.name}
                              </h2>

                              {/* Price Row */}
                              <div style={{ marginBottom: '14px' }}>
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: '20px',
                                    fontWeight: 900,
                                    color: '#FFFFFF',
                                    marginRight: '8px',
                                  }}
                                >
                                  {priceFormatted}
                                </span>
                                {comparePriceFormatted && (
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: '14px',
                                      color: '#71717A',
                                      textDecoration: 'line-through',
                                    }}
                                  >
                                    {comparePriceFormatted}
                                  </span>
                                )}
                              </div>

                              {/* Trust Stars */}
                              <div
                                style={{
                                  fontFamily: 'sans-serif',
                                  fontSize: '12px',
                                  color: '#FFFFFF',
                                  marginBottom: '18px',
                                }}
                              >
                                ★★★★★ <span style={{ color: '#A1A1AA', fontSize: '11px', fontFamily: 'monospace' }}>Waiting in your wishlist</span>
                              </div>

                              {/* BUY NOW CTA Button */}
                              <a
                                href={productUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'block',
                                  backgroundColor: '#FFFFFF',
                                  color: '#000000',
                                  textDecoration: 'none',
                                  textAlign: 'center',
                                  padding: '14px 20px',
                                  borderRadius: '8px',
                                  fontFamily: 'monospace',
                                  fontSize: '13px',
                                  fontWeight: 900,
                                  letterSpacing: '0.15em',
                                  textTransform: 'uppercase',
                                  boxShadow: '0 4px 14px rgba(255, 255, 255, 0.15)',
                                }}
                              >
                                BUY NOW • {priceFormatted}
                              </a>
                            </td>
                          </tr>
                        </table>
                      );
                    })}
                  </td>
                </tr>

                {/* ── CONSOLIDATED SHOP ALL BUTTON ── */}
                <tr>
                  <td style={{ padding: '0 28px 32px 28px', textAlign: 'center' }}>
                    <a
                      href={`${siteUrl}/wishlist`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block',
                        backgroundColor: '#18181B',
                        border: '1px solid #3F3F46',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        textAlign: 'center',
                        padding: '12px 28px',
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                      }}
                    >
                      VIEW ALL SAVED GARMENTS ({items.length}) →
                    </a>
                  </td>
                </tr>

                {/* ── FOOTER ── */}
                <tr>
                  <td
                    style={{
                      padding: '24px 28px',
                      backgroundColor: '#000000',
                      borderTop: '1px solid #18181B',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        letterSpacing: '0.2em',
                        color: '#71717A',
                        textTransform: 'uppercase',
                        marginBottom: '8px',
                      }}
                    >
                      DRFTN CLOTHING • BENGALURU, INDIA
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#52525B',
                        lineHeight: '1.5',
                      }}
                    >
                      You received this email because you saved items to your DRFTN Wishlist.
                      <br />
                      © {new Date().getFullYear()} DRFTN. All rights reserved.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  );
};
