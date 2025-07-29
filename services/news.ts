
import { APITUBE_API_KEY, NEWSAPI_ORG_KEY, NEWS_TOPICS } from '../components/utils/constants';
import type { NewsDataArticle } from '../types';

// --- Interfaces for APITube.io (Primary Source) ---
interface ApiTubeArticle {
  title: string; url: string; published_at: string; summary: string | null; content: string | null;
  image: { url: string | null; } | null; source: { name:string; };
}

// --- Interfaces for NewsAPI.org (Fallback Source) ---
interface NewsApiArticle {
  title: string; url: string; publishedAt: string; source: { name: string; };
  urlToImage: string | null; description: string | null; content: string | null;
}

// --- Helper to get date for API filtering (still used by APITube) ---
const getTwoDaysAgoDateString = (): string => {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
};


// --- Data Mapping Functions ---
const mapApiTubeToNewsDataArticle = (articles: ApiTubeArticle[]): NewsDataArticle[] => {
    return articles.map(article => ({
        title: article.title, link: article.url, pubDate: article.published_at,
        source_id: article.source.name, image_url: article.image?.url || null,
        description: article.summary, content: article.content || article.summary,
    }));
};

const mapNewsApiToNewsDataArticle = (articles: NewsApiArticle[]): NewsDataArticle[] => {
    return articles.map(article => ({
        title: article.title, link: article.url, pubDate: article.publishedAt,
        source_id: article.source.name, image_url: article.urlToImage,
        description: article.description, content: article.content || article.description,
    }));
};


// --- Fetching Logic for Each Service using a more reliable proxy and headers ---

const fetchFromApiTube = async (topic: typeof NEWS_TOPICS[0]): Promise<NewsDataArticle[]> => {
  const PROXY_PREFIX = 'https://corsproxy.io/?';
  const BASE_URL = 'https://api.apitube.io/v1/news/everything';
  const twoDaysAgo = getTwoDaysAgoDateString();
  
  // Use the new dynamic language property from the topic config.
  const { q, limit, lang } = topic.apitube;
  const params = new URLSearchParams({
      'api_key': APITUBE_API_KEY,
      'limit': limit,
      'language': lang || 'en', // Use configured language, fallback to 'en'
      'from': twoDaysAgo,
      'q': q,
  });
  
  const targetUrl = `${BASE_URL}?${params.toString()}`;
  const finalUrl = `${PROXY_PREFIX}${encodeURIComponent(targetUrl)}`;
  
  try {
    const response = await fetch(finalUrl);
    if (!response.ok) {
        try {
            const errorData = await response.json();
            const errorMessage = errorData?.error?.message || errorData?.message || JSON.stringify(errorData);
            throw new Error(`API request failed with status ${response.status}: ${errorMessage}`);
        } catch (e) {
            throw new Error(`API request failed with status ${response.status} and could not parse the error response body.`);
        }
    }

    const apiData = await response.json();
    
    let articles: ApiTubeArticle[] | undefined;
    if (apiData && Array.isArray(apiData.data)) articles = apiData.data;
    else if (apiData && Array.isArray(apiData.results)) articles = apiData.results;
    else if (apiData && Array.isArray(apiData.articles)) articles = apiData.articles;
    else if (Array.isArray(apiData)) articles = apiData;

    if (articles) {
        return mapApiTubeToNewsDataArticle(articles);
    }
    
    throw new Error(`Unexpected format in APITube response. Keys found: ${Object.keys(apiData).join(', ')}`);

  } catch (error) {
    console.error(`APITube request for '${topic.type}' failed:`, error);
    return []; // Return empty array on failure to ensure process continues.
  }
};

const fetchFromNewsApi = async (topic: typeof NEWS_TOPICS[0]): Promise<NewsDataArticle[]> => {
    const PROXY_PREFIX = 'https://corsproxy.io/?';
    const { endpoint, params: topicParams } = topic.newsapi;
    const BASE_URL = `https://newsapi.org/v2/${endpoint}`;

    const params = new URLSearchParams({
        apiKey: NEWSAPI_ORG_KEY,
        ...topicParams
    });

    const targetUrl = `${BASE_URL}?${params.toString()}`;
    const finalUrl = `${PROXY_PREFIX}${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(finalUrl);

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const apiData = await response.json();

        if (apiData.status !== 'ok') {
            throw new Error(`NewsAPI.org API Error: ${apiData.message}`);
        }
        
        if (!apiData || !Array.isArray(apiData.articles)) throw new Error('Unexpected format from NewsAPI.org.');
        return mapNewsApiToNewsDataArticle(apiData.articles);
    } catch (error) {
        console.error(`NewsAPI.org request for '${topic.type}' failed:`, error);
        return []; // Return empty array on failure
    }
};

/**
 * Fetches news from both APITube and NewsAPI for a list of topics, then
 * combines and deduplicates them into a single large list.
 * @returns A promise that resolves with a large, combined array of unique news articles.
 */
export const fetchAllNewsFromSources = async (): Promise<NewsDataArticle[]> => {
    console.log("Starting to fetch news from all sources based on defined topics...");
    const promises: Promise<NewsDataArticle[]>[] = [];

    // Create all fetch promises to run in parallel based on NEWS_TOPICS
    for (const topic of NEWS_TOPICS) {
        promises.push(fetchFromApiTube(topic));
        promises.push(fetchFromNewsApi(topic));
    }

    const results = await Promise.all(promises);
    
    // Flatten the array of arrays into a single array
    const allArticles = results.flat();
    
    console.log(`Fetched a total of ${allArticles.length} articles before deduplication.`);

    // Deduplicate articles based on the link to avoid sending the same story to the AI
    const uniqueArticlesMap = new Map<string, NewsDataArticle>();
    allArticles.forEach(article => {
        if (article.link && !uniqueArticlesMap.has(article.link)) {
            uniqueArticlesMap.set(article.link, article);
        }
    });

    const uniqueArticles = Array.from(uniqueArticlesMap.values());
    console.log(`Returning ${uniqueArticles.length} unique articles for analysis.`);
    
    return uniqueArticles;
};
