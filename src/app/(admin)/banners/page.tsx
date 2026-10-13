'use client';

import * as React from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Sparkles,
  ExternalLink,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface BannerSlide {
  id: string;
  heading: string | null;
  subheading: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  sortOrder: number;
}

interface Campaign {
  id: string;
  name: string;
  placement: string;
  dayOfWeek: number | null;
  isActive: boolean;
  slides: BannerSlide[];
}

const WEEKDAYS = [
  { value: 'all', label: 'All Days (Default)', dayNum: null },
  { value: '1', label: 'Monday', dayNum: 1 },
  { value: '2', label: 'Tuesday', dayNum: 2 },
  { value: '3', label: 'Wednesday', dayNum: 3 },
  { value: '4', label: 'Thursday', dayNum: 4 },
  { value: '5', label: 'Friday', dayNum: 5 },
  { value: '6', label: 'Saturday', dayNum: 6 },
  { value: '0', label: 'Sunday', dayNum: 0 },
];

export default function BannersPage() {
  const [activeTab, setActiveTab] = React.useState<string>('all');
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([
    {
      id: 'camp_default_01',
      name: 'Evergreen Storewide Hero',
      placement: 'homepage',
      dayOfWeek: null,
      isActive: true,
      slides: [
        {
          id: 'slide_01',
          heading: 'Festive Season Clearance',
          subheading: 'Up to 50% off on all handpicked artisanal items.',
          imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
          ctaLabel: 'Shop Deals',
          ctaHref: '/collection/festive',
          sortOrder: 0,
        },
        {
          id: 'slide_02',
          heading: 'New Autumn Arrivals',
          subheading: 'Handcrafted styles curated just for you.',
          imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc',
          ctaLabel: 'Explore Catalog',
          ctaHref: '/products',
          sortOrder: 1,
        },
      ],
    },
    {
      id: 'camp_mon_01',
      name: 'Motivation Monday Flash Sale',
      placement: 'homepage',
      dayOfWeek: 1,
      isActive: true,
      slides: [
        {
          id: 'slide_mon_01',
          heading: 'Monday Kickstart: Extra 20% Off',
          subheading: 'Valid every Monday on orders over ₹999 with code MONDAY20',
          imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b',
          ctaLabel: 'Redeem Now',
          ctaHref: '/promotions',
          sortOrder: 0,
        },
      ],
    },
    {
      id: 'camp_fri_01',
      name: 'Weekend Fever Starter',
      placement: 'homepage',
      dayOfWeek: 5,
      isActive: true,
      slides: [
        {
          id: 'slide_fri_01',
          heading: 'Friday Weekend Special',
          subheading: 'Get complimentary gift wrapping on all prepaid orders.',
          imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da',
          ctaLabel: 'Shop Weekend Gifts',
          ctaHref: '/collection/weekend',
          sortOrder: 0,
        },
      ],
    },
  ]);

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newCampaignName, setNewCampaignName] = React.useState('');
  const [newDayOfWeek, setNewDayOfWeek] = React.useState<string>('all');

  const [addSlideCampId, setAddSlideCampId] = React.useState<string | null>(null);
  const [slideHeading, setSlideHeading] = React.useState('');
  const [slideSubheading, setSlideSubheading] = React.useState('');
  const [slideImageUrl, setSlideImageUrl] = React.useState('');
  const [slideCtaLabel, setSlideCtaLabel] = React.useState('');
  const [slideCtaHref, setSlideCtaHref] = React.useState('');

  const filteredCampaigns = campaigns.filter((c) => {
    if (activeTab === 'all') return c.dayOfWeek === null;
    return c.dayOfWeek === Number(activeTab);
  });

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;

    const newCamp: Campaign = {
      id: `camp_${Date.now()}`,
      name: newCampaignName,
      placement: 'homepage',
      dayOfWeek: newDayOfWeek === 'all' ? null : Number(newDayOfWeek),
      isActive: true,
      slides: [],
    };

    setCampaigns([...campaigns, newCamp]);
    setNewCampaignName('');
    setIsCreateOpen(false);
  };

  const handleAddSlide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addSlideCampId) return;

    const newSlide: BannerSlide = {
      id: `slide_${Date.now()}`,
      heading: slideHeading || 'Special Promotion',
      subheading: slideSubheading || '',
      imageUrl: slideImageUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
      ctaLabel: slideCtaLabel || 'Shop Now',
      ctaHref: slideCtaHref || '/products',
      sortOrder: 99,
    };

    setCampaigns(
      campaigns.map((c) => {
        if (c.id === addSlideCampId) {
          return {
            ...c,
            slides: [...c.slides, { ...newSlide, sortOrder: c.slides.length }],
          };
        }
        return c;
      })
    );

    setAddSlideCampId(null);
    setSlideHeading('');
    setSlideSubheading('');
    setSlideImageUrl('');
    setSlideCtaLabel('');
    setSlideCtaHref('');
  };

  const handleMoveSlide = (campaignId: string, index: number, direction: 'up' | 'down') => {
    setCampaigns(
      campaigns.map((c) => {
        if (c.id !== campaignId) return c;
        const slides = [...c.slides];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= slides.length) return c;

        const temp = slides[index];
        slides[index] = slides[targetIndex];
        slides[targetIndex] = temp;

        return {
          ...c,
          slides: slides.map((s, idx) => ({ ...s, sortOrder: idx })),
        };
      })
    );
  };

  const handleDeleteSlide = (campaignId: string, slideId: string) => {
    setCampaigns(
      campaigns.map((c) => {
        if (c.id !== campaignId) return c;
        return {
          ...c,
          slides: c.slides.filter((s) => s.id !== slideId),
        };
      })
    );
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setCampaigns(campaigns.filter((c) => c.id !== campaignId));
  };

  const handleToggleActive = (campaignId: string) => {
    setCampaigns(
      campaigns.map((c) => (c.id === campaignId ? { ...c, isActive: !c.isActive } : c))
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            7-Day Banner Scheduler
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure day-specific rotating banner carousels for Monday through Sunday with automatic fallback.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4" />
          <span>New Campaign</span>
        </Button>
      </div>

      {/* Info Notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Automated Fallback Architecture</p>
          <p className="text-xs text-blue-700 mt-0.5">
            When a shopper visits on any day of the week, the system queries banners configured for that day.
            If no day-specific banner is active for today, the platform seamlessly displays your default &apos;All Days&apos; banners.
          </p>
        </div>
      </div>

      {/* Weekday Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-1 bg-gray-100 p-1 rounded-xl">
          {WEEKDAYS.map((w) => (
            <TabsTrigger
              key={w.value}
              value={w.value}
              className="text-xs py-2 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-medium"
            >
              {w.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          {filteredCampaigns.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent className="space-y-3">
                <Calendar className="h-10 w-10 text-gray-400 mx-auto" />
                <p className="font-medium text-gray-900">
                  No campaigns scheduled for {WEEKDAYS.find((w) => w.value === activeTab)?.label}
                </p>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Shoppers visiting today will see the fallback &apos;All Days&apos; banners.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewDayOfWeek(activeTab);
                    setIsCreateOpen(true);
                  }}
                  className="mt-2"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create Campaign for this Day
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {filteredCampaigns.map((camp) => (
                <Card key={camp.id} className="overflow-hidden shadow-sm">
                  <CardHeader className="bg-gray-50/70 border-b border-gray-100 py-3.5 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CardTitle className="text-base font-semibold text-gray-900">
                        {camp.name}
                      </CardTitle>
                      <Badge variant={camp.isActive ? 'success' : 'secondary'}>
                        {camp.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                      <span className="text-xs font-mono text-gray-400">
                        {camp.dayOfWeek !== null
                          ? WEEKDAYS.find((w) => w.dayNum === camp.dayOfWeek)?.label
                          : 'All Days'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(camp.id)}
                      >
                        {camp.isActive ? 'Pause' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setAddSlideCampId(camp.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Slide
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCampaign(camp.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    {camp.slides.length === 0 ? (
                      <div className="py-6 text-center text-xs text-gray-500 italic border border-dashed rounded-lg">
                        No banner slides configured yet. Click &apos;Add Slide&apos; to add media and call-to-actions.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {camp.slides.map((slide, idx) => (
                          <div
                            key={slide.id}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors shadow-2xs"
                          >
                            <div className="flex items-center gap-3.5">
                              {/* Reorder controls */}
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveSlide(camp.id, idx, 'up')}
                                  className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-25"
                                  title="Move up"
                                >
                                  <MoveUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === camp.slides.length - 1}
                                  onClick={() => handleMoveSlide(camp.id, idx, 'down')}
                                  className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-25"
                                  title="Move down"
                                >
                                  <MoveDown className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {/* Thumbnail preview */}
                              <div className="relative h-14 w-24 rounded-md bg-gray-100 overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center">
                                {slide.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={slide.imageUrl}
                                    alt={slide.heading || 'Slide image'}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="h-6 w-6 text-gray-400" />
                                )}
                              </div>

                              {/* Slide text and CTA */}
                              <div>
                                <h4 className="font-semibold text-sm text-gray-900">
                                  {slide.heading || 'Untitled Banner'}
                                </h4>
                                {slide.subheading && (
                                  <p className="text-xs text-gray-500 line-clamp-1 max-w-md">
                                    {slide.subheading}
                                  </p>
                                )}
                                {slide.ctaLabel && (
                                  <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 font-medium">
                                    <span>CTA: {slide.ctaLabel}</span>
                                    <span className="text-gray-400 font-mono text-[10px]">
                                      ({slide.ctaHref})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Slide actions */}
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              <Badge variant="outline" className="text-xs">
                                Pos #{idx + 1}
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteSlide(camp.id, slide.id)}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Tabs>

      {/* Create Campaign Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Create Banner Campaign</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Super Sunday Special"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Target Day of Week
                </label>
                <select
                  value={newDayOfWeek}
                  onChange={(e) => setNewDayOfWeek(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
                  Save Campaign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Slide Modal */}
      {addSlideCampId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add Banner Slide</h3>
            <form onSubmit={handleAddSlide} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Headline Text
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 30% Off Everything"
                  value={slideHeading}
                  onChange={(e) => setSlideHeading(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Subheading
                </label>
                <input
                  type="text"
                  placeholder="e.g. Free shipping on all prepaid orders."
                  value={slideSubheading}
                  onChange={(e) => setSlideSubheading(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/banner-hero.jpg"
                  value={slideImageUrl}
                  onChange={(e) => setSlideImageUrl(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    CTA Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shop Now"
                    value={slideCtaLabel}
                    onChange={(e) => setSlideCtaLabel(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    CTA Destination Link
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /products or /collections/deals"
                    value={slideCtaHref}
                    onChange={(e) => setSlideCtaHref(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddSlideCampId(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
                  Add Slide
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
