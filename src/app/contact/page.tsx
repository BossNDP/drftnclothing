'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { useToast } from '@/components/ToastContainer';
import { MapPin, Phone, Mail, Send } from 'lucide-react';

export default function ContactPage() {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      return addToast('Please fill in all fields', 'error');
    }
    setIsSubmitting(true);

    try {
      // 1. Record message to database (fire and forget)
      db.createContactSubmission(formData).catch((err) => {
        console.warn('Database contact record warning:', err);
      });

      // 2. Prepare pre-filled WhatsApp message to +91 7406164512
      const messageText = `Hello DRFTN CLOTHING!%0A%0A*Name:* ${encodeURIComponent(formData.name.trim())}%0A*Email:* ${encodeURIComponent(formData.email.trim())}%0A*Message:* ${encodeURIComponent(formData.message.trim())}`;
      const whatsappUrl = `https://wa.me/917406164512?text=${messageText}`;

      addToast('Opening WhatsApp to send your message...', 'success');

      // 3. Open WhatsApp in new window
      window.open(whatsappUrl, '_blank');

      setFormData({ name: '', email: '', message: '' });
    } catch (error) {
      console.error(error);
      addToast('Failed to prepare WhatsApp message. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 md:px-12 py-16 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Left Col: Contact Info */}
        <div className="space-y-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-widest text-brand-offwhite uppercase mb-4">
              Get in Touch
            </h1>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-sm">
              Whether you have a question about sizing, order status, or just want to say hi, drop us a line below or reach out directly.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center border border-zinc-800 flex-shrink-0">
                <MapPin className="w-5 h-5 text-brand-red" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-offwhite mb-1">Location</h3>
                <p className="text-zinc-500 text-sm">1st Floor, Kogilu Main Rd, above Sri Venkateshwar Vaibhava Veg Hotel, K B Sandra, Yelahanka, Bengaluru<br />Karnataka, India - 560064</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center border border-zinc-800 flex-shrink-0">
                <Phone className="w-5 h-5 text-brand-red" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-offwhite mb-1">Phone</h3>
                <a href="tel:+917406164512" className="text-zinc-500 text-sm hover:text-brand-offwhite transition-colors">+91 7406164512</a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-zinc-900 flex items-center justify-center border border-zinc-800 flex-shrink-0">
                <Mail className="w-5 h-5 text-brand-red" />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-brand-offwhite mb-1">Email</h3>
                <a href="mailto:drftnclothing@gmail.com" className="text-zinc-500 text-sm hover:text-brand-offwhite transition-colors">drftnclothing@gmail.com</a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Contact Form */}
        <div className="bg-zinc-900/30 border border-zinc-800 p-8 md:p-10">
          <h2 className="text-2xl font-bold uppercase tracking-widest text-brand-offwhite mb-8">Send a Message</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Your Name</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-zinc-900/80 border border-zinc-800 text-brand-offwhite px-4 py-3 focus:outline-none focus:border-brand-red transition-colors"
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Email Address</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-zinc-900/80 border border-zinc-800 text-brand-offwhite px-4 py-3 focus:outline-none focus:border-brand-red transition-colors"
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold block">Message</label>
              <textarea
                name="message"
                required
                value={formData.message}
                onChange={handleChange}
                rows={5}
                className="w-full bg-zinc-900/80 border border-zinc-800 text-brand-offwhite px-4 py-3 focus:outline-none focus:border-brand-red transition-colors resize-none"
                placeholder="How can we help you?"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-offwhite text-brand-black px-8 py-4 font-bold uppercase tracking-widest text-sm hover:bg-zinc-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
              {!isSubmitting && <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
