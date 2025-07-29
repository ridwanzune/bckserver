

import { GoogleGenAI, Type } from "@google/genai";
import type { SelectedArticleAnalysis, NewsDataArticle } from '../types';

// The API key is sourced exclusively from the `API_KEY` environment variable.
// This is required for the AI Studio environment and deployment.
const GEMINI_API_KEY = process.env.API_KEY;

if (!GEMINI_API_KEY) {
    const errorMessage = "CRITICAL: Gemini API key is missing. Ensure the `API_KEY` environment variable is set.";
    console.error(errorMessage);
    throw new Error(errorMessage);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// A schema for the AI to return translated article content.
const translationSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            originalId: { type: Type.INTEGER },
            translatedTitle: { type: Type.STRING },
            translatedContent: { type: Type.STRING },
        },
        required: ['originalId', 'translatedTitle', 'translatedContent'],
    },
};

// The schema that defines the structure of the JSON object the AI must return for analysis.
const responseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            originalArticleId: {
                type: Type.INTEGER,
                description: 'The original ID number of the article from the provided list that was selected.',
            },
            category: {
                type: Type.STRING,
                enum: ['bangladesh_top_stories', 'international_top_stories', 'bangladesh_business_tech', 'bangladesh_culture_people', 'bangladesh_politics'],
                description: 'The category this article was selected for.',
            },
            headline: {
                type: Type.STRING,
                description: 'A new, compelling headline created based on the IMPACT principle.',
            },
            highlightPhrases: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'An array of key phrases from the new headline.',
            },
            imagePrompt: {
                type: Type.STRING,
                description: 'A safe-for-work, symbolic image prompt based on the SCAT principle, avoiding specific people, violence, or sensitive topics.',
            },
            caption: {
                type: Type.STRING,
                description: 'A social media caption of about 50 words with 3-5 relevant hashtags. The source name should NOT be in the caption.',
            },
            sourceName: {
                type: Type.STRING,
                description: "The name of the original news source (e.g., 'Prothom Alo'). This is a separate, mandatory field.",
            },
        },
        required: ['originalArticleId', 'category', 'headline', 'highlightPhrases', 'imagePrompt', 'caption', 'sourceName'],
    },
};

/**
 * Translates a batch of news articles to English using a single Gemini API call.
 * @param articles An array of articles, some of which may be in Bengali.
 * @returns A promise that resolves to the same array of articles with content translated to English.
 */
export const translateArticlesToEnglish = async (
  articles: NewsDataArticle[]
): Promise<NewsDataArticle[]> => {
    if (articles.length === 0) return [];
    
    // Create a list of articles for the prompt, including an ID for re-mapping.
    const articleListForPrompt = articles
        .map((article, index) => `
ARTICLE ${index}:
ID: ${index}
Title: ${article.title}
Content: ${article.content || article.description}
---`
        ).join('\n');
        
    const prompt = `
You are an expert translator. Your task is to translate the 'Title' and 'Content' of the following list of news articles into high-quality, fluent English.

**Instructions:**
1.  Review all articles. Some may not be in English.
2.  If an article is NOT in English, translate its Title and Content.
3.  If an article IS ALREADY in English, return its original Title and Content without modification.
4.  Return a JSON array where each object corresponds to an article from the original list. Maintain the original order.

**List of Articles:**
${articleListForPrompt}

**Output Format:**
Return a JSON array that strictly adheres to the provided schema. Each object must contain the original ID, the translated title, and the translated content.
`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: translationSchema,
            },
        });
        
        const responseText = response.text?.trim();
        if (!responseText) {
            throw new Error("Received an empty text response from the translation API.");
        }

        const translatedData: { originalId: number; translatedTitle: string; translatedContent: string }[] = JSON.parse(responseText);

        // Create a new array of articles with the translated content.
        const translatedArticles = [...articles];
        translatedData.forEach(item => {
            if (translatedArticles[item.originalId]) {
                translatedArticles[item.originalId].title = item.translatedTitle;
                translatedArticles[item.originalId].content = item.translatedContent;
                // Also update description as it's used as a fallback for content.
                if (translatedArticles[item.originalId].description) {
                    translatedArticles[item.originalId].description = item.translatedContent;
                }
            }
        });

        return translatedArticles;

    } catch (error) {
        console.error("Error during article translation:", error);
        // On failure, return the original articles to allow the process to continue.
        // This is a graceful fallback.
        return articles;
    }
};

/**
 * Reviews a large list of news articles and uses a single AI call to select and analyze the 6 best ones.
 * @param articles A large list of potential news articles.
 * @returns A Promise resolving to an array of up to 6 analyzed articles.
 */
export const selectAndAnalyzeSixBestArticles = async (
  articles: NewsDataArticle[]
): Promise<SelectedArticleAnalysis[]> => {
    // If there are no articles, return immediately to avoid a pointless API call.
    if (articles.length === 0) {
        console.log("No articles provided to AI for analysis. Returning empty array.");
        return [];
    }
    
    const model = 'gemini-2.5-flash';

    // We assign a simple index as an ID for each article so the AI can reference it.
    const articleListForPrompt = articles
        .map((article, index) => `
ARTICLE ${index}:
ID: ${index}
Title: ${article.title}
Content: ${article.content || article.description}
Source: ${article.source_id}
---`
        ).join('\n');
    
    const prompt = `
You are an expert news editor for a social media channel targeting a Bangladeshi audience. Your goal is to curate a batch of top-tier news stories from a large, combined list of recent articles.

**Your Task:**
1.  **Review the entire list** of articles provided below. The articles have been sourced from queries on specific topics, many from local Bengali news outlets. They have been translated to English for your review.
2.  **Select exactly 6 articles** that are the most impactful and **recent**. You MUST fulfill the following distribution, prioritizing articles from local Bangladeshi sources (like Prothom Alo, bdnews24, etc.) for local categories:
    -   **2 articles** for 'bangladesh_top_stories': Must be the two most significant **NATIONAL** stories from **BANGLADESH**. These should be the most important, timely general news for the country.
    -   **1 article** for 'international_top_stories': Must have **GLOBAL** significance from a top-tier international source (like BBC, Al Jazeera).
    -   **1 article** for 'bangladesh_business_tech': Must be a significant story about **Business, Economy, or Technology** in Bangladesh.
    -   **1 article** for 'bangladesh_politics': Must be a significant and recent story about **Politics or Elections** in Bangladesh.
    -   **1 article** for 'bangladesh_culture_people': Must be a compelling story about **Culture, Arts, Human Interest, or a notable Person** in Bangladesh.
    If you cannot find a suitable article for a category from the provided list, you MUST still try your best to find the closest match. Do not leave a category empty.
3.  For EACH of the 6 articles you select, you must perform a full analysis.

**Analysis Steps for Each Selected Article:**
1.  **Headline Generation (IMPACT Principle):** Informative, Main Point, Prompting Curiosity, Active Voice, Concise, Targeted.
2.  **Highlight Phrase Identification:** Identify key phrases from your new headline that capture critical information.
3.  **Image Prompt Generation (SCAT Principle & Safety):** Generate a concise, descriptive prompt for an AI image generator. The prompt MUST be safe for work and MUST NOT contain depictions of specific people, violence, or sensitive topics. Focus on symbolic or abstract representations.
4.  **Caption & Source:** Create a social media caption (~50 words) with 3-5 relevant hashtags. DO NOT include the source name in the caption itself. The source name will be a separate field.

**List of Available Articles:**
${articleListForPrompt}

**Output Instructions:**
Return a JSON array containing exactly 6 objects for each article you selected and analyzed. Adhere strictly to the provided JSON schema.
`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        const responseText = response.text?.trim();

        if (!responseText) {
            throw new Error("Received an empty text response from the API.");
        }

        const parsedResponse = JSON.parse(responseText);

        if (!Array.isArray(parsedResponse)) {
             throw new Error(`AI returned an invalid response. Expected an array of items, but got a different type.`);
        }
        
        // The check for exactly 6 items is removed to allow for flexibility.
        return parsedResponse as SelectedArticleAnalysis[];

    } catch (error) {
        console.error("Error in selectAndAnalyzeSixBestArticles:", error);
        const originalErrorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Gemini analysis failed: ${originalErrorMessage}`);
    }
};