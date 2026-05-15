import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileCheck2,
  Flag,
  Heart,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  PackagePlus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Upload,
  X,
  XCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { resolveMediaUrl } from '../utils/media';

const categories = [
  { value: 'books', label: 'Books' },
  { value: 'gadgets', label: 'Gadgets' },
  { value: 'school_supplies', label: 'School supplies' },
  { value: 'uniforms', label: 'Uniforms' },
  { value: 'services', label: 'Services' },
  { value: 'other', label: 'Other' }
];

const marketplaceTabs = [
  { key: 'for_you', label: 'For You', category: '' },
  { key: 'books', label: 'Books', category: 'books' },
  { key: 'gadgets', label: 'Gadgets', category: 'gadgets' },
  { key: 'school_supplies', label: 'Supplies', category: 'school_supplies' },
  { key: 'uniforms', label: 'Uniforms', category: 'uniforms' },
  { key: 'services', label: 'Services', category: 'services' },
  { key: 'saved', label: 'Saved', category: '' },
  { key: 'mine', label: 'My Listings', category: '' }
];

const conditions = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'used', label: 'Used' }
];

const reportReasons = [
  { value: 'suspicious', label: 'Suspicious seller or item' },
  { value: 'wrong_category', label: 'Wrong category' },
  { value: 'sold_unavailable', label: 'Already sold or unavailable' },
  { value: 'unsafe', label: 'Unsafe meetup request' },
  { value: 'spam', label: 'Spam or duplicate' },
  { value: 'other', label: 'Other' }
];

const listingStatuses = [
  { value: '', label: 'Available + reserved' },
  { value: 'active', label: 'Available only' },
  { value: 'reserved', label: 'Reserved only' },
  { value: 'sold', label: 'Sold only' },
  { value: 'all', label: 'All public status' }
];

const ownerStatuses = [
  { value: 'active', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'hidden', label: 'Hidden' }
];

const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' }
];

const meetupSpots = [
  'Main gate',
  'Library entrance',
  'Canteen area',
  'Registrar area',
  'Student lounge',
  'Security office'
];

const statusCopy = {
  not_submitted: {
    label: 'Not submitted',
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    helper: 'Submit your campus ID or COR before using buy and sell.'
  },
  pending: {
    label: 'Under review',
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    helper: 'Your document is waiting for developer approval.'
  },
  approved: {
    label: 'Official student',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    helper: 'Campus marketplace is unlocked.'
  },
  developer: {
    label: 'Developer access',
    tone: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100',
    helper: 'Developer accounts can use Marketplace without student verification.'
  },
  rejected: {
    label: 'Needs resubmission',
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
    helper: 'Upload a clearer or valid campus document.'
  }
};

const formatPrice = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: Number.isInteger(number) ? 0 : 2
  }).format(number);
};

const formatDate = (value) => {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const getId = (entity) => String(entity?._id || entity?.id || entity || '');
const getCategoryLabel = (value) => categories.find(item => item.value === value)?.label || 'Other';
const getConditionLabel = (value) => conditions.find(item => item.value === value)?.label || 'Good';
const getListingStatusLabel = (value) => ownerStatuses.find(item => item.value === value)?.label || 'Available';

const listingStatusTone = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200',
  reserved: 'bg-amber-100 text-amber-700 dark:bg-amber-950/35 dark:text-amber-200',
  sold: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  hidden: 'bg-rose-100 text-rose-700 dark:bg-rose-950/35 dark:text-rose-200'
};

function StatusPill({ status }) {
  const copy = statusCopy[status] || statusCopy.not_submitted;
  const Icon = status === 'approved' || status === 'developer' ? BadgeCheck : status === 'pending' ? Clock3 : status === 'rejected' ? XCircle : ShieldCheck;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-normal ${copy.tone}`}>
      <Icon size={14} />
      {copy.label}
    </span>
  );
}

function DocumentPreview({ submission, compact = false }) {
  const url = resolveMediaUrl(submission?.documentUrl);
  if (!url) return null;
  const isPdf = submission?.mimeType === 'application/pdf' || url.toLowerCase().includes('.pdf');

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
    >
      {isPdf ? (
        <div className={`flex items-center justify-center p-5 text-center ${compact ? 'h-32' : 'h-72'}`}>
          <div>
            <FileCheck2 className="mx-auto text-[#0b57d0]" size={compact ? 28 : 42} />
            <p className="mt-3 text-sm font-black text-slate-950 dark:text-white">Open COR PDF</p>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{submission.originalName || 'Verification document'}</p>
          </div>
        </div>
      ) : (
        <img
          src={url}
          alt="Campus verification document"
          className={`${compact ? 'h-32' : 'h-72'} w-full object-cover transition duration-200 group-hover:scale-[1.02]`}
        />
      )}
    </a>
  );
}

function SellerTrustBadge({ seller, compact = false }) {
  const developer = Boolean(seller?.isDeveloper);
  const verified = developer || seller?.studentVerificationStatus === 'approved';
  const successfulDeals = Number(seller?.marketplaceDeals || seller?.successfulDeals || seller?.soldCount || 0);
  const rating = Number(seller?.marketplaceRating || seller?.sellerRating || 0);
  const responseScore = Number(seller?.responseScore || seller?.sellerResponseScore || 0);
  const trustPills = [
    developer ? 'Developer' : verified ? 'Official student' : 'Campus profile',
    successfulDeals > 0 ? `${successfulDeals} deal${successfulDeals === 1 ? '' : 's'}` : 'Campus meetup',
    rating > 0 ? `${rating.toFixed(1)} seller rating` : responseScore > 0 ? 'Responds fast' : 'In-app chat'
  ];
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950'}`}>
      <img
        src={resolveMediaUrl(seller?.avatar) || '/syncrova-app-logo.png'}
        alt=""
        className={`${compact ? 'h-8 w-8' : 'h-11 w-11'} rounded-full object-cover ring-2 ring-white dark:ring-slate-900`}
      />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1 truncate text-sm font-black text-slate-950 dark:text-white">
          <span className="truncate">{seller?.name || 'Student seller'}</span>
          {verified && <BadgeCheck size={14} className="shrink-0 fill-[#0b57d0] text-white dark:fill-sky-400" />}
        </p>
        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{seller?.campus || 'Campus marketplace'}</p>
        {!compact && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {trustPills.map(pill => (
              <span key={pill} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                {pill}
              </span>
            ))}
          </div>
        )}
      </div>
      {verified && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black uppercase text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200">
          <BadgeCheck size={12} />
          {developer ? 'Developer' : 'Verified'}
        </span>
      )}
    </div>
  );
}

function ListingGallery({ listing, onOpen }) {
  const photos = listing.photos || [];
  const first = resolveMediaUrl(photos[0]?.url);
  const extraCount = Math.max(0, photos.length - 1);
  return (
    <button type="button" onClick={onOpen} className="group relative block h-full min-h-[132px] w-full overflow-hidden bg-slate-100 text-left dark:bg-slate-950 sm:aspect-[4/3] sm:min-h-0">
      {first ? (
        <img src={first} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 via-white to-emerald-100 text-slate-400 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          <Package size={42} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-white/92 px-2 py-0.5 text-[9px] font-black uppercase text-slate-700 backdrop-blur sm:px-2.5 sm:py-1 sm:text-[11px]">
            {getCategoryLabel(listing.category)}
          </span>
          {extraCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur sm:px-2.5 sm:py-1 sm:text-[11px]">
              <Camera size={12} />
              +{extraCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ListingCard({ listing, user, canBuySell, onOpen, onSave, onStatus }) {
  const sellerId = getId(listing.seller);
  const isMine = sellerId === getId(user);
  const isUnavailable = ['reserved', 'sold', 'hidden'].includes(listing.status);
  return (
    <article className="grid grid-cols-[38%_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900/70 sm:block">
      <ListingGallery listing={listing} onOpen={() => onOpen(listing)} />
      <div className="min-w-0 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => onOpen(listing)} className="min-w-0 text-left">
            <p className="truncate text-base font-black text-slate-950 dark:text-white sm:text-lg">{listing.title}</p>
            <p className="mt-1 text-lg font-black text-[#0b57d0] dark:text-sky-300 sm:text-xl">{formatPrice(listing.price)}</p>
          </button>
          <button
            type="button"
            onClick={() => onSave(listing)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition sm:h-10 sm:w-10 ${
              listing.isSaved
                ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/25 dark:bg-rose-950/30 dark:text-rose-200'
                : 'border-slate-200 bg-white text-slate-500 hover:text-rose-500 dark:border-slate-800 dark:bg-slate-950'
            }`}
            aria-label={listing.isSaved ? 'Unsave listing' : 'Save listing'}
          >
            <Heart size={17} fill={listing.isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <p className="mt-2 hidden min-h-[2.5rem] text-sm font-semibold text-slate-600 dark:text-slate-300 sm:line-clamp-2">{listing.description || 'No description added.'}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 sm:mt-3 sm:gap-2 sm:text-[11px]">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{getConditionLabel(listing.condition)}</span>
          {listing.meetupSpot && <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{listing.meetupSpot}</span>}
          {listing.status !== 'active' && <span className={`rounded-full px-2.5 py-1 ${listingStatusTone[listing.status] || listingStatusTone.reserved}`}>{getListingStatusLabel(listing.status)}</span>}
        </div>
        <div className="mt-3 hidden sm:mt-4 sm:block">
          <SellerTrustBadge seller={listing.seller} compact />
        </div>
        <div className="mt-3 hidden gap-2 sm:mt-4 sm:flex">
          {isMine ? (
            <>
              <button type="button" onClick={() => onStatus(getId(listing), listing.status === 'reserved' ? 'active' : 'reserved')} className="h-10 flex-1 rounded-xl bg-amber-50 px-3 text-sm font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">{listing.status === 'reserved' ? 'Available' : 'Reserve'}</button>
              <button type="button" onClick={() => onStatus(getId(listing), 'sold')} className="h-10 flex-1 rounded-xl bg-emerald-50 px-3 text-sm font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">Sold</button>
            </>
          ) : (
            <button
              type="button"
              disabled={!canBuySell || isUnavailable}
              onClick={() => onOpen(listing)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0b57d0] px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye size={17} />
              {isUnavailable ? getListingStatusLabel(listing.status) : 'View details'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function MarketplaceEmptyState({ canBuySell, activeTab }) {
  const isSaved = activeTab === 'saved';
  const isMine = activeTab === 'mine';
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-emerald-50 text-[#0b57d0] dark:from-blue-950/30 dark:to-emerald-950/30 dark:text-sky-200">
        {isSaved ? <Heart size={32} /> : isMine ? <PackagePlus size={32} /> : <ShoppingBag size={32} />}
      </div>
      <p className="mt-4 text-xl font-black text-slate-950 dark:text-white">
        {isSaved ? 'No saved listings yet' : isMine ? 'You have no listings yet' : 'No listings in this section yet'}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
        {canBuySell
          ? 'Campus listings will appear here as verified students start posting items.'
          : 'Submit an official campus ID or COR first to unlock marketplace activity.'}
      </p>
    </div>
  );
}

function VerificationTimeline({ status }) {
  if (status === 'developer') {
    return (
      <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs font-black uppercase text-cyan-800 dark:border-cyan-500/25 dark:bg-cyan-950/25 dark:text-cyan-100">
        <div className="flex items-center gap-2">
          <BadgeCheck size={15} />
          Developer bypass active
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'upload', label: 'Submit ID/COR', complete: ['pending', 'approved', 'rejected'].includes(status) },
    { key: 'review', label: 'Developer review', complete: ['approved', 'rejected'].includes(status), active: status === 'pending' },
    { key: 'unlock', label: 'Marketplace unlock', complete: status === 'approved' }
  ];
  return (
    <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
      {steps.map(step => (
        <div key={step.key} className={`rounded-xl border p-2 sm:p-3 ${
          step.complete
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-950/25 dark:text-emerald-100'
            : step.active
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-950/25 dark:text-amber-100'
              : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
        }`}>
          <div className="flex min-w-0 flex-col items-center gap-1 text-center sm:flex-row sm:text-left">
            {step.complete ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
            <span className="text-[9px] font-black uppercase leading-tight sm:text-xs">{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListingDetailModal({ listing, user, canBuySell, onClose, onSave, onReport, onMessage, onStatus }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('suspicious');
  const [reportNote, setReportNote] = useState('');
  if (!listing) return null;

  const photos = listing.photos || [];
  const activePhoto = resolveMediaUrl(photos[photoIndex]?.url);
  const isMine = getId(listing.seller) === getId(user);
  const isUnavailable = ['reserved', 'sold', 'hidden'].includes(listing.status);
  const nextPhoto = () => setPhotoIndex(prev => (photos.length ? (prev + 1) % photos.length : 0));
  const prevPhoto = () => setPhotoIndex(prev => (photos.length ? (prev - 1 + photos.length) % photos.length : 0));

  const submitReport = () => {
    onReport(listing, { reason: reportReason, note: reportNote });
    setReportOpen(false);
    setReportNote('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[#0b57d0] dark:text-sky-300">Listing details</p>
            <h2 className="truncate text-xl font-black text-slate-950 dark:text-white">{listing.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200" aria-label="Close listing details">
            <X size={20} />
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-65px)] overflow-y-auto lg:grid-cols-[minmax(0,1.25fr)_420px]">
          <div className="bg-slate-950 p-3">
            <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-slate-900">
              {activePhoto ? (
                <img src={activePhoto} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center text-slate-400">
                  <Package size={56} />
                  <p className="mt-3 text-sm font-black">No photo uploaded</p>
                </div>
              )}
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={prevPhoto} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900">
                    <ChevronLeft size={20} />
                  </button>
                  <button type="button" onClick={nextPhoto} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900">
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, index) => (
                  <button key={`${photo.url}-${index}`} type="button" onClick={() => setPhotoIndex(index)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${index === photoIndex ? 'border-sky-300' : 'border-transparent'}`}>
                    <img src={resolveMediaUrl(photo.url)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4 p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-3xl font-black text-slate-950 dark:text-white">{formatPrice(listing.price)}</p>
                  <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{getConditionLabel(listing.condition)} - {getCategoryLabel(listing.category)}</p>
                  <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${listingStatusTone[listing.status] || listingStatusTone.active}`}>
                    {getListingStatusLabel(listing.status)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSave(listing)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                    listing.isSaved
                      ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/25 dark:bg-rose-950/30 dark:text-rose-200'
                      : 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <Heart size={19} fill={listing.isSaved ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">{listing.description || 'No description added.'}</p>
            </div>

            <SellerTrustBadge seller={listing.seller} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <MapPin className="text-[#0b57d0]" size={18} />
                <p className="mt-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">Meetup</p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{listing.meetupSpot || 'Inside campus'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                <Star className="text-amber-500" size={18} />
                <p className="mt-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">Posted</p>
                <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">{formatDate(listing.createdAt)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-950/20">
              <p className="text-sm font-black text-amber-900 dark:text-amber-100">Campus safety</p>
              <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-amber-800 dark:text-amber-100/80">
                <li>Meet only inside campus or a visible public area.</li>
                <li>Inspect the item before paying.</li>
                <li>Report suspicious pricing, pressure, or unsafe meetup requests.</li>
              </ul>
            </div>

            {reportOpen && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/25 dark:bg-rose-950/20">
                <p className="text-sm font-black text-rose-900 dark:text-rose-100">Report listing</p>
                <select value={reportReason} onChange={event => setReportReason(event.target.value)} className="mt-3 h-11 w-full rounded-xl border border-rose-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none dark:border-rose-500/25 dark:bg-slate-950 dark:text-white">
                  {reportReasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <textarea value={reportNote} onChange={event => setReportNote(event.target.value)} rows={3} placeholder="Optional details" className="mt-2 w-full resize-none rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none dark:border-rose-500/25 dark:bg-slate-950 dark:text-white" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setReportOpen(false)} className="h-10 rounded-xl bg-white text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">Cancel</button>
                  <button type="button" onClick={submitReport} className="h-10 rounded-xl bg-rose-600 text-sm font-black text-white">Submit report</button>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              {isMine ? (
                <div className="grid grid-cols-2 gap-2">
                  {ownerStatuses.map(status => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => onStatus(getId(listing), status.value)}
                      className={`h-11 rounded-xl text-sm font-black ${
                        listing.status === status.value
                          ? 'bg-[#0b57d0] text-white'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button type="button" disabled={!canBuySell || isUnavailable} onClick={() => onMessage(listing)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0b57d0] text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
                  <MessageCircle size={18} />
                  {isUnavailable ? `${getListingStatusLabel(listing.status)} item` : 'Message seller'}
                </button>
              )}
              {!isMine && (
                <button type="button" onClick={() => setReportOpen(prev => !prev)} disabled={listing.hasReported} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-black text-slate-700 disabled:opacity-60 dark:border-slate-800 dark:text-slate-200">
                  <Flag size={17} />
                  {listing.hasReported ? 'Already reported' : 'Report listing'}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SubmissionModal({ submission, onClose }) {
  if (!submission) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-[#0b57d0] dark:text-sky-300">Verification document</p>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">{submission.user?.name || 'Student'}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <X size={20} />
          </button>
        </div>
        <DocumentPreview submission={submission} />
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [listings, setListings] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortFilter, setSortFilter] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [activeTab, setActiveTab] = useState('for_you');
  const [verificationType, setVerificationType] = useState('campus_id');
  const [verificationFile, setVerificationFile] = useState(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [creatingListing, setCreatingListing] = useState(false);
  const [listingPhotos, setListingPhotos] = useState([]);
  const [listingForm, setListingForm] = useState({
    title: '',
    price: '',
    category: 'books',
    condition: 'good',
    meetupSpot: '',
    description: ''
  });
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewStatus, setReviewStatus] = useState('pending');
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewAll, setReviewAll] = useState([]);
  const [reportedListings, setReportedListings] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [queueLoading, setQueueLoading] = useState(false);
  const [reviewReasons, setReviewReasons] = useState({});

  const isDeveloper = Boolean(statusData?.user?.isDeveloper || user?.isDeveloper);
  const verification = statusData?.verification || { status: user?.studentVerificationStatus || 'not_submitted' };
  const currentStatus = isDeveloper ? 'developer' : statusData?.user?.studentVerificationStatus || verification.status || 'not_submitted';
  const canBuySell = Boolean(statusData?.canBuySell || isDeveloper);
  const selectedStatusCopy = statusCopy[currentStatus] || statusCopy.not_submitted;

  const listingStats = useMemo(() => ({
    active: listings.filter(item => item.status === 'active').length,
    saved: listings.filter(item => item.isSaved).length,
    mine: myListings.length,
    photos: listings.reduce((sum, item) => sum + (item.photos?.length || 0), 0)
  }), [listings, myListings]);

  const myListingStats = useMemo(() => ({
    active: myListings.filter(item => item.status === 'active').length,
    reserved: myListings.filter(item => item.status === 'reserved').length,
    sold: myListings.filter(item => item.status === 'sold').length,
    hidden: myListings.filter(item => item.status === 'hidden').length,
    saved: listings.filter(item => item.isSaved).length
  }), [listings, myListings]);

  const reviewStats = useMemo(() => ({
    pending: reviewAll.filter(item => item.status === 'pending').length,
    approved: reviewAll.filter(item => item.status === 'approved').length,
    rejected: reviewAll.filter(item => item.status === 'rejected').length
  }), [reviewAll]);

  const visibleListings = useMemo(() => {
    const source = activeTab === 'mine' ? myListings : listings;
    const raw = activeTab === 'saved' ? listings.filter(item => item.isSaved) : source;
    const tabCategory = marketplaceTabs.find(tab => tab.key === activeTab)?.category;
    const normalizedQuery = query.trim().toLowerCase();
    const min = Number(minPrice);
    const max = Number(maxPrice);
    return raw.filter(item => {
      if (tabCategory && item.category !== tabCategory) return false;
      if (!tabCategory && categoryFilter && item.category !== categoryFilter) return false;
      if (statusFilter && statusFilter !== 'all') {
        const publicDefault = statusFilter === '' && ['active', 'reserved'].includes(item.status);
        if (!publicDefault && item.status !== statusFilter) return false;
      }
      if (Number.isFinite(min) && min >= 0 && Number(item.price || 0) < min) return false;
      if (Number.isFinite(max) && max >= 0 && Number(item.price || 0) > max) return false;
      if (!normalizedQuery) return true;
      return [item.title, item.description, item.meetupSpot, item.campus, getCategoryLabel(item.category)]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [activeTab, categoryFilter, listings, maxPrice, minPrice, myListings, query, statusFilter]);

  const updateListingInState = useCallback((updated) => {
    if (!updated) return;
    const updatedId = getId(updated);
    setListings(prev => prev.map(item => getId(item) === updatedId ? updated : item));
    setMyListings(prev => prev.map(item => getId(item) === updatedId ? updated : item));
    setReportedListings(prev => prev.map(item => getId(item) === updatedId ? { ...item, ...updated, reports: item.reports } : item));
    setSelectedListing(prev => (getId(prev) === updatedId ? updated : prev));
  }, []);

  const loadMarketplace = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      if (sortFilter) params.sort = sortFilter;
      if (minPrice !== '') params.minPrice = minPrice;
      if (maxPrice !== '') params.maxPrice = maxPrice;

      const [statusRes, listingsRes, mineRes] = await Promise.all([
        api.get('/marketplace/status'),
        api.get('/marketplace/listings', { params }),
        api.get('/marketplace/listings/mine').catch(() => ({ data: { listings: [] } }))
      ]);

      setStatusData(statusRes.data);
      setListings(listingsRes.data?.listings || []);
      setMyListings(mineRes.data?.listings || []);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not load marketplace');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [categoryFilter, maxPrice, minPrice, query, sortFilter, statusFilter]);

  const loadReviewQueue = useCallback(async () => {
    if (!isDeveloper) return;
    setQueueLoading(true);
    try {
      const [queueRes, allRes] = await Promise.all([
        api.get('/marketplace/verification/queue', { params: { status: reviewStatus } }),
        api.get('/marketplace/verification/queue')
      ]);
      setReviewQueue(queueRes.data?.submissions || []);
      setReviewAll(allRes.data?.submissions || []);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not load review queue');
    } finally {
      setQueueLoading(false);
    }
  }, [isDeveloper, reviewStatus]);

  const loadReportedListings = useCallback(async () => {
    if (!isDeveloper) return;
    setReportsLoading(true);
    try {
      const params = {};
      if (reportStatusFilter) params.status = reportStatusFilter;
      const res = await api.get('/marketplace/listings/reports', { params });
      setReportedListings(res.data?.listings || []);
    } catch (err) {
      console.warn('Could not load reported marketplace listings', err.response?.data?.msg || err.message);
    } finally {
      setReportsLoading(false);
    }
  }, [isDeveloper, reportStatusFilter]);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  useEffect(() => {
    loadReviewQueue();
  }, [loadReviewQueue]);

  useEffect(() => {
    loadReportedListings();
  }, [loadReportedListings]);

  const submitVerification = async (event) => {
    event.preventDefault();
    if (!verificationFile) {
      toast.error('Choose your campus ID or COR first');
      return;
    }

    setSubmittingVerification(true);
    try {
      const form = new FormData();
      form.append('documentType', verificationType);
      form.append('document', verificationFile);
      await api.post('/marketplace/verification', form);
      toast.success('Verification submitted for review');
      setVerificationFile(null);
      await loadMarketplace({ silent: true });
      if (isDeveloper) await loadReviewQueue();
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Verification upload failed');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const createListing = async (event) => {
    event.preventDefault();
    if (!canBuySell) {
      toast.error('Campus verification is required first');
      return;
    }
    if (!listingForm.meetupSpot.trim()) {
      toast.error('Choose a safe campus meetup spot');
      setCreateStep(3);
      return;
    }

    setCreatingListing(true);
    try {
      const form = new FormData();
      Object.entries(listingForm).forEach(([key, value]) => form.append(key, value));
      listingPhotos.slice(0, 5).forEach(file => form.append('photos', file));
      await api.post('/marketplace/listings', form);
      toast.success('Listing posted');
      setListingForm({ title: '', price: '', category: 'books', condition: 'good', meetupSpot: '', description: '' });
      setListingPhotos([]);
      setCreateStep(1);
      await loadMarketplace({ silent: true });
      window.dispatchEvent(new Event('marketplaceUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not post listing');
    } finally {
      setCreatingListing(false);
    }
  };

  const nextCreateStep = () => {
    if (createStep === 1 && (!listingForm.title.trim() || !listingForm.price)) {
      toast.error('Add item name and price first');
      return;
    }
    if (createStep === 2 && listingPhotos.length === 0) {
      toast.error('Add at least one photo for a professional listing');
      return;
    }
    setCreateStep(prev => Math.min(3, prev + 1));
  };

  const updateListingStatus = async (listingId, status) => {
    try {
      const res = await api.put(`/marketplace/listings/${listingId}/status`, { status });
      updateListingInState(res.data?.listing);
      const statusLabel = getListingStatusLabel(status).toLowerCase();
      toast.success(status === 'active' ? 'Listing marked available' : `Listing marked ${statusLabel}`);
      window.dispatchEvent(new Event('marketplaceUpdated'));
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not update listing');
    }
  };

  const toggleSaveListing = async (listing) => {
    try {
      const res = await api.put(`/marketplace/listings/${getId(listing)}/save`);
      updateListingInState(res.data?.listing);
      toast.success(res.data?.saved ? 'Saved to watchlist' : 'Removed from watchlist');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not save listing');
    }
  };

  const reportListing = async (listing, payload) => {
    try {
      const res = await api.post(`/marketplace/listings/${getId(listing)}/report`, payload);
      updateListingInState(res.data?.listing);
      toast.success('Report submitted');
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Could not report listing');
    }
  };

  const reviewSubmission = async (submission, action) => {
    const reason = reviewReasons[getId(submission)] || '';
    if (action === 'reject' && !reason.trim()) {
      toast.error('Add a short reason before rejecting');
      return;
    }

    try {
      await api.put(`/marketplace/verification/${getId(submission)}/review`, { action, rejectionReason: reason });
      toast.success(action === 'approve' ? 'Student verified' : 'Submission rejected');
      await Promise.all([loadMarketplace({ silent: true }), loadReviewQueue()]);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Review failed');
    }
  };

  const applySearch = (event) => {
    event.preventDefault();
    loadMarketplace({ silent: true });
  };

  const messageSeller = (listing) => {
    const draft = `Hi, available pa po ba yung ${listing.title}? Interested ako. Price: ${formatPrice(listing.price)}.`;
    navigate(`/messages?user=${getId(listing.seller)}&draft=${encodeURIComponent(draft)}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto animate-spin text-[#0b57d0]" size={34} />
          <p className="mt-3 text-sm font-black text-slate-600 dark:text-slate-300">Loading Student Marketplace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page marketplace-page mx-auto flex w-full max-w-7xl flex-col gap-3 px-0 py-1 sm:gap-5 sm:px-6 sm:py-5 lg:px-8">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 p-3 sm:gap-5 sm:p-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0b57d0] to-emerald-400 text-white shadow-lg shadow-blue-500/20 sm:h-14 sm:w-14">
                <Store size={24} />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-[#0b57d0] dark:text-sky-300">Campus-only marketplace</p>
                <h1 className="text-2xl font-black tracking-normal text-slate-950 dark:text-white sm:text-4xl">Student Marketplace</h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300 sm:mt-4 sm:text-base sm:leading-7">
              Buy and sell books, gadgets, uniforms, and school supplies with verified campus students only.
            </p>
            <div className="mt-3 grid grid-cols-4 gap-1.5 sm:mt-5 sm:gap-3">
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950 sm:p-3">
                <p className="text-lg font-black text-slate-950 dark:text-white sm:text-2xl">{listingStats.active}</p>
                <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 sm:text-xs">Active</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950 sm:p-3">
                <p className="text-lg font-black text-slate-950 dark:text-white sm:text-2xl">{listingStats.saved}</p>
                <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 sm:text-xs">Saved</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950 sm:p-3">
                <p className="text-lg font-black text-slate-950 dark:text-white sm:text-2xl">{listingStats.mine}</p>
                <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 sm:text-xs">Mine</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-950 sm:p-3">
                <p className="text-lg font-black text-slate-950 dark:text-white sm:text-2xl">{listingStats.photos}</p>
                <p className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 sm:text-xs">Photos</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-950 dark:text-white sm:text-sm">Official student access</p>
              <StatusPill status={currentStatus} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:mt-3 sm:text-sm">{selectedStatusCopy.helper}</p>
            <VerificationTimeline status={currentStatus} />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="order-2 space-y-3 sm:space-y-5 xl:order-1">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#0b57d0] dark:text-sky-300" size={24} />
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-white">Campus verification</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Campus ID or COR review</p>
              </div>
            </div>

            {currentStatus === 'approved' || currentStatus === 'developer' ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-950/25 dark:text-emerald-100">
                <BadgeCheck size={30} />
                <p className="mt-3 text-lg font-black">{currentStatus === 'developer' ? 'Developer marketplace access' : 'Official campus student'}</p>
                <p className="mt-1 text-sm font-semibold">
                  {currentStatus === 'developer'
                    ? 'You can post listings, save items, and message sellers without student document review.'
                    : 'You can post listings, save items, and message sellers.'}
                </p>
                {currentStatus !== 'developer' && (
                  <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-black uppercase dark:bg-slate-950/60">Verified: {formatDate(statusData?.user?.studentVerifiedAt)}</p>
                )}
              </div>
            ) : (
              <form onSubmit={submitVerification} className="mt-5 space-y-4">
                {currentStatus === 'pending' && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 dark:border-amber-500/25 dark:bg-amber-950/25 dark:text-amber-100">Your latest submission is under review. You may upload a better copy if needed.</div>}
                {currentStatus === 'rejected' && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-500/25 dark:bg-rose-950/25 dark:text-rose-100">
                    <p className="font-black">Resubmission needed</p>
                    <p className="mt-1">{verification.rejectionReason || 'Please submit a clearer campus ID or COR.'}</p>
                  </div>
                )}
                <label className="block">
                  <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">Document type</span>
                  <select value={verificationType} onChange={event => setVerificationType(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="campus_id">Official campus ID</option>
                    <option value="cor">Certificate of registration</option>
                  </select>
                </label>
                <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-700 dark:bg-slate-950">
                  <Upload className="mx-auto text-[#0b57d0] dark:text-sky-300" size={28} />
                  <span className="mt-2 block text-sm font-black text-slate-950 dark:text-white">{verificationFile?.name || 'Upload image or PDF'}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Max 10MB. Only developer can review this file.</span>
                  <input type="file" accept="image/*,application/pdf" onChange={event => setVerificationFile(event.target.files?.[0] || null)} className="sr-only" />
                </label>
                <button type="submit" disabled={submittingVerification} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b57d0] px-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {submittingVerification ? <Loader2 className="animate-spin" size={18} /> : <FileCheck2 size={18} />}
                  Submit for review
                </button>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="text-amber-500" size={24} />
              <div>
                <h2 className="text-xl font-black text-slate-950 dark:text-white">Campus safety layer</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Professional marketplace rules</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300 sm:space-y-3">
              {['Meet only inside campus or visible public spaces.', 'Use message history before meetup for clear proof.', 'Inspect the item before paying.', 'Report suspicious sellers, duplicates, or unsafe requests.'].map(item => (
                <div key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {canBuySell && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-[#0b57d0] dark:text-sky-300">My marketplace</p>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">Seller dashboard</h2>
                </div>
                <button type="button" onClick={() => setActiveTab('mine')} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#0b57d0] dark:bg-blue-950/35 dark:text-sky-200">
                  Manage
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Active', myListingStats.active, 'active'],
                  ['Reserved', myListingStats.reserved, 'reserved'],
                  ['Sold', myListingStats.sold, 'sold'],
                  ['Hidden', myListingStats.hidden, 'hidden']
                ].map(([label, count, status]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setActiveTab('mine');
                      setStatusFilter(status);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left dark:border-slate-800 dark:bg-slate-950"
                  >
                    <p className="text-2xl font-black text-slate-950 dark:text-white">{count}</p>
                    <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('saved');
                  setStatusFilter('');
                }}
                className="mt-3 flex h-11 w-full items-center justify-between rounded-xl bg-rose-50 px-4 text-sm font-black text-rose-700 dark:bg-rose-950/30 dark:text-rose-200"
              >
                Saved items
                <span>{myListingStats.saved}</span>
              </button>
            </section>
          )}

          {canBuySell && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
              <div className="flex items-center gap-3">
                <PackagePlus className="text-emerald-600 dark:text-emerald-300" size={24} />
                <div>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">Create listing</h2>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Step {createStep} of 3</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {['Details', 'Photos', 'Meetup'].map((step, index) => (
                  <div key={step} className={`rounded-xl px-3 py-2 text-center text-xs font-black uppercase ${createStep >= index + 1 ? 'bg-[#0b57d0] text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{step}</div>
                ))}
              </div>

              <form onSubmit={createListing} className="mt-5 space-y-3">
                {createStep === 1 && (
                  <>
                    <input value={listingForm.title} onChange={event => setListingForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Item name" maxLength={90} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    <div className="grid grid-cols-2 gap-3">
                      <input value={listingForm.price} onChange={event => setListingForm(prev => ({ ...prev, price: event.target.value }))} placeholder="Price" inputMode="decimal" className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                      <select value={listingForm.condition} onChange={event => setListingForm(prev => ({ ...prev, condition: event.target.value }))} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {conditions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </div>
                    <select value={listingForm.category} onChange={event => setListingForm(prev => ({ ...prev, category: event.target.value }))} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                      {categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {categories.slice(0, 5).map(item => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setListingForm(prev => ({ ...prev, category: item.value }))}
                          className={`h-9 shrink-0 rounded-xl px-3 text-xs font-black ${
                            listingForm.category === item.value
                              ? 'bg-[#0b57d0] text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {createStep === 2 && (
                  <>
                    <label className="flex min-h-40 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-950">
                      <span>
                        <ImageIcon className="mx-auto text-[#0b57d0]" size={32} />
                        <span className="mt-3 block text-sm font-black text-slate-950 dark:text-white">{listingPhotos.length ? `${listingPhotos.length} photo selected` : 'Add clear item photos'}</span>
                        <span className="mt-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Use real photos. Max 5 images.</span>
                      </span>
                      <input type="file" accept="image/*" multiple onChange={event => setListingPhotos(Array.from(event.target.files || []).slice(0, 5))} className="sr-only" />
                    </label>
                    {listingPhotos.length > 0 && (
                      <div className="grid grid-cols-5 gap-2">
                        {listingPhotos.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                            <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" onLoad={event => URL.revokeObjectURL(event.currentTarget.src)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {createStep === 3 && (
                  <>
                    <input value={listingForm.meetupSpot} onChange={event => setListingForm(prev => ({ ...prev, meetupSpot: event.target.value }))} placeholder="Meetup spot inside campus" maxLength={120} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    <div className="grid grid-cols-2 gap-2">
                      {meetupSpots.map(spot => (
                        <button
                          key={spot}
                          type="button"
                          onClick={() => setListingForm(prev => ({ ...prev, meetupSpot: spot }))}
                          className={`min-h-10 rounded-xl px-3 py-2 text-left text-xs font-black ${
                            listingForm.meetupSpot === spot
                              ? 'bg-[#0b57d0] text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {spot}
                        </button>
                      ))}
                    </div>
                    <textarea value={listingForm.description} onChange={event => setListingForm(prev => ({ ...prev, description: event.target.value }))} placeholder="Short description" maxLength={1200} rows={4} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    <div className="rounded-xl bg-blue-50 p-3 text-xs font-bold leading-5 text-[#0b57d0] dark:bg-blue-950/30 dark:text-sky-200">
                      Buyers will see your verified seller badge, campus, item photos, and meetup spot.
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCreateStep(prev => Math.max(1, prev - 1))} disabled={createStep === 1} className="h-11 rounded-xl border border-slate-200 text-sm font-black text-slate-700 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200">Back</button>
                  {createStep < 3 ? (
                    <button type="button" onClick={nextCreateStep} className="h-11 rounded-xl bg-slate-950 text-sm font-black text-white dark:bg-white dark:text-slate-950">Next</button>
                  ) : (
                    <button type="submit" disabled={creatingListing} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0b57d0] text-sm font-black text-white disabled:opacity-60">
                      {creatingListing ? <Loader2 className="animate-spin" size={18} /> : <ShoppingBag size={18} />}
                      Post
                    </button>
                  )}
                </div>
              </form>
            </section>
          )}
        </div>

        <div className="order-1 space-y-3 sm:space-y-5 xl:order-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-[#0b57d0] dark:text-sky-300">Buy and sell</p>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">Campus listings</h2>
              </div>
              <form onSubmit={applySearch} className="grid w-full grid-cols-2 gap-2">
                <div className="relative col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search items" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </div>
                <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="">All categories</option>
                  {categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {listingStatuses.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                  {activeTab === 'mine' && <option value="hidden">Hidden only</option>}
                </select>
                <select value={sortFilter} onChange={event => setSortFilter(event.target.value)} className="col-span-2 h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {sortOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <input value={minPrice} onChange={event => setMinPrice(event.target.value)} placeholder="Min PHP" inputMode="decimal" className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <input value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="Max PHP" inputMode="decimal" className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                <button type="submit" className="col-span-2 flex h-11 items-center justify-center rounded-xl bg-blue-50 px-4 text-sm font-black text-[#0b57d0] dark:bg-blue-950/35 dark:text-sky-200">Search</button>
              </form>
            </div>

            <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {marketplaceTabs.map(tab => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.key);
                      if (tab.category) setCategoryFilter('');
                      if (tab.key !== 'mine' && statusFilter === 'hidden') setStatusFilter('');
                    }}
                    className={`h-9 shrink-0 rounded-xl px-3 text-xs font-black transition sm:h-auto sm:py-2 sm:text-sm ${active ? 'bg-[#0b57d0] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {!canBuySell && (
              <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 sm:mt-5 sm:block sm:p-5">
                <ShieldCheck className="shrink-0 text-slate-400" size={21} />
                <div className="min-w-0">
                  <p className="text-sm font-black leading-tight text-slate-950 dark:text-white sm:mt-3 sm:text-lg">Marketplace locked</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold leading-4 text-slate-500 dark:text-slate-400 sm:mt-1 sm:line-clamp-2 sm:text-sm sm:leading-5">Submit an official campus ID or COR. Once approved, posting and seller messaging are enabled.</p>
                </div>
              </div>
            )}

            {visibleListings.length ? (
              <div className="mt-5 grid gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {visibleListings.map(listing => (
                  <ListingCard
                    key={getId(listing)}
                    listing={listing}
                    user={user}
                    canBuySell={canBuySell}
                    onOpen={setSelectedListing}
                    onSave={toggleSaveListing}
                    onStatus={updateListingStatus}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <MarketplaceEmptyState canBuySell={canBuySell} activeTab={activeTab} />
              </div>
            )}
          </section>

          {isDeveloper && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-amber-500">Developer review</p>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">Student verification dashboard</h2>
                </div>
                <button type="button" onClick={loadReviewQueue} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <RefreshCw size={17} className={queueLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  ['pending', 'Pending', reviewStats.pending],
                  ['approved', 'Approved', reviewStats.approved],
                  ['rejected', 'Rejected', reviewStats.rejected]
                ].map(([key, label, count]) => (
                  <button key={key} type="button" onClick={() => setReviewStatus(key)} className={`rounded-xl border p-3 text-left ${reviewStatus === key ? 'border-[#0b57d0] bg-blue-50 dark:border-sky-400/40 dark:bg-blue-950/25' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'}`}>
                    <p className="text-2xl font-black text-slate-950 dark:text-white">{count}</p>
                    <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400">{label}</p>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {reviewQueue.map(submission => {
                  const submissionId = getId(submission);
                  return (
                    <article key={submissionId} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-slate-950 dark:text-white">{submission.user?.name || 'Student'}</p>
                          <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{submission.user?.email}</p>
                        </div>
                        <StatusPill status={submission.status} />
                      </div>
                      <button type="button" onClick={() => setSelectedSubmission(submission)} className="mt-3 block w-full text-left">
                        <DocumentPreview submission={submission} compact />
                      </button>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{submission.documentType === 'cor' ? 'COR' : 'Campus ID'}</span>
                        {submission.user?.campus && <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{submission.user.campus}</span>}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">{formatDate(submission.submittedAt)}</span>
                      </div>
                      {submission.status === 'pending' && (
                        <div className="mt-4 space-y-3">
                          <textarea value={reviewReasons[submissionId] || ''} onChange={event => setReviewReasons(prev => ({ ...prev, [submissionId]: event.target.value }))} placeholder="Reason if rejected" rows={2} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-[#0b57d0] focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => reviewSubmission(submission, 'reject')} className="h-10 rounded-xl bg-rose-50 text-sm font-black text-rose-700 dark:bg-rose-950/35 dark:text-rose-200">Reject</button>
                            <button type="button" onClick={() => reviewSubmission(submission, 'approve')} className="h-10 rounded-xl bg-emerald-600 text-sm font-black text-white">Approve</button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {!reviewQueue.length && (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                  <FileCheck2 className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 text-lg font-black text-slate-950 dark:text-white">No submissions here</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Campus ID and COR uploads will appear in this dashboard.</p>
                </div>
              )}
            </section>
          )}

          {isDeveloper && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-rose-500">Safety review</p>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">Reported listings</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Review flagged items and hide unsafe posts fast.</p>
                </div>
                <div className="flex gap-2">
                  <select value={reportStatusFilter} onChange={event => setReportStatusFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="">All reports</option>
                    {ownerStatuses.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <button type="button" onClick={loadReportedListings} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <RefreshCw size={17} className={reportsLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>
              {reportedListings.length ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {reportedListings.map(listing => (
                    <article key={getId(listing)} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-slate-950 dark:text-white">{listing.title}</p>
                          <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{formatPrice(listing.price)} - {listing.seller?.name || 'Student seller'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black uppercase ${listingStatusTone[listing.status] || listingStatusTone.active}`}>
                          {getListingStatusLabel(listing.status)}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(listing.reports || []).slice(0, 3).map((report, index) => (
                          <div key={`${getId(report.user)}-${index}`} className="rounded-xl bg-rose-50 p-3 text-sm dark:bg-rose-950/20">
                            <p className="font-black text-rose-800 dark:text-rose-100">{reportReasons.find(item => item.value === report.reason)?.label || 'Report'}</p>
                            <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-100/80">{report.note || 'No extra note.'}</p>
                            <p className="mt-1 text-[11px] font-black uppercase text-rose-500">{report.user?.name || 'Student'} - {formatDate(report.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <button type="button" onClick={() => setSelectedListing(listing)} className="h-10 rounded-xl bg-blue-50 text-sm font-black text-[#0b57d0] dark:bg-blue-950/35 dark:text-sky-200">Open</button>
                        <button type="button" onClick={() => updateListingStatus(getId(listing), 'hidden')} className="h-10 rounded-xl bg-slate-900 text-sm font-black text-white dark:bg-white dark:text-slate-950">Hide</button>
                        <button type="button" onClick={() => updateListingStatus(getId(listing), 'active')} className="h-10 rounded-xl bg-emerald-50 text-sm font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">Clear</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                  <Flag className="mx-auto text-slate-400" size={34} />
                  <p className="mt-3 text-lg font-black text-slate-950 dark:text-white">No reported listings</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Buyer reports will appear here for developer action.</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <ListingDetailModal
        listing={selectedListing}
        user={user}
        canBuySell={canBuySell}
        onClose={() => setSelectedListing(null)}
        onSave={toggleSaveListing}
        onReport={reportListing}
        onMessage={messageSeller}
        onStatus={updateListingStatus}
      />
      <SubmissionModal submission={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
    </div>
  );
}
