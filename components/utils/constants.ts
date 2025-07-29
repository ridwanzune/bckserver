// Set a password to protect the app. 
// For cron jobs, you can pass it as a query parameter: ?action=start&password=YOUR_PASSWORD
// This has been removed for simplicity. If needed, re-implement the PasswordScreen component.
export const APP_PASSWORD = 'Dhakadispatch11@'; 

// API key for APITube.io (Primary News Source)
export const APITUBE_API_KEY = 'api_live_wC4Hy2HwWXt8vtmwfI0FPrP3kTix1pHiX68shxhzhS89erTfOAGH0AERrRG4';

// API key for NewsAPI.org (Fallback News Source)
export const NEWSAPI_ORG_KEY = '0766a80e4d474937a6a8b4f8055c8e3e';

// --- NEW: CLOUDINARY & WEBHOOK CONSTANTS ---
export const CLOUDINARY_CLOUD_NAME = 'dukaroz3u';
export const CLOUDINARY_API_KEY = '151158368369834';
// IMPORTANT: This upload preset must be created in your Cloudinary account
// and configured for unsigned uploads for this to work.
export const CLOUDINARY_UPLOAD_PRESET = 'Autoupload'; 
export const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/mvsz33n18i6dl18xynls7ie9gnoxzghl';
export const MAKE_WEBHOOK_AUTH_TOKEN = 'xR@7!pZ2#qLd$Vm8^tYe&WgC*oUeXsKv';

// --- NEW: STATUS REPORTING WEBHOOK ---
// Create a new, separate webhook in Make.com for receiving status updates.
// This is critical for monitoring and debugging the cron job.
// Paste the new webhook URL here.
export const MAKE_STATUS_WEBHOOK_URL = 'https://hook.eu2.make.com/0ui64t2di3wvvg00fih0d32qp9i9jgme';

// --- NEW: FINAL BUNDLE WEBHOOK ---
// This webhook receives a single payload with all generated content at the end of the automation.
export const MAKE_FINAL_BUNDLE_WEBHOOK_URL = 'https://hook.eu2.make.com/iynaiqae3cig9urc9klykd3oj2tb9prq';


// --- REFINED: TOPIC-BASED NEWS FETCHING CONFIGURATION ---
// This defines more focused queries to gather a higher-quality pool of articles.
// Local news for Bangladesh is fetched in Bengali ('bn') from top-tier local sites.
const BANGLA_NEWS_SITES_FOR_NEWSAPI = 'prothomalo.com,bdnews24.com,kalerkantho.com';
const BANGLA_NEWS_SITES_QUERY_FOR_APITUBE = '(site:prothomalo.com OR site:bdnews24.com OR site:kalerkantho.com)';

export const NEWS_TOPICS = [
  {
    type: 'bangladesh_top_stories',
    newsapi: { endpoint: 'everything', params: { domains: BANGLA_NEWS_SITES_FOR_NEWSAPI, q: 'Bangladesh', sortBy: 'publishedAt', pageSize: '20' } },
    apitube: { q: `(বাংলাদেশ OR "জাতীয় খবর") AND ${BANGLA_NEWS_SITES_QUERY_FOR_APITUBE}`, limit: '20', lang: 'bn' }
  },
  {
    type: 'international_top_stories',
    newsapi: { endpoint: 'top-headlines', params: { sources: 'bbc-news,al-jazeera-english', pageSize: '15' } },
    apitube: { q: 'world headlines OR international news', limit: '15', lang: 'en' }
  },
  {
    type: 'bangladesh_business_tech',
    newsapi: { endpoint: 'everything', params: { domains: BANGLA_NEWS_SITES_FOR_NEWSAPI, q: 'business OR technology', sortBy: 'publishedAt', pageSize: '10' } },
    apitube: { q: `(ব্যবসা OR অর্থনীতি OR প্রযুক্তি) AND ${BANGLA_NEWS_SITES_QUERY_FOR_APITUBE}`, limit: '10', lang: 'bn' }
  },
  {
    type: 'bangladesh_politics',
    newsapi: { endpoint: 'everything', params: { domains: BANGLA_NEWS_SITES_FOR_NEWSAPI, q: 'politics', sortBy: 'publishedAt', pageSize: '10' } },
    apitube: { q: `(রাজনীতি OR নির্বাচন) AND ${BANGLA_NEWS_SITES_QUERY_FOR_APITUBE}`, limit: '10', lang: 'bn' }
  },
    {
    type: 'bangladesh_culture_people',
    newsapi: { endpoint: 'everything', params: { domains: BANGLA_NEWS_SITES_FOR_NEWSAPI, q: 'culture OR entertainment OR people', sortBy: 'publishedAt', pageSize: '10' } },
    apitube: { q: `(সংস্কৃতি OR বিনোদন OR সমাজ) AND ${BANGLA_NEWS_SITES_QUERY_FOR_APITUBE}`, limit: '10', lang: 'bn' }
  }
];


// --- REFINED: NEWS CATEGORIES FOR BATCH PROCESSING ---
// Defines the 6 content pieces to be generated in each run, mapping them to the refined topic types above.
export const NEWS_CATEGORIES = [
  { id: 'nat_1', name: 'Top National Story', type: 'bangladesh_top_stories' },
  { id: 'nat_2', name: 'Second National Story', type: 'bangladesh_top_stories' },
  { id: 'intl_1', name: 'Top International Story', type: 'international_top_stories' },
  { id: 'biz_1', name: 'Bangladesh Business/Tech', type: 'bangladesh_business_tech' },
  { id: 'cul_1', name: 'Bangladesh Culture/People', type: 'bangladesh_culture_people' },
  { id: 'pol_1', name: 'Bangladesh Politics', type: 'bangladesh_politics' },
];

// The delay in milliseconds between fetching news for each category.
// No longer needed due to the new, more efficient architecture.
export const API_FETCH_DELAY_MS = 0;


// URL for the new logo image
export const LOGO_URL = 'https://res.cloudinary.com/dy80ftu9k/image/upload/v1753507647/scs_cqidjz.png';

// Text to be displayed on the bottom right of the image
export const BRAND_TEXT = 'Dhaka Dispatch';

// URL for the visual overlay
export const OVERLAY_IMAGE_URL = 'https://res.cloudinary.com/dy80ftu9k/image/upload/v1753644798/Untitled-1_hxkjvt.png';