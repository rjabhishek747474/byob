'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  Heart,
  RefreshCw,
  ShieldCheck,
  Star,
  Truck,
  Search,
  ShoppingBag,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import {
  Block,
  BlockType,
} from '@/modules/pages/blocks/schemas';

// Icon mapping for benefits row
const ICON_MAP = {
  truck: Truck,
  shield: ShieldCheck,
  refresh: RefreshCw,
  heart: Heart,
  star: Star,
  clock: Clock,
};

// 1. Announcement Bar
export function AnnouncementBarBlock({ props }: { props: Record<string, unknown> }) {
  const text = (props.text as string) || '';
  const linkUrl = (props.linkUrl as string) || '';
  const linkText = (props.linkText as string) || '';
  const backgroundColor = (props.backgroundColor as string) || '#1e3a8a';
  const textColor = (props.textColor as string) || '#ffffff';

  return (
    <div
      className="w-full px-4 py-2.5 text-center text-xs sm:text-sm font-medium tracking-wide flex items-center justify-center gap-2 transition-colors"
      style={{ backgroundColor, color: textColor }}
    >
      <span>{text}</span>
      {linkUrl && linkText && (
        <Link
          href={linkUrl}
          className="underline underline-offset-4 hover:opacity-80 font-semibold ml-1 inline-flex items-center gap-0.5"
        >
          {linkText} <ChevronRight className="w-3 h-3 inline" />
        </Link>
      )}
    </div>
  );
}

// 2. Header Nav
export function HeaderNavBlock({ props }: { props: Record<string, unknown> }) {
  const menuItems = (props.menuItems as Array<{ label: string; href: string }>) || [];
  const showSearch = props.showSearch !== false;
  const showCart = props.showCart !== false;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo / Store Name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="font-extrabold text-xl sm:text-2xl tracking-tight text-gray-900 hover:text-blue-600 transition-colors">
            BYOB Store
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href || '/'}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center gap-4">
          {showSearch && (
            <button
              aria-label="Search products"
              className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
          {showCart && (
            <Link
              href="/cart"
              aria-label="Shopping Cart"
              className="p-2 text-gray-700 hover:text-gray-900 rounded-full hover:bg-gray-100 relative transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                0
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

// 3. Hero
export function HeroBlock({ props }: { props: Record<string, unknown> }) {
  const heading = (props.heading as string) || 'Welcome to our store';
  const subheading = (props.subheading as string) || '';
  const body = (props.body as string) || '';
  const ctaLabel = (props.ctaLabel as string) || '';
  const ctaHref = (props.ctaHref as string) || '/products';
  const textAlignment = (props.textAlignment as string) || 'center';

  const alignClass =
    textAlignment === 'left' ? 'text-left items-start' : textAlignment === 'right' ? 'text-right items-end' : 'text-center items-center';

  return (
    <section className="relative w-full py-20 sm:py-28 bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 text-white px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className={`max-w-4xl mx-auto flex flex-col ${alignClass} relative z-10`}>
        {subheading && (
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-blue-400 mb-3 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/50">
            {subheading}
          </span>
        )}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
          {heading}
        </h1>
        {body && (
          <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-300 max-w-2xl leading-relaxed">
            {body}
          </p>
        )}
        {ctaLabel && (
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3.5 rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all text-sm sm:text-base"
            >
              {ctaLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// 4. Banner Carousel
export function BannerCarouselBlock({ props }: { props: Record<string, unknown> }) {
  const slides = (props.slides as Array<{ heading?: string; ctaLabel?: string; ctaHref?: string; altText?: string }>) || [];
  const [current, setCurrent] = useState(0);

  if (slides.length === 0) return null;

  const prevSlide = () => setCurrent((c) => (c === 0 ? slides.length - 1 : c - 1));
  const nextSlide = () => setCurrent((c) => (c === slides.length - 1 ? 0 : c + 1));

  const slide = slides[current];

  return (
    <div className="relative w-full bg-gray-900 text-white overflow-hidden py-16 sm:py-24 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
          {slide.heading || 'Featured Collection'}
        </h2>
        {slide.ctaLabel && (
          <div className="mt-6">
            <Link
              href={slide.ctaHref || '/products'}
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              {slide.ctaLabel} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={nextSlide}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/70 rounded-full text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white w-6' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 5. Category Grid
export function CategoryGridBlock({ props }: { props: Record<string, unknown> }) {
  const title = (props.title as string) || 'Shop by Category';
  const columns = String(props.columns || '3');

  const colClass =
    columns === '2' ? 'grid-cols-1 sm:grid-cols-2' : columns === '4' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3';

  const defaultCategories = [
    { name: 'Apparel & Clothing', count: '48 items' },
    { name: 'Footwear & Shoes', count: '24 items' },
    { name: 'Accessories & Bags', count: '32 items' },
  ];

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">{title}</h2>}
      <div className={`grid gap-6 ${colClass}`}>
        {defaultCategories.map((cat, idx) => (
          <div
            key={idx}
            className="group relative rounded-xl border border-gray-200 bg-gray-50 p-6 hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"
          >
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {cat.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{cat.count}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 6. Product Grid
export function ProductGridBlock({ props }: { props: Record<string, unknown> }) {
  const title = (props.title as string) || 'Featured Products';
  const columns = String(props.columns || '4');
  const limit = Number(props.limit || 8);

  const colClass =
    columns === '2'
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === '3'
        ? 'grid-cols-1 sm:grid-cols-3'
        : 'grid-cols-2 sm:grid-cols-4';

  const sampleProducts = Array.from({ length: Math.min(limit, 8) }).map((_, i) => ({
    id: `prod-${i + 1}`,
    title: `Premium Essential Product ${i + 1}`,
    price: `₹${(1499 + i * 200).toLocaleString('en-IN')}`,
    tag: i === 0 ? 'Trending' : i === 1 ? 'Sale' : undefined,
  }));

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h2>
        <Link href="/products" className="text-sm font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className={`grid gap-6 ${colClass}`}>
        {sampleProducts.map((p) => (
          <div
            key={p.id}
            className="group border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
              <span className="text-xs text-gray-400 font-medium">Product Image</span>
              {p.tag && (
                <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  {p.tag}
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                {p.title}
              </h3>
              <p className="text-sm font-bold text-gray-900 mt-2">{p.price}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// 7. Featured Product Spotlight
export function FeaturedProductBlock({ props }: { props: Record<string, unknown> }) {
  const customHeading = (props.customHeading as string) || 'Spotlight Product';
  const showBuyNow = props.showBuyNow !== false;

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="border border-gray-200 rounded-2xl p-6 sm:p-10 bg-gradient-to-r from-gray-50 to-white grid md:grid-cols-2 gap-8 items-center shadow-sm">
        <div className="aspect-square bg-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-sm font-medium">
          Hero Product Image
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Exclusive Deal
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">
            {customHeading}
          </h2>
          <p className="text-2xl font-bold text-gray-900 mt-4">₹2,499.00</p>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            Crafted with precision engineering and high-grade sustainable materials. Enjoy 1-year warranty and express 48h delivery.
          </p>
          {showBuyNow && (
            <div className="mt-6 flex gap-4">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg shadow transition-colors text-sm">
                Add to Cart
              </button>
              <button className="border border-gray-300 hover:bg-gray-50 font-semibold px-6 py-3 rounded-lg transition-colors text-sm">
                View Details
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// 8. Promotional Strip
export function PromotionalStripBlock({ props }: { props: Record<string, unknown> }) {
  const bannerText = (props.bannerText as string) || 'Limited Time Offer';
  const highlightWord = (props.highlightWord as string) || '';
  const discountCode = (props.discountCode as string) || '';
  const expiryText = (props.expiryText as string) || '';
  const ctaLabel = (props.ctaLabel as string) || '';
  const ctaHref = (props.ctaHref as string) || '/products';

  return (
    <section className="w-full bg-amber-500 text-gray-950 py-5 px-4 sm:px-6 lg:px-8 shadow-inner">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <p className="font-extrabold text-base sm:text-lg tracking-tight">
            {bannerText}{' '}
            {highlightWord && (
              <span className="bg-gray-950 text-amber-400 px-2 py-0.5 rounded text-sm font-black ml-1">
                {highlightWord}
              </span>
            )}
          </p>
          {(discountCode || expiryText) && (
            <p className="text-xs font-medium text-gray-900/80 mt-0.5">
              {discountCode && `Use code: ${discountCode}`}
              {discountCode && expiryText && ' • '}
              {expiryText}
            </p>
          )}
        </div>
        {ctaLabel && (
          <Link
            href={ctaHref}
            className="bg-gray-950 hover:bg-gray-900 text-amber-400 font-bold px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-colors shadow shrink-0"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

// 9. Image With Text
export function ImageWithTextBlock({ props }: { props: Record<string, unknown> }) {
  const heading = (props.heading as string) || 'Our Heritage & Passion';
  const body = (props.body as string) || '';
  const imagePosition = (props.imagePosition as string) || 'left';
  const ctaLabel = (props.ctaLabel as string) || '';
  const ctaHref = (props.ctaHref as string) || '/about';

  const orderClass = imagePosition === 'right' ? 'md:flex-row-reverse' : 'md:flex-row';

  return (
    <section className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className={`flex flex-col ${orderClass} gap-8 sm:gap-12 items-center`}>
        <div className="w-full md:w-1/2 aspect-video sm:aspect-square bg-gray-200 rounded-2xl flex items-center justify-center text-gray-400 font-medium">
          Editorial Story Image
        </div>
        <div className="w-full md:w-1/2">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
            {heading}
          </h2>
          {body && <p className="mt-4 text-base text-gray-600 leading-relaxed">{body}</p>}
          {ctaLabel && (
            <div className="mt-6">
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 text-sm"
              >
                {ctaLabel} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// 10. Rich Text
export function RichTextBlock({ props }: { props: Record<string, unknown> }) {
  const content = (props.sanitizedContent as string) || '';
  const alignment = (props.alignment as string) || 'left';

  const alignClass =
    alignment === 'center' ? 'text-center mx-auto' : alignment === 'right' ? 'text-right ml-auto' : 'text-left';

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div
        className={`prose prose-blue max-w-none ${alignClass}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </section>
  );
}

// 11. Benefits Row
export function BenefitsRowBlock({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as Array<{ icon: keyof typeof ICON_MAP; title: string; description?: string }>) || [];

  return (
    <section className="border-y border-gray-200 bg-gray-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {items.map((item, idx) => {
          const IconComp = ICON_MAP[item.icon] || Star;
          return (
            <div key={idx} className="flex flex-col items-center">
              <div className="p-3 bg-blue-100/70 text-blue-700 rounded-xl mb-3">
                <IconComp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
              {item.description && (
                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{item.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// 12. Newsletter Capture
export function NewsletterCaptureBlock({ props }: { props: Record<string, unknown> }) {
  const heading = (props.heading as string) || 'Stay in the loop';
  const description = (props.description as string) || '';
  const buttonLabel = (props.buttonLabel as string) || 'Subscribe';
  const disclaimerText = (props.disclaimerText as string) || '';
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{heading}</h2>
      {description && <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-xl mx-auto">{description}</p>}

      {submitted ? (
        <div className="mt-6 p-4 bg-emerald-50 text-emerald-800 rounded-lg inline-flex items-center gap-2 text-sm font-semibold border border-emerald-200">
          <CheckCircle2 className="w-5 h-5" /> Thank you for subscribing!
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <input
            type="email"
            required
            placeholder="Enter your email"
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg text-sm transition-colors shadow shrink-0"
          >
            {buttonLabel}
          </button>
        </form>
      )}

      {disclaimerText && <p className="text-xs text-gray-400 mt-3">{disclaimerText}</p>}
    </section>
  );
}

// 13. FAQ Accordion
export function FaqAccordionBlock({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as Array<{ question: string; answer: string }>) || [];
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (i: number) => setOpenIdx(openIdx === i ? null : i);

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-8">
        Frequently Asked Questions
      </h2>
      <div className="divide-y divide-gray-200 border-y border-gray-200">
        {items.map((item, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} className="py-4">
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between text-left font-semibold text-gray-900 hover:text-blue-600 transition-colors gap-4"
              >
                <span>{item.question}</span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div
                  className="mt-3 text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: item.answer }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// 14. Testimonials
export function TestimonialsBlock({ props }: { props: Record<string, unknown> }) {
  const items = (props.items as Array<{ quote: string; authorName: string; authorTitle?: string; rating?: number }>) || [];

  return (
    <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-gray-50 rounded-2xl my-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">
        What Our Shoppers Say
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex gap-1 text-amber-400 mb-3">
                {Array.from({ length: item.rating || 5 }).map((_, r) => (
                  <Star key={r} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-sm text-gray-700 italic">&ldquo;{item.quote}&rdquo;</p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="font-semibold text-gray-900 text-sm">{item.authorName}</p>
              {item.authorTitle && <p className="text-xs text-gray-500">{item.authorTitle}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// 15. Footer
export function FooterBlock({ props }: { props: Record<string, unknown> }) {
  const copyrightText = (props.copyrightText as string) || '© 2026 BYOB Store.';
  const columns = (props.columns as Array<{ title: string; links: Array<{ label: string; href: string }> }>) || [];
  const legalLinks = (props.legalLinks as { privacyHref?: string; termsHref?: string; returnHref?: string }) || {};

  return (
    <footer className="w-full bg-gray-950 text-gray-300 pt-16 pb-12 px-4 sm:px-6 lg:px-8 mt-auto border-t border-gray-800">
      <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <span className="text-xl font-black text-white tracking-tight">BYOB Store</span>
          <p className="text-xs text-gray-400 mt-2 max-w-sm leading-relaxed">
            The next-generation multi-tenant platform empowering independent direct-to-consumer creators and storefronts.
          </p>
        </div>

        {columns.map((col, idx) => (
          <div key={idx}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">{col.title}</h4>
            <ul className="space-y-2 text-xs">
              {col.links.map((link, lIdx) => (
                <li key={lIdx}>
                  <Link href={link.href || '/'} className="hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <p>{copyrightText}</p>
        <div className="flex gap-4">
          <Link href={legalLinks.privacyHref || '/privacy'} className="hover:text-gray-400">
            Privacy Policy
          </Link>
          <Link href={legalLinks.termsHref || '/terms'} className="hover:text-gray-400">
            Terms of Service
          </Link>
          <Link href={legalLinks.returnHref || '/returns'} className="hover:text-gray-400">
            Return Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}

/**
 * Universal block dispatcher mapping BlockType to its component.
 */
export function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'announcement-bar':
      return <AnnouncementBarBlock props={block.props} />;
    case 'header-nav':
      return <HeaderNavBlock props={block.props} />;
    case 'hero':
      return <HeroBlock props={block.props} />;
    case 'banner-carousel':
      return <BannerCarouselBlock props={block.props} />;
    case 'category-grid':
      return <CategoryGridBlock props={block.props} />;
    case 'product-grid':
      return <ProductGridBlock props={block.props} />;
    case 'featured-product':
      return <FeaturedProductBlock props={block.props} />;
    case 'promotional-strip':
      return <PromotionalStripBlock props={block.props} />;
    case 'image-with-text':
      return <ImageWithTextBlock props={block.props} />;
    case 'rich-text':
      return <RichTextBlock props={block.props} />;
    case 'benefits-row':
      return <BenefitsRowBlock props={block.props} />;
    case 'newsletter-capture':
      return <NewsletterCaptureBlock props={block.props} />;
    case 'faq-accordion':
      return <FaqAccordionBlock props={block.props} />;
    case 'testimonials':
      return <TestimonialsBlock props={block.props} />;
    case 'footer':
      return <FooterBlock props={block.props} />;
    default:
      return null;
  }
}
